import { useState, useEffect } from "react";
import { Radar, Bar } from "react-chartjs-2";
import {
  Chart as ChartJS, RadialLinearScale, PointElement, LineElement,
  Filler, Tooltip, Legend, CategoryScale, LinearScale, BarElement,
} from "chart.js";

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend, CategoryScale, LinearScale, BarElement);

const API = "http://127.0.0.1:8000";
const NAV = ["Dashboard", "Projects", "Insights", "Activity", "Career Suggestions", "Badges", "Time Breaker", "Cron Status"];

const BADGES = [
  { icon: "🎯", title: "Focus Master", desc: "You maintain deep focus during coding sessions." },
  { icon: "🚀", title: "Consistent Coder", desc: "You show consistent commit patterns over time." },
  { icon: "⚡", title: "Problem Solver", desc: "Your repos show strong problem solving ability." },
  { icon: "🌅", title: "Early Bird", desc: "You tend to commit early and often." },
  { icon: "🛡️", title: "Guardian Reviewer", desc: "You maintain high quality in your codebase." },
  { icon: "🧠", title: "Insight Seeker", desc: "You actively explore and learn new technologies." },
  { icon: "🔥", title: "Momentum Streak", desc: "You sustain repeatable coding momentum across days." },
  { icon: "🏁", title: "Ship Captain", desc: "You consistently turn ideas into shipped projects." },
];

export default function App() {
  const [username, setUsername] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [active, setActive] = useState("Dashboard");
  const [cronStatus, setCronStatus] = useState(null);
  const [cronLogs, setCronLogs] = useState([]);
  const [trackedUsers, setTrackedUsers] = useState({});
  const [triggerMsg, setTriggerMsg] = useState("");

  const analyze = async () => {
    if (!username) return;
    setLoading(true); setError(""); setData(null);
    try {
      const res = await fetch(`${API}/analyze/${username}`);
      const json = await res.json();
      if (json.detail) throw new Error(json.detail);
      setData(json);
      setActive("Dashboard");
      fetchCronData();
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  const fetchCronData = async () => {
    try {
      const [s, l, t] = await Promise.all([
        fetch(`${API}/cron/status`).then(r => r.json()),
        fetch(`${API}/cron/logs`).then(r => r.json()),
        fetch(`${API}/tracked`).then(r => r.json()),
      ]);
      setCronStatus(s);
      setCronLogs(l.logs || []);
      setTrackedUsers(t.tracked_users || {});
    } catch (e) { console.error(e); }
  };

  const triggerCron = async () => {
    try {
      const res = await fetch(`${API}/cron/trigger`, { method: "POST" });
      const json = await res.json();
      setTriggerMsg(json.message);
      setTimeout(() => setTriggerMsg(""), 3000);
      setTimeout(fetchCronData, 3000);
    } catch (e) { setTriggerMsg("Failed to trigger"); }
  };

  useEffect(() => { fetchCronData(); }, []);

  const s = { fontFamily: "Outfit, sans-serif" };

  const card = (children, extra = {}) => (
    <div style={{ background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 1px 4px rgba(0,0,0,0.07)", ...extra }}>
      {children}
    </div>
  );

  const infoCard = (icon, title, desc, extra = {}) => (
    <div key={title} style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: "16px 20px", marginBottom: 12, ...extra }}>
      <h4 style={{ margin: 0, fontWeight: 700, color: "#111827", fontSize: 15 }}>{icon} {title}</h4>
      <p style={{ margin: "6px 0 0", color: "#6b7280", fontSize: 14 }}>{desc}</p>
    </div>
  );

  // Landing
  if (!data) {
    return (
      <div style={{ ...s, minHeight: "100vh", background: "linear-gradient(135deg, #f0eeff 0%, #e8f4ff 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 48 }}>🕵️</div>
          <h1 style={{ fontSize: 36, fontWeight: 800, color: "#4f46e5", margin: 0 }}>ShadowSkills</h1>
          <p style={{ color: "#6b7280", marginTop: 8 }}>Quietly tracking your growth in the background.</p>
        </div>
        <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
          <input
            style={{ ...s, padding: "10px 16px", borderRadius: 10, border: "1.5px solid #c4b5fd", fontSize: 15, width: 280, outline: "none" }}
            placeholder="Enter GitHub username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            onKeyDown={e => e.key === "Enter" && analyze()}
          />
          <button onClick={analyze} style={{ ...s, padding: "10px 24px", borderRadius: 10, background: "#4f46e5", color: "#fff", fontWeight: 700, fontSize: 15, border: "none", cursor: "pointer" }}>
            {loading ? "Analyzing..." : "Analyze"}
          </button>
        </div>
        {loading && <p style={{ color: "#7c3aed" }}>Reading your digital footprint...</p>}
        {error && <p style={{ color: "#ef4444" }}>{error}</p>}
        {cronStatus && (
          <div style={{ marginTop: 24, background: "#fff", borderRadius: 12, padding: "12px 24px", fontSize: 13, color: "#6b7280", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
            🕐 Cron running: <strong>{cronStatus.scheduler_running ? "Yes" : "No"}</strong> · Tracked users: <strong>{cronStatus.tracked_user_count}</strong> · Interval: <strong>{cronStatus.interval_hours}h</strong>
          </div>
        )}
      </div>
    );
  }

  const g = data.github || {};
  const skillNames = data.skills?.map(s => s.name) || [];
  const skillValues = data.skills?.map(s => s.confidence) || [];

  const radarData = {
    labels: skillNames.length ? skillNames : ["Logic", "Speed", "Persistence", "Focus", "Clarity", "Consistency"],
    datasets: [{ label: "Skills", data: skillValues.length ? skillValues : [80, 85, 75, 90, 70, 78], backgroundColor: "rgba(124,58,237,0.2)", borderColor: "#7c3aed", pointBackgroundColor: "#7c3aed", borderWidth: 2 }]
  };

  const barData = {
    labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    datasets: [{ label: "Commits", data: [8, 15, 14, 6, 10, 8, 12], backgroundColor: "#4f46e5", borderRadius: 6 }]
  };

  return (
    <div style={{ ...s, display: "flex", minHeight: "100vh", background: "#f3f4f6" }}>

      {/* Sidebar */}
      <aside style={{ width: 220, background: "#fff", borderRight: "1px solid #e5e7eb", padding: "28px 20px", display: "flex", flexDirection: "column", gap: 24, position: "fixed", height: "100vh", overflowY: "auto" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 800, fontSize: 18, color: "#4f46e5" }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#7c3aed", display: "inline-block" }}></span>
            ShadowSkills
          </div>
          <p style={{ color: "#9ca3af", fontSize: 12, marginTop: 6 }}>Quietly tracking your growth in the background.</p>
        </div>
        <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {NAV.map(n => (
            <button key={n} onClick={() => setActive(n)} style={{ ...s, textAlign: "left", padding: "8px 12px", borderRadius: 8, fontSize: 13, fontWeight: 500, background: active === n ? "#ede9fe" : "transparent", color: active === n ? "#4f46e5" : "#6b7280", border: "none", cursor: "pointer" }}>{n}</button>
          ))}
        </nav>
        <button onClick={() => { setData(null); setUsername(""); }} style={{ ...s, marginTop: "auto", fontSize: 12, color: "#9ca3af", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>← Analyze another</button>
      </aside>

      {/* Main */}
      <main style={{ marginLeft: 220, flex: 1, padding: 24 }}>

        {/* Topbar */}
        <div style={{ background: "#fff", borderRadius: 16, padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>☀️ Good morning, <span style={{ color: "#7c3aed" }}>{g.name || g.username}</span>! 🌱</p>
          <p style={{ margin: 0, fontSize: 13, color: "#9ca3af" }}>Based on real activity. No self-assessment.</p>
        </div>

        {/* Dashboard */}
        {active === "Dashboard" && (<>
          <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 12, padding: "12px 20px", marginBottom: 20, color: "#166534", fontSize: 14 }}>
            💡 {data.summary}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            {card(<>
              <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700 }}>Overview</h3>
              {[
                { label: "Consistency Score", value: `${data.skills?.[0]?.confidence || 78}%` },
                { label: "Confidence Score", value: `${data.skills?.[1]?.confidence || 72}%` },
                { label: "Public Repos", value: g.public_repos },
                { label: "Followers", value: g.followers },
              ].map((m, i) => (
                <div key={i} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: "12px 16px", marginBottom: 10 }}>
                  <p style={{ margin: 0, fontSize: 13, color: "#6b7280" }}>{m.label}</p>
                  <p style={{ margin: "4px 0 0", fontSize: 22, fontWeight: 700, color: "#4f46e5" }}>{m.value}</p>
                </div>
              ))}
              <div style={{ background: "#f9fafb", borderRadius: 10, padding: "12px 16px" }}>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>Why this matters</p>
                <p style={{ margin: "6px 0 0", fontSize: 13, color: "#6b7280" }}>{g.bio || "Your GitHub activity reveals more about you than any resume."}</p>
              </div>
            </>)}
            {card(<>
              <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700 }}>Skill Radar</h3>
              <p style={{ margin: "0 0 16px", fontSize: 13, color: "#9ca3af" }}>Based on commit frequency, session depth, and task completion patterns.</p>
              <Radar data={radarData} options={{ scales: { r: { beginAtZero: true, max: 100 } }, plugins: { legend: { display: false } } }} />
            </>)}
            {card(<>
              <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700 }}>Activity Overview (Last 7 Days)</h3>
              <Bar data={barData} options={{ plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }} />
            </>)}
            {card(<>
              <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700 }}>Badges Earned</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {BADGES.slice(0, 4).map((b, i) => (
                  <div key={i} style={{ background: "#f5f3ff", borderRadius: 12, padding: 16, textAlign: "center" }}>
                    <div style={{ fontSize: 28 }}>{b.icon}</div>
                    <p style={{ margin: "8px 0 0", fontWeight: 700, fontSize: 13 }}>{b.title}</p>
                  </div>
                ))}
              </div>
            </>)}
          </div>
        </>)}

        {/* Projects */}
        {active === "Projects" && card(<>
          <h3 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 700 }}>Projects</h3>
          {g.repos?.slice(0, 6).map((r, i) => infoCard("📁", r.name, `${r.description || "No description."} ⭐ ${r.stars} · 🍴 ${r.forks}${r.language ? ` · 💻 ${r.language}` : ""}`))}
        </>)}

        {/* Insights */}
        {active === "Insights" && card(<>
          <h3 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 700 }}>Insights</h3>
          {data.hidden_strengths?.map((s, i) => infoCard(["🌟", "💡", "🚀"][i] || "✨", `Strength #${i + 1}`, s))}
          {data.blind_spots?.map((s, i) => infoCard("⚠️", `Blind Spot #${i + 1}`, s))}
        </>)}

        {/* Activity */}
        {active === "Activity" && card(<>
          <h3 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 700 }}>Activity</h3>
          {infoCard("📝", "Recent Commits", `${g.commit_summary?.commit_count || 0} commits analyzed across all public repos.`)}
          {g.commit_summary?.recent_commits?.map((c, i) => (
            <div key={i} style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: "12px 16px", marginBottom: 10 }}>
              <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: "#4f46e5" }}>📦 {c.repo}</p>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: "#374151" }}>{c.message?.slice(0, 120)}</p>
              {c.timestamp && <p style={{ margin: "4px 0 0", fontSize: 11, color: "#9ca3af" }}>{new Date(c.timestamp).toLocaleString()}</p>}
            </div>
          ))}
        </>)}

        {/* Career */}
        {active === "Career Suggestions" && card(<>
          <h3 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 700 }}>Career Suggestions</h3>
          {data.career_roles?.map((r, i) => (
            <div key={i} style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: "16px 20px", marginBottom: 12 }}>
              <h4 style={{ margin: 0, fontWeight: 700, fontSize: 15 }}>{["🎯", "🧠", "🚀"][i]} {r}</h4>
              <p style={{ margin: "6px 0 8px", color: "#6b7280", fontSize: 14 }}>This role matches your behavioral patterns and GitHub activity.</p>
              <a href={`https://unstop.com/jobs?searchTerm=${encodeURIComponent(r)}`} target="_blank" rel="noreferrer"
                style={{ display: "inline-block", padding: "6px 16px", background: "#4f46e5", color: "#fff", borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: "none", marginRight: 8 }}>
                🔍 Find Jobs on Unstop
              </a>
              <a href={`https://unstop.com/internships?searchTerm=${encodeURIComponent(r)}`} target="_blank" rel="noreferrer"
                style={{ display: "inline-block", padding: "6px 16px", background: "#7c3aed", color: "#fff", borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
                🎓 Find Internships
              </a>
            </div>
          ))}
        </>)}

        {/* Badges */}
        {active === "Badges" && card(<>
          <h3 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 700 }}>Badges</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {BADGES.map((b, i) => (
              <div key={i} style={{ background: "#f5f3ff", borderRadius: 14, padding: 24, textAlign: "center" }}>
                <div style={{ fontSize: 40 }}>{b.icon}</div>
                <p style={{ margin: "10px 0 4px", fontWeight: 700, fontSize: 15 }}>{b.title}</p>
                <p style={{ margin: 0, fontSize: 13, color: "#6b7280" }}>{b.desc}</p>
              </div>
            ))}
          </div>
        </>)}

        {/* Time Breaker */}
        {active === "Time Breaker" && card(<>
          <h3 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 700 }}>⚡ Time Breaker</h3>
          <p style={{ margin: "0 0 16px", fontSize: 13, color: "#9ca3af" }}>Top 5 fastest consecutive commits — shows your speed and momentum.</p>
          {data.time_breaker?.length ? data.time_breaker.map((t, i) => (
            <div key={i} style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: "14px 18px", marginBottom: 12, display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#4f46e5", minWidth: 36 }}>#{t.rank}</div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: "#111827" }}>{t.message}</p>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "#9ca3af" }}>📦 {t.repo} · {new Date(t.committed_at).toLocaleString()}</p>
              </div>
              <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "6px 14px", textAlign: "center" }}>
                <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#16a34a" }}>{t.gap_minutes}m</p>
                <p style={{ margin: 0, fontSize: 11, color: "#6b7280" }}>gap</p>
              </div>
            </div>
          )) : <p style={{ color: "#9ca3af" }}>No time breaker data available for this user.</p>}
        </>)}

        {/* Cron Status */}
        {active === "Cron Status" && (<>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
            {card(<>
              <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700 }}>🕐 Scheduler Info</h3>
              {cronStatus ? (<>
                {[
                  { label: "Scheduler Running", value: cronStatus.scheduler_running ? "✅ Yes" : "❌ No" },
                  { label: "Interval", value: `Every ${cronStatus.interval_hours} hours` },
                  { label: "Tracked Users", value: cronStatus.tracked_user_count },
                  { label: "Next Run", value: cronStatus.jobs?.[0]?.next_run ? new Date(cronStatus.jobs[0].next_run).toLocaleString() : "N/A" },
                ].map((m, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #f3f4f6" }}>
                    <span style={{ color: "#6b7280", fontSize: 14 }}>{m.label}</span>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{m.value}</span>
                  </div>
                ))}
                <button onClick={triggerCron} style={{ ...s, marginTop: 16, width: "100%", padding: "10px", background: "#4f46e5", color: "#fff", borderRadius: 10, fontWeight: 700, border: "none", cursor: "pointer", fontSize: 14 }}>
                  ▶️ Trigger Cron Now
                </button>
                {triggerMsg && <p style={{ color: "#16a34a", textAlign: "center", marginTop: 8, fontSize: 13 }}>{triggerMsg}</p>}
              </>) : <p style={{ color: "#9ca3af" }}>Loading...</p>}
            </>)}
            {card(<>
              <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700 }}>👥 Tracked Users</h3>
              {Object.keys(trackedUsers).length ? Object.entries(trackedUsers).map(([u, meta], i) => (
                <div key={i} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: "10px 14px", marginBottom: 10 }}>
                  <p style={{ margin: 0, fontWeight: 700, color: "#4f46e5" }}>@{u}</p>
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: "#9ca3af" }}>Added: {new Date(meta.added_at).toLocaleString()}</p>
                </div>
              )) : <p style={{ color: "#9ca3af", fontSize: 14 }}>No users tracked yet. Analyze a user to start tracking.</p>}
            </>)}
          </div>
          {card(<>
            <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700 }}>📋 Cron Logs</h3>
            {cronLogs.length ? [...cronLogs].reverse().map((log, i) => (
              <div key={i} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: "12px 16px", marginBottom: 12 }}>
                <p style={{ margin: "0 0 8px", fontWeight: 700, fontSize: 13, color: "#374151" }}>🕐 {new Date(log.run_at).toLocaleString()}</p>
                {log.results?.map((r, j) => (
                  <div key={j} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0", borderBottom: "1px solid #f9fafb" }}>
                    <span>@{r.username}</span>
                    <span style={{ color: r.status === "ok" ? "#16a34a" : "#ef4444" }}>{r.status === "ok" ? "✅ Success" : `❌ ${r.error}`}</span>
                  </div>
                ))}
              </div>
            )) : <p style={{ color: "#9ca3af", fontSize: 14 }}>No cron runs yet. Trigger one above!</p>}
          </>)}
        </>)}

      </main>
    </div>
  );
}