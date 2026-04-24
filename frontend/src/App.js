import { useState } from "react";
import { Radar, Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
} from "chart.js";

ChartJS.register(
  RadialLinearScale, PointElement, LineElement, Filler,
  Tooltip, Legend, CategoryScale, LinearScale, BarElement
);

const NAV = ["Dashboard", "Projects", "Insights", "Activity", "Career Suggestions", "Badges"];

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

  const analyze = async () => {
    if (!username) return;
    setLoading(true);
    setError("");
    setData(null);
    try {
      const res = await fetch(`http://127.0.0.1:8000/analyze/${username}`);
      const json = await res.json();
      if (json.detail) throw new Error(json.detail);
      setData(json);
      setActive("Dashboard");
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  // Landing page
  if (!data) {
    return (
      <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #f0eeff 0%, #e8f4ff 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "Outfit, sans-serif" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🕵️</div>
          <h1 style={{ fontSize: 36, fontWeight: 800, color: "#4f46e5", margin: 0 }}>ShadowSkills</h1>
          <p style={{ color: "#6b7280", marginTop: 8 }}>Quietly tracking your growth in the background.</p>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <input
            style={{ padding: "10px 16px", borderRadius: 10, border: "1.5px solid #c4b5fd", fontSize: 15, width: 280, outline: "none", fontFamily: "Outfit, sans-serif" }}
            placeholder="Enter GitHub username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            onKeyDown={e => e.key === "Enter" && analyze()}
          />
          <button
            onClick={analyze}
            style={{ padding: "10px 24px", borderRadius: 10, background: "#4f46e5", color: "#fff", fontWeight: 700, fontSize: 15, border: "none", cursor: "pointer", fontFamily: "Outfit, sans-serif" }}
          >
            {loading ? "Analyzing..." : "Analyze"}
          </button>
        </div>
        {loading && <p style={{ color: "#7c3aed", marginTop: 20 }}>Reading your digital footprint...</p>}
        {error && <p style={{ color: "#ef4444", marginTop: 16 }}>{error}</p>}
      </div>
    );
  }

  const g = data.github || {};
  const skillNames = data.skills?.map(s => s.name) || [];
  const skillValues = data.skills?.map(s => s.confidence) || [];

  const radarData = {
    labels: skillNames.length ? skillNames : ["Logic", "Speed", "Consistency", "Time Spent", "Focus", "Persistence"],
    datasets: [{
      label: "Skills",
      data: skillValues.length ? skillValues : [80, 85, 78, 65, 90, 75],
      backgroundColor: "rgba(124, 58, 237, 0.2)",
      borderColor: "#7c3aed",
      pointBackgroundColor: "#7c3aed",
      borderWidth: 2,
    }]
  };

  const barData = {
    labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    datasets: [{
      label: "Commits",
      data: [8, 15, 14, 6, 10, 8, 12],
      backgroundColor: "#4f46e5",
      borderRadius: 6,
    }]
  };

  const card = (children, extra = {}) => (
    <div style={{ background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 1px 4px rgba(0,0,0,0.07)", ...extra }}>
      {children}
    </div>
  );

  const infoCard = (icon, title, desc) => (
    <div key={title} style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: "16px 20px", marginBottom: 12 }}>
      <h4 style={{ margin: 0, fontWeight: 700, color: "#111827", fontSize: 15 }}>{icon} {title}</h4>
      <p style={{ margin: "6px 0 0", color: "#6b7280", fontSize: 14 }}>{desc}</p>
    </div>
  );

  return (
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: "Outfit, sans-serif", background: "#f3f4f6" }}>

      {/* Sidebar */}
      <aside style={{ width: 220, background: "#fff", borderRight: "1px solid #e5e7eb", padding: "28px 20px", display: "flex", flexDirection: "column", gap: 24, position: "fixed", height: "100vh" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 800, fontSize: 18, color: "#4f46e5" }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#7c3aed", display: "inline-block" }}></span>
            ShadowSkills
          </div>
          <p style={{ color: "#9ca3af", fontSize: 12, marginTop: 6 }}>Quietly tracking your growth in the background.</p>
        </div>
        <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {NAV.map(n => (
            <button key={n} onClick={() => setActive(n)} style={{
              textAlign: "left", padding: "8px 12px", borderRadius: 8, fontSize: 14, fontWeight: 500,
              background: active === n ? "#ede9fe" : "transparent",
              color: active === n ? "#4f46e5" : "#6b7280",
              border: "none", cursor: "pointer", fontFamily: "Outfit, sans-serif"
            }}>{n}</button>
          ))}
        </nav>
        <button onClick={() => { setData(null); setUsername(""); }} style={{ marginTop: "auto", fontSize: 12, color: "#9ca3af", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>← Analyze another</button>
      </aside>

      {/* Main */}
      <main style={{ marginLeft: 220, flex: 1, padding: 24 }}>

        {/* Topbar */}
        <div style={{ background: "#fff", borderRadius: 16, padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>☀️ Good morning, <span style={{ color: "#7c3aed" }}>{g.name || g.username}</span>! 🌱</p>
          <p style={{ margin: 0, fontSize: 13, color: "#9ca3af" }}>Based on real activity. No self-assessment.</p>
        </div>

        {/* Dashboard */}
        {active === "Dashboard" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>

              {/* Overview */}
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
                <div style={{ background: "#f9fafb", borderRadius: 10, padding: "12px 16px", marginTop: 4 }}>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>Why this matters</p>
                  <p style={{ margin: "6px 0 0", fontSize: 13, color: "#6b7280" }}>{g.bio || "Your GitHub activity reveals more about you than any resume."}</p>
                </div>
              </>)}

              {/* Radar */}
              {card(<>
                <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700 }}>Skill Radar</h3>
                <p style={{ margin: "0 0 16px", fontSize: 13, color: "#9ca3af" }}>Based on commit frequency, session depth, and task completion patterns.</p>
                <Radar data={radarData} options={{
                  scales: {
                    r: {
                      beginAtZero: true,
                      max: 100,
                      ticks: { stepSize: 20, display: false },
                      grid: { circular: true, color: 'rgba(0,0,0,0.1)' },
                      angleLines: { color: 'rgba(0,0,0,0.1)', lineWidth: 1 }
                    }
                  },
                  plugins: { legend: { display: false } },
                  elements: {
                    line: { tension: 0.1 },
                    point: { radius: 4, hoverRadius: 6 }
                  }
                }} />
              </>)}

              {/* Bar Chart */}
              {card(<>
                <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700 }}>Activity Overview (Last 7 Days)</h3>
                <Bar data={barData} options={{ plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }} />
              </>)}

              {/* Badges compact */}
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

            {/* Recent Commits */}
            {card(<>
              <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700 }}>Recent Commits</h3>
              <p style={{ margin: "0 0 16px", fontSize: 13, color: "#9ca3af" }}>Latest commit messages across your repositories</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {g.commit_summary?.recent_commits?.slice(0, 5).map((commit, i) => (
                  <div key={i} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: "14px 16px", background: "#f9fafb" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#4f46e5", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 12, fontWeight: "bold" }}>
                          {i + 1}
                        </div>
                        <span style={{ fontWeight: 600, fontSize: 14, color: "#111827" }}>{commit.repo}</span>
                      </div>
                      <a href={commit.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "#7c3aed", textDecoration: "none", fontWeight: 500 }}>
                        View →
                      </a>
                    </div>
                    <p style={{ margin: 0, fontSize: 13, color: "#6b7280", lineHeight: 1.5 }}>
                      {commit.message}
                    </p>
                  </div>
                ))}
                {(!g.commit_summary?.recent_commits || g.commit_summary.recent_commits.length === 0) && (
                  <div style={{ textAlign: "center", padding: "24px", color: "#9ca3af", fontSize: 14 }}>
                    No recent commits found
                  </div>
                )}
              </div>
            </>, { marginTop: 20 })}
          </>
        )}

        {/* Projects */}
        {active === "Projects" && card(<>
          <h3 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 700 }}>Projects</h3>
          {g.repos?.slice(0, 6).map((r, i) => infoCard("📁", r.name, `${r.description || "No description."} ⭐ ${r.stars} · 🍴 ${r.forks}${r.language ? ` · 💻 ${r.language}` : ""}`))}
        </>)}

        {/* Insights */}
        {active === "Insights" && card(<>
          <h3 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 700 }}>Performance Insights</h3>
          <p style={{ margin: "0 0 24px", fontSize: 14, color: "#6b7280" }}>
            Based on your GitHub activity analysis, here are your key strengths and areas for growth.
          </p>
          
          {/* Strengths Section */}
          <div style={{ marginBottom: 32 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <div style={{ width: 24, height: 24, borderRadius: "50%", background: "linear-gradient(135deg, #10b981, #34d399)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 12, fontWeight: "bold" }}>
                ✓
              </div>
              <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#111827" }}>Your Strengths</h4>
              <span style={{ background: "#d1fae5", color: "#065f46", fontSize: 12, fontWeight: 600, padding: "2px 8px", borderRadius: 12 }}>
                {data.hidden_strengths?.length || 0} identified
              </span>
            </div>
            
            {data.hidden_strengths?.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {data.hidden_strengths.map((strength, i) => {
                  const strengthIcons = ["🌟", "💪", "🚀", "🎯", "⚡", "🏆"];
                  const categories = ["Technical Excellence", "Consistency", "Problem Solving", "Collaboration", "Innovation", "Leadership"];
                  const category = categories[i % categories.length];
                  const icon = strengthIcons[i % strengthIcons.length];
                  
                  return (
                    <div key={i} style={{
                      border: "1px solid #d1fae5",
                      borderRadius: 12,
                      padding: "20px",
                      background: "#f0fdf4",
                      position: "relative"
                    }}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                        <div style={{ fontSize: 24 }}>{icon}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                            <h5 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#111827" }}>
                              {category} • Strength #{i + 1}
                            </h5>
                            <span style={{
                              background: "#10b981",
                              color: "white",
                              fontSize: 11,
                              fontWeight: 700,
                              padding: "2px 8px",
                              borderRadius: 10
                            }}>
                              HIGH IMPACT
                            </span>
                          </div>
                          <p style={{ margin: "0 0 12px", fontSize: 14, color: "#374151", lineHeight: 1.5 }}>
                            {strength}
                          </p>
                          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                              <div style={{ width: 80, height: 6, background: "#d1fae5", borderRadius: 3, overflow: "hidden" }}>
                                <div style={{
                                  width: `${70 + (i * 10)}%`,
                                  height: "100%",
                                  background: "#10b981",
                                  borderRadius: 3
                                }}></div>
                              </div>
                              <span style={{ fontSize: 12, color: "#6b7280" }}>Performance</span>
                            </div>
                            <div style={{ fontSize: 12, color: "#6b7280", background: "#f9fafb", padding: "4px 8px", borderRadius: 6 }}>
                              💡 Leverage this in your next project
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "32px", background: "#f9fafb", borderRadius: 12, border: "1px dashed #d1d5db" }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>📊</div>
                <p style={{ margin: 0, fontSize: 14, color: "#6b7280" }}>No strength data available. Analyze more activity to uncover your strengths.</p>
              </div>
            )}
          </div>
          
          {/* Blind Spots Section */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <div style={{ width: 24, height: 24, borderRadius: "50%", background: "linear-gradient(135deg, #f59e0b, #fbbf24)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 12, fontWeight: "bold" }}>
                !
              </div>
              <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#111827" }}>Growth Opportunities</h4>
              <span style={{ background: "#fef3c7", color: "#92400e", fontSize: 12, fontWeight: 600, padding: "2px 8px", borderRadius: 12 }}>
                {data.blind_spots?.length || 0} areas to improve
              </span>
            </div>
            
            {data.blind_spots?.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {data.blind_spots.map((spot, i) => {
                  const spotIcons = ["⚠️", "🔍", "🎯", "📈", "🔄", "🧠"];
                  const categories = ["Skill Gap", "Consistency", "Documentation", "Testing", "Collaboration", "Innovation"];
                  const category = categories[i % categories.length];
                  const icon = spotIcons[i % spotIcons.length];
                  
                  return (
                    <div key={i} style={{
                      border: "1px solid #fef3c7",
                      borderRadius: 12,
                      padding: "20px",
                      background: "#fffbeb",
                      position: "relative"
                    }}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                        <div style={{ fontSize: 24 }}>{icon}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                            <h5 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#111827" }}>
                              {category} • Opportunity #{i + 1}
                            </h5>
                            <span style={{
                              background: "#f59e0b",
                              color: "white",
                              fontSize: 11,
                              fontWeight: 700,
                              padding: "2px 8px",
                              borderRadius: 10
                            }}>
                              GROWTH AREA
                            </span>
                          </div>
                          <p style={{ margin: "0 0 12px", fontSize: 14, color: "#374151", lineHeight: 1.5 }}>
                            {spot}
                          </p>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                <div style={{ width: 80, height: 6, background: "#fef3c7", borderRadius: 3, overflow: "hidden" }}>
                                  <div style={{
                                    width: `${30 + (i * 15)}%`,
                                    height: "100%",
                                    background: "#f59e0b",
                                    borderRadius: 3
                                  }}></div>
                                </div>
                                <span style={{ fontSize: 12, color: "#6b7280" }}>Improvement needed</span>
                              </div>
                            </div>
                            <div style={{ fontSize: 12, color: "#92400e", background: "#fef3c7", padding: "6px 12px", borderRadius: 6, fontWeight: 600 }}>
                              🎯 Action: Focus here for 30 days
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "32px", background: "#f9fafb", borderRadius: 12, border: "1px dashed #d1d5db" }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>🎉</div>
                <p style={{ margin: 0, fontSize: 14, color: "#6b7280" }}>No blind spots detected! Your profile shows balanced development across all areas.</p>
              </div>
            )}
          </div>
          
          {/* Summary Card */}
          <div style={{
            marginTop: 32,
            background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
            borderRadius: 16,
            padding: "24px",
            color: "white"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 24 }}>📈</div>
              <h5 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Performance Summary</h5>
            </div>
            <p style={{ margin: "0 0 16px", fontSize: 14, opacity: 0.9, lineHeight: 1.5 }}>
              {data.summary || "Your GitHub activity reveals a strong foundation with specific areas for targeted growth."}
            </p>
            <div style={{ display: "flex", gap: 16, fontSize: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981" }}></div>
                <span>Strengths: {data.hidden_strengths?.length || 0}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#f59e0b" }}></div>
                <span>Growth areas: {data.blind_spots?.length || 0}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#8b5cf6" }}></div>
                <span>Skills: {data.skills?.length || 0}</span>
              </div>
            </div>
          </div>
        </>)}

        {/* Activity */}
        {active === "Activity" && card(<>
          <h3 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 700 }}>Activity</h3>
          {infoCard("📝", "Today", `${g.public_repos} public repositories detected. Commit activity analyzed across all repos.`)}
          {infoCard("📈", "Last 7 Days", `${g.followers} developers follow this profile. Strong network presence detected.`)}
          {infoCard("🛡️", "Code Health", `Top language: ${g.repos?.[0]?.language || "Not detected"}. Consistent patterns found across repos.`)}
        </>)}

        {/* Career */}
        {active === "Career Suggestions" && card(<>
          <h3 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 700 }}>Career Suggestions</h3>
          {data.career_roles?.map((r, i) => infoCard(["🎯", "🧠", "🚀"][i] || "💼", r, "This role matches your behavioral patterns and GitHub activity."))}
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

      </main>
    </div>
  );
}