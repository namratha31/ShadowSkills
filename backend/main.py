from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from groq import Groq
import requests
import json
import os
import asyncio
from datetime import datetime, timezone
from dotenv import load_dotenv

# ── APScheduler for cron jobs ──
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────
# 🔐  API KEYS  (add these to your .env file)
# ─────────────────────────────────────────────
# GROQ_API_KEY      = your Groq key  (required)
# GITHUB_TOKEN      = your GitHub PAT (optional, raises rate limit)
# LINKEDIN_API_KEY  = Proxycurl key   (optional)
# CRON_INTERVAL_HOURS = how often to re-analyse all tracked users (default 6)
# ─────────────────────────────────────────────
GROQ_API_KEY         = os.getenv("GROQ_API_KEY", "").strip()
GITHUB_TOKEN         = os.getenv("GITHUB_TOKEN", "").strip()
LINKEDIN_API_KEY     = os.getenv("LINKEDIN_API_KEY", "").strip()
CRON_INTERVAL_HOURS  = int(os.getenv("CRON_INTERVAL_HOURS", "24"))

if not GROQ_API_KEY:
    raise Exception("Missing GROQ_API_KEY in .env")

client = Groq(api_key=GROQ_API_KEY)

# ─────────────────────────────────────────────
# In-memory stores (swap for PostgreSQL later)
# ─────────────────────────────────────────────
# Tracked users registered for periodic re-analysis
tracked_users: dict[str, dict] = {}
# Cache: username → latest analysis result
analysis_cache: dict[str, dict] = {}
# Cron run history
cron_log: list[dict] = []


# ═══════════════════════════════════════════════════════
#  GITHUB HELPERS
# ═══════════════════════════════════════════════════════

def fetch_github_commits(username, headers, repos):
    commits = []

    events_res = requests.get(
        f"https://api.github.com/users/{username}/events/public",
        headers=headers,
    )
    if events_res.status_code == 200:
        for event in events_res.json():
            if event.get("type") != "PushEvent":
                continue
            repo_name = event.get("repo", {}).get("name")
            created_at = event.get("created_at")  # ISO 8601 string

            for commit in event.get("payload", {}).get("commits", []):
                if len(commits) >= 40:
                    break
                commits.append({
                    "repo": repo_name,
                    "message": commit.get("message"),
                    "url": commit.get("url"),
                    "timestamp": created_at,   # ← used by Time Breaker
                })
            if len(commits) >= 40:
                break

    # Fallback: per-repo commits
    if not commits:
        top_repos = sorted(repos, key=lambda r: r.get("stars", 0), reverse=True)[:8]
        for repo in top_repos:
            repo_name = repo.get("name")
            if not repo_name:
                continue
            res = requests.get(
                f"https://api.github.com/repos/{username}/{repo_name}/commits"
                f"?author={username}&per_page=5",
                headers=headers,
            )
            if res.status_code != 200:
                continue
            for commit in res.json():
                if len(commits) >= 40:
                    break
                cd = commit.get("commit", {})
                commits.append({
                    "repo": repo_name,
                    "message": cd.get("message"),
                    "url": commit.get("html_url"),
                    "timestamp": cd.get("author", {}).get("date"),
                })
            if len(commits) >= 40:
                break

    return commits


def fetch_github_data(username):
    headers = {}
    if GITHUB_TOKEN:
        headers["Authorization"] = f"token {GITHUB_TOKEN}"

    user_res = requests.get(f"https://api.github.com/users/{username}", headers=headers)
    if user_res.status_code != 200:
        raise Exception(f"GitHub error: {user_res.text}")
    user = user_res.json()

    repos_res = requests.get(
        f"https://api.github.com/users/{username}/repos?per_page=20",
        headers=headers,
    )
    if repos_res.status_code != 200:
        raise Exception(f"GitHub repos error: {repos_res.text}")

    repos = repos_res.json()
    repo_data = [
        {
            "name": r.get("name"),
            "language": r.get("language"),
            "description": r.get("description"),
            "stars": r.get("stargazers_count"),
            "forks": r.get("forks_count"),
        }
        for r in repos
    ]

    commits = fetch_github_commits(username, headers, repo_data)

    return {
        "username": username,
        "name": user.get("name"),
        "bio": user.get("bio"),
        "public_repos": user.get("public_repos"),
        "followers": user.get("followers"),
        "repos": repo_data,
        "commit_summary": {
            "commit_count": len(commits),
            "recent_commits": commits[:10],
            "all_commits": commits,           # ← Time Breaker uses full list
        },
    }


# ═══════════════════════════════════════════════════════
#  TIME BREAKER
# ═══════════════════════════════════════════════════════

def compute_time_breaker(all_commits: list[dict]) -> list[dict]:
    """
    Calculates time-between-consecutive-commits for every commit pair
    in the same repo, then returns the top 5 fastest (smallest gap).

    Each entry:  { rank, repo, message, committed_at, gap_minutes }
    """
    from collections import defaultdict

    # Group by repo, sort by timestamp ascending
    by_repo: dict[str, list] = defaultdict(list)
    for c in all_commits:
        if c.get("timestamp"):
            by_repo[c["repo"]].append(c)

    intervals = []
    for repo, commits in by_repo.items():
        # Sort oldest → newest
        sorted_commits = sorted(
            commits,
            key=lambda c: c["timestamp"],
        )
        for i in range(1, len(sorted_commits)):
            prev = sorted_commits[i - 1]
            curr = sorted_commits[i]
            try:
                t_prev = datetime.fromisoformat(prev["timestamp"].replace("Z", "+00:00"))
                t_curr = datetime.fromisoformat(curr["timestamp"].replace("Z", "+00:00"))
                gap_minutes = round((t_curr - t_prev).total_seconds() / 60, 1)
                if gap_minutes > 0:
                    intervals.append({
                        "repo": repo,
                        "message": curr.get("message", "")[:80],
                        "committed_at": curr["timestamp"],
                        "gap_minutes": gap_minutes,
                    })
            except Exception:
                continue

    # Top 5 smallest gaps = fastest commits
    top5 = sorted(intervals, key=lambda x: x["gap_minutes"])[:5]
    for i, entry in enumerate(top5, 1):
        entry["rank"] = i
    return top5


# ═══════════════════════════════════════════════════════
#  LINKEDIN HELPER
# ═══════════════════════════════════════════════════════

def fetch_linkedin_data(linkedin_url):
    if not LINKEDIN_API_KEY or not linkedin_url:
        return None

    res = requests.get(
        f"https://nubela.co/proxycurl/api/v2/linkedin?url={linkedin_url}",
        headers={"Authorization": f"Bearer {LINKEDIN_API_KEY}"},
    )
    if res.status_code != 200:
        print("LinkedIn error:", res.text)
        return None

    data = res.json()
    return {
        "name": data.get("full_name"),
        "headline": data.get("headline"),
        "location": data.get("location"),
        "skills": data.get("skills", [])[:10],
        "experience": data.get("experiences", [])[:3],
    }


# ═══════════════════════════════════════════════════════
#  AI ANALYSIS
# ═══════════════════════════════════════════════════════

def extract_json(text: str) -> dict:
    """Robustly extract a JSON object from an LLM response."""
    # Strip markdown fences
    if "```" in text:
        parts = text.split("```")
        for part in parts:
            part = part.strip()
            if part.startswith("json"):
                part = part[4:].strip()
            if part.startswith("{"):
                try:
                    return json.loads(part)
                except Exception:
                    continue

    # Try raw parse
    try:
        return json.loads(text)
    except Exception:
        pass

    # Find outermost { } substring
    start = text.find("{")
    end   = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        try:
            return json.loads(text[start:end + 1])
        except Exception:
            pass

    raise Exception(f"Could not parse JSON. Raw AI output:\n{text[:600]}")


def analyze_with_groq(github_data, linkedin_data=None):
    combined = {
        "github": {
            "repos": github_data.get("repos", [])[:6],
            "commit_count": github_data.get("commit_summary", {}).get("commit_count"),
            "recent_commits": github_data.get("commit_summary", {}).get("recent_commits"),
            "followers": github_data.get("followers"),
        },
        "linkedin": linkedin_data or {},
    }

    prompt = f"""Analyze this developer profile and respond with ONLY a JSON object. No explanation, no markdown fences, no extra text — just raw JSON.

DATA:
{json.dumps(combined, indent=2)}

Use this exact structure:
{{
  "hidden_strengths": ["strength 1", "strength 2", "strength 3"],
  "blind_spots": ["blind spot 1", "blind spot 2"],
  "skills": [
    {{"name": "Python", "confidence": 85, "evidence": "10 repos use Python"}},
    {{"name": "Git", "confidence": 75, "evidence": "consistent commit history"}},
    {{"name": "API Design", "confidence": 60, "evidence": "REST endpoints visible in projects"}}
  ],
  "career_roles": ["Backend Developer", "Full Stack Engineer", "DevOps Engineer"],
  "summary": "One paragraph honest summary of this developer based on their actual activity."
}}

Rules:
- confidence must be an integer 1-100
- hidden_strengths: exactly 3 strings
- blind_spots: exactly 2 strings
- skills: exactly 3 objects
- career_roles: exactly 3 strings
- Compare GitHub reality vs LinkedIn claims and flag mismatches
- Output ONLY the JSON object, nothing else"""

    response = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[
            {
                "role": "system",
                "content": "You are a JSON API. Output only valid JSON objects. Never use markdown, code fences, or any explanation text.",
            },
            {"role": "user", "content": prompt},
        ],
        temperature=0.3,
    )

    text = response.choices[0].message.content.strip()
    return extract_json(text)


# ═══════════════════════════════════════════════════════
#  CORE ANALYSIS PIPELINE  (shared by route + cron)
# ═══════════════════════════════════════════════════════

def run_full_analysis(username: str, linkedin_url: str | None = None) -> dict:
    github_data   = fetch_github_data(username)
    linkedin_data = fetch_linkedin_data(linkedin_url)
    result        = analyze_with_groq(github_data, linkedin_data)

    all_commits       = github_data.get("commit_summary", {}).get("all_commits", [])
    time_breaker_top5 = compute_time_breaker(all_commits)

    result["github"]        = github_data
    result["linkedin"]      = linkedin_data
    result["time_breaker"]  = time_breaker_top5
    result["analysed_at"]   = datetime.now(timezone.utc).isoformat()

    return result


# ═══════════════════════════════════════════════════════
#  CRON JOB LOGIC
# ═══════════════════════════════════════════════════════

async def cron_reanalyze_all():
    """
    Runs on schedule. Re-analyses every tracked user and
    updates the cache.  Errors per user are logged but don't
    stop the whole run.
    """
    run_start = datetime.now(timezone.utc).isoformat()
    results   = []
    print(f"[CRON] Starting re-analysis run at {run_start} for {len(tracked_users)} user(s)")

    for username, meta in list(tracked_users.items()):
        linkedin_url = meta.get("linkedin_url")
        try:
            result = run_full_analysis(username, linkedin_url)
            analysis_cache[username] = result
            results.append({"username": username, "status": "ok", "analysed_at": result["analysed_at"]})
            print(f"[CRON] ✓ {username}")
        except Exception as e:
            results.append({"username": username, "status": "error", "error": str(e)})
            print(f"[CRON] ✗ {username}: {e}")

    cron_log.append({"run_at": run_start, "results": results})
    # Keep only last 20 log entries
    if len(cron_log) > 20:
        cron_log.pop(0)
    print(f"[CRON] Run complete. {len(results)} user(s) processed.")


# ═══════════════════════════════════════════════════════
#  SCHEDULER LIFECYCLE
# ═══════════════════════════════════════════════════════

scheduler = AsyncIOScheduler()

@app.on_event("startup")
async def startup_event():
    scheduler.add_job(
        cron_reanalyze_all,
        trigger=IntervalTrigger(hours=CRON_INTERVAL_HOURS),
        id="reanalyze_all",
        replace_existing=True,
        misfire_grace_time=300,
    )
    scheduler.start()
    print(f"[CRON] Scheduler started — re-analysis every {CRON_INTERVAL_HOURS}h")

@app.on_event("shutdown")
async def shutdown_event():
    scheduler.shutdown(wait=False)
    print("[CRON] Scheduler stopped")


# ═══════════════════════════════════════════════════════
#  ROUTES
# ═══════════════════════════════════════════════════════

@app.get("/")
def root():
    return {"message": "ShadowSkills API is running 🚀"}


# ── Main analysis ──────────────────────────────────────
@app.get("/analyze/{username}")
def analyze(username: str, linkedin_url: str = None):
    try:
        result = run_full_analysis(username, linkedin_url)
        # Always update cache + tracked list
        analysis_cache[username] = result
        if username not in tracked_users:
            tracked_users[username] = {"linkedin_url": linkedin_url, "added_at": datetime.now(timezone.utc).isoformat()}
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Serve cached result (fast, no API calls) ──────────
@app.get("/cache/{username}")
def get_cached(username: str):
    if username not in analysis_cache:
        raise HTTPException(status_code=404, detail="No cached result. Call /analyze first.")
    return analysis_cache[username]


# ── Time Breaker leaderboard ──────────────────────────
@app.get("/time-breaker/{username}")
def time_breaker(username: str):
    """
    Returns the top 5 fastest commit intervals for a user.
    Uses cache if available, otherwise fetches fresh GitHub data.
    """
    try:
        if username in analysis_cache:
            top5 = analysis_cache[username].get("time_breaker", [])
            return {"username": username, "top5": top5, "source": "cache"}

        headers = {}
        if GITHUB_TOKEN:
            headers["Authorization"] = f"token {GITHUB_TOKEN}"
        github_data = fetch_github_data(username)
        all_commits = github_data["commit_summary"]["all_commits"]
        top5 = compute_time_breaker(all_commits)
        return {"username": username, "top5": top5, "source": "fresh"}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Tracked users management ──────────────────────────
@app.post("/track/{username}")
def track_user(username: str, linkedin_url: str = None):
    """Register a user for automatic periodic re-analysis by the cron job."""
    tracked_users[username] = {
        "linkedin_url": linkedin_url,
        "added_at": datetime.now(timezone.utc).isoformat(),
    }
    return {"message": f"{username} is now tracked", "interval_hours": CRON_INTERVAL_HOURS}


@app.delete("/track/{username}")
def untrack_user(username: str):
    if username not in tracked_users:
        raise HTTPException(status_code=404, detail="User not tracked")
    tracked_users.pop(username)
    return {"message": f"{username} removed from tracking"}


@app.get("/tracked")
def list_tracked():
    return {"tracked_users": tracked_users, "count": len(tracked_users)}


# ── Cron status & logs ────────────────────────────────
@app.get("/cron/status")
def cron_status():
    jobs = []
    for job in scheduler.get_jobs():
        next_run = job.next_run_time
        jobs.append({
            "id": job.id,
            "next_run": next_run.isoformat() if next_run else None,
            "trigger": str(job.trigger),
        })
    return {
        "scheduler_running": scheduler.running,
        "interval_hours": CRON_INTERVAL_HOURS,
        "tracked_user_count": len(tracked_users),
        "jobs": jobs,
        "last_log": cron_log[-1] if cron_log else None,
    }


@app.get("/cron/logs")
def cron_logs():
    return {"logs": cron_log}


@app.post("/cron/trigger")
async def trigger_cron_now(background_tasks: BackgroundTasks):
    """Manually trigger a re-analysis run right now (useful for testing)."""
    background_tasks.add_task(cron_reanalyze_all)
    return {"message": "Cron run triggered", "tracked_users": list(tracked_users.keys())}


# ═══════════════════════════════════════════════════════
#  MOCK DATA — LinkedIn & Unstop (demo / no real API key)
#  These return realistic fake data keyed to the username
#  so every user gets a unique-looking profile.
# ═══════════════════════════════════════════════════════

import hashlib, random as _random

def _seed(username: str) -> _random.Random:
    """Deterministic RNG seeded from username — same user always gets same mock data."""
    h = int(hashlib.md5(username.encode()).hexdigest(), 16)
    r = _random.Random(h)
    return r


@app.get("/mock/linkedin/{username}")
def mock_linkedin(username: str):
    """
    Returns realistic mock LinkedIn data for demo purposes.
    Data is deterministic — same username always returns same profile.
    """
    r = _seed(username)

    hackathon_pool = [
        {"name": "Smart India Hackathon 2024", "result": "Finalist", "date": "Dec 2024"},
        {"name": "HackWithInfy", "result": "Top 10", "date": "Oct 2024"},
        {"name": "Athernex DSCE", "result": "Winner", "date": "Apr 2025"},
        {"name": "HackNITR 5.0", "result": "Participant", "date": "Feb 2025"},
        {"name": "Flipkart GRiD 6.0", "result": "Shortlisted", "date": "Aug 2024"},
        {"name": "Unstop Hackathon", "result": "Finalist", "date": "Jan 2025"},
    ]
    summit_pool = [
        "TechSyncc AI Summit 2025",
        "Google I/O Extended Bengaluru",
        "GitHub Universe Webinar",
        "AWS Cloud Day India",
        "PyConf Hyderabad 2024",
    ]
    cert_pool = [
        {"name": "AWS Cloud Practitioner", "issuer": "Amazon", "date": "Mar 2025"},
        {"name": "Google Data Analytics", "issuer": "Google", "date": "Nov 2024"},
        {"name": "Meta Front-End Developer", "issuer": "Meta", "date": "Jan 2025"},
        {"name": "Postman API Fundamentals", "issuer": "Postman", "date": "Feb 2025"},
        {"name": "GitHub Foundations", "issuer": "GitHub", "date": "Dec 2024"},
    ]
    skill_pool = [
        "Python", "React", "FastAPI", "Node.js", "Machine Learning",
        "SQL", "Docker", "Git", "REST APIs", "System Design",
    ]

    # Days since last post — affects visibility score
    days_since_post = r.randint(1, 30)
    visibility_score = max(20, 100 - (days_since_post * 3))

    picked_hackathons = r.sample(hackathon_pool, k=r.randint(2, 4))
    picked_summits    = r.sample(summit_pool, k=r.randint(1, 3))
    picked_certs      = r.sample(cert_pool, k=r.randint(2, 3))
    picked_skills     = r.sample(skill_pool, k=6)
    connections       = r.randint(180, 720)
    post_count        = r.randint(3, 28)

    reminder = None
    if days_since_post > 7:
        reminder = {
            "trigger": True,
            "message": f"You haven't posted in {days_since_post} days. Your visibility dropped {min(days_since_post * 3, 60)}%. Post something today to stay on recruiters' radar.",
            "suggested_post": f"Just wrapped up a new feature on {username}'s latest project 🚀 Loving the grind. #buildinpublic #coding",
        }
    else:
        reminder = {"trigger": False, "message": "Great job staying active! Keep posting."}

    return {
        "source": "mock",
        "profile": {
            "name": username.replace("-", " ").title(),
            "headline": r.choice([
                "Full Stack Developer | Open to Opportunities",
                "CS Student @ SKIT | Building cool stuff",
                "SDE Intern | React · Python · FastAPI",
                "Final Year CSE | Hackathon Enthusiast",
            ]),
            "connections": connections,
            "location": r.choice(["Bengaluru, IN", "Hyderabad, IN", "Chennai, IN", "Pune, IN"]),
            "post_count_last_30_days": post_count,
            "days_since_last_post": days_since_post,
        },
        "visibility_score": visibility_score,
        "activity_status": "active" if days_since_post <= 7 else "declining",
        "hackathons": picked_hackathons,
        "summits_attended": picked_summits,
        "certifications": picked_certs,
        "top_skills": picked_skills,
        "confidence_boost": len([h for h in picked_hackathons if h["result"] in ["Winner", "Finalist", "Top 10"]]) * 8,
        "reminder": reminder,
    }


@app.get("/mock/unstop/{username}")
def mock_unstop(username: str):
    """
    Returns realistic mock Unstop job/internship listings matched to the user.
    In production, replace with real Unstop API + keyword extraction.
    """
    r = _seed(username)

    all_jobs = [
        {
            "id": "UST001",
            "title": "Backend Engineer Intern",
            "company": "Razorpay",
            "type": "Internship",
            "duration": "6 months",
            "stipend": "₹25,000/mo",
            "location": "Bengaluru (Hybrid)",
            "skills": ["Python", "FastAPI", "PostgreSQL", "REST APIs"],
            "deadline": "10 May 2026",
            "applicants": 312,
            "match": 94,
        },
        {
            "id": "UST002",
            "title": "Full Stack Developer",
            "company": "Zepto",
            "type": "Full-time",
            "duration": None,
            "stipend": "₹12-18 LPA",
            "location": "Mumbai (On-site)",
            "skills": ["React", "Node.js", "MongoDB", "Docker"],
            "deadline": "15 May 2026",
            "applicants": 876,
            "match": 88,
        },
        {
            "id": "UST003",
            "title": "ML Engineer Intern",
            "company": "Sarvam AI",
            "type": "Internship",
            "duration": "3 months",
            "stipend": "₹30,000/mo",
            "location": "Bengaluru (Remote)",
            "skills": ["Python", "TensorFlow", "NLP", "Git"],
            "deadline": "5 May 2026",
            "applicants": 541,
            "match": 81,
        },
        {
            "id": "UST004",
            "title": "SDE-1",
            "company": "CRED",
            "type": "Full-time",
            "duration": None,
            "stipend": "₹15-20 LPA",
            "location": "Bengaluru (Hybrid)",
            "skills": ["Java", "Spring Boot", "MySQL", "System Design"],
            "deadline": "20 May 2026",
            "applicants": 1203,
            "match": 76,
        },
        {
            "id": "UST005",
            "title": "DevOps Intern",
            "company": "HashedIn by Deloitte",
            "type": "Internship",
            "duration": "6 months",
            "stipend": "₹20,000/mo",
            "location": "Bengaluru (On-site)",
            "skills": ["Docker", "Kubernetes", "CI/CD", "Linux"],
            "deadline": "8 May 2026",
            "applicants": 228,
            "match": 71,
        },
        {
            "id": "UST006",
            "title": "React Developer",
            "company": "ShareChat",
            "type": "Full-time",
            "duration": None,
            "stipend": "₹10-14 LPA",
            "location": "Remote",
            "skills": ["React", "TypeScript", "Redux", "REST APIs"],
            "deadline": "25 May 2026",
            "applicants": 445,
            "match": 68,
        },
    ]

    # Shuffle order slightly per user so it looks personalised
    r.shuffle(all_jobs)
    # Re-sort by match (stays realistic)
    all_jobs.sort(key=lambda j: j["match"], reverse=True)

    # Simulate auto-apply keywords extracted from github
    extracted_keywords = r.sample(
        ["Python", "React", "FastAPI", "Git", "REST APIs", "Node.js", "Docker", "SQL"],
        k=4
    )

    return {
        "source": "mock",
        "extracted_keywords": extracted_keywords,
        "total_matches": len(all_jobs),
        "listings": all_jobs,
        "auto_apply_ready": True,
        "note": "Auto-apply extracts skill keywords from your GitHub profile and fills application forms automatically.",
    }


@app.get("/mock/full/{username}")
def mock_full_profile(username: str):
    """
    One call returns BOTH LinkedIn + Unstop mock data combined.
    Use this in the frontend for the demo — single fast request.
    """
    linkedin = mock_linkedin(username)
    unstop   = mock_unstop(username)

    # Merge confidence score boost from LinkedIn hackathons into skills
    confidence_boost = linkedin.get("confidence_boost", 0)

    return {
        "username": username,
        "linkedin": linkedin,
        "unstop": unstop,
        "confidence_boost_from_linkedin": confidence_boost,
        "message": "Mock data for demo — LinkedIn & Unstop APIs pending approval",
    }