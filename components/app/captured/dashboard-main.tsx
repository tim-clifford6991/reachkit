/**
 * DashboardMain — the captured app "dashboard" tab content (gauge card +
 * next-action + score-history chart + this-week's-queue), converted 1:1 from
 * the Phase-0 capture and wired to live dashboard data. Score-history SVG is
 * generated from the real history points + verified-fix markers using the
 * capture's exact geometry.
 */

const SG = "Space Grotesk", JM = "JetBrains Mono";

function bandViz(s: number) {
  if (s < 30) return { label: "Invisible", fg: "#E5484D", bg: "#FDECEC" };
  if (s < 50) return { label: "Hard to find", fg: "#E0731C", bg: "#FFF0E6" };
  if (s < 70) return { label: "Fair — room to climb", fg: "#C98A12", bg: "#FFF4E0" };
  if (s < 85) return { label: "Findable", fg: "#1F9D5B", bg: "#EAF7EF" };
  return { label: "Highly discoverable", fg: "#0E7A48", bg: "#E0F3E8" };
}
function pillarColor(v: number) {
  if (v < 30) return "#E5484D";
  if (v < 50) return "#E0731C";
  if (v < 70) return "#C98A12";
  return "#1F9D5B";
}
// gauge arc (center 110, r 96, 280° from 40°)
function gpt(deg: number) { const r = (deg * Math.PI) / 180; return [110 + 96 * Math.cos(r), 110 + 96 * Math.sin(r)] as const; }
function garc(from: number, to: number) { const [x1, y1] = gpt(from); const [x2, y2] = gpt(to); const large = to - from > 180 ? 1 : 0; return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A 96 96 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`; }

export interface QueueItem { rank: number; title: string; effort: string; pillar: string; pred: number }
export interface HistoryPoint { label: string; score: number }
export interface Marker { index: number; label: string }

export interface DashboardMainProps {
  score: number;
  delta: number | null;
  pillars: { label: string; value: number }[];
  nextAction: { title: string; meta: string } | null;
  history: HistoryPoint[];
  markers: Marker[];
  queue: QueueItem[];
}

const TILE = ["#FFF4E0", "#EAF7EF", "#EAF1FF", "#F2EEFF"];
const TILE_FG = ["#C98A12", "#1F9D5B", "#3B6FE0", "#6E56F7"];

function yFor(s: number) { return Math.max(14, Math.min(148, 215 - 2.68 * s)); }

function ScoreHistory({ history, markers, current }: { history: HistoryPoint[]; markers: Marker[]; current: number }) {
  if (history.length < 2) {
    return <div style={{ height: 120, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "#9A97A5" }}>Your score history starts building with weekly scans.</div>;
  }
  const n = history.length;
  const x = (i: number) => 30 + (516 * i) / (n - 1);
  const pts = history.map((h, i) => [x(i), yFor(h.score)] as const);
  const line = pts.map(([px, py], i) => `${i === 0 ? "M" : "L"} ${px.toFixed(1)} ${py.toFixed(1)}`).join(" ");
  const area = `${line} L ${pts[pts.length - 1]![0].toFixed(1)} 148 L 30 148 Z`;
  return (
    <svg viewBox="0 0 560 170" width="100%" style={{ display: "block", overflow: "visible" }}>
      <defs><linearGradient id="rkh" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6E56F7" stopOpacity="0.16" /><stop offset="100%" stopColor="#6E56F7" stopOpacity="0" /></linearGradient></defs>
      <rect x="30" y="81" width="516" height="53.6" fill="#FDF0E9" />
      <rect x="30" y="27.4" width="516" height="53.6" fill="#FFFBEF" />
      <rect x="30" y="14" width="516" height="13.4" fill="#F0FAF3" />
      {[30, 50, 70].map((g) => (
        <g key={g}>
          <line x1="30" x2="546" y1={yFor(g)} y2={yFor(g)} stroke="#EAE7F2" strokeWidth="1" strokeDasharray="3 3" />
          <text x="4" y={yFor(g) + 3} style={{ font: `500 9px ${JM}, monospace`, fill: "#B8B5C4" }}>{g}</text>
        </g>
      ))}
      <path d={area} fill="url(#rkh)" />
      <path d={line} fill="none" stroke="#6E56F7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {markers.map((m, k) => {
        const px = x(m.index); const py = yFor(history[m.index]?.score ?? current);
        return (
          <g key={k}>
            <line x1={px} x2={px} y1={py} y2="18" stroke="#C7BCF5" strokeWidth="1" strokeDasharray="2 2" />
            <circle cx={px} cy={py} r="4" fill="#fff" stroke="#1F9D5B" strokeWidth="2" />
            <text x={px} y="14" textAnchor="middle" style={{ font: `600 9px Plus Jakarta Sans, sans-serif`, fill: "#1F9D5B" }}>✓ {m.label}</text>
          </g>
        );
      })}
      {pts.map(([px, py], i) => <circle key={i} cx={px} cy={py} r="2.6" fill="#fff" stroke="#6E56F7" strokeWidth="1.5" />)}
      <circle cx={pts[n - 1]![0]} cy={pts[n - 1]![1]} r="5.5" fill="#6E56F7" stroke="#fff" strokeWidth="2.5" />
      <text x={pts[n - 1]![0]} y={pts[n - 1]![1] - 13} textAnchor="middle" style={{ font: `700 13px ${JM}, monospace`, fill: "#6E56F7" }}>{current}</text>
      {history.map((h, i) => <text key={i} x={x(i)} y="165" textAnchor="middle" style={{ font: `500 10px Plus Jakarta Sans, sans-serif`, fill: "#A8A6B2" }}>{h.label}</text>)}
    </svg>
  );
}

export function DashboardMain(p: DashboardMainProps) {
  const band = bandViz(p.score);
  const frac = Math.max(0, Math.min(1, p.score / 100));
  return (
    <div style={{ display: "grid", gridTemplateColumns: "330px 1fr", gap: 20 }}>
      {/* Score card */}
      <div style={{ background: "#fff", border: "1px solid #ECEAF3", borderRadius: 18, padding: 24, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", boxShadow: "rgba(20,19,26,0.03) 0px 1px 2px" }}>
        <svg width="220" height="220" viewBox="0 0 220 220" style={{ display: "block", ["viewTransitionName" as string]: "score-circle" }}>
          <path d={garc(40, 320)} fill="none" stroke="#EEECF5" strokeWidth="20" strokeLinecap="round" />
          <path d={garc(40, 40 + 280 * frac)} fill="none" stroke={band.fg} strokeWidth="20" strokeLinecap="round" />
          <text x="110" y="120.08" textAnchor="middle" style={{ font: `700 56px ${JM}, monospace`, fill: "#14131A" }}>{p.score}</text>
          <text x="110" y="141.08" textAnchor="middle" style={{ font: `600 13px ${JM}, monospace`, fill: "#9A97A5", letterSpacing: 1 }}>/ 100</text>
        </svg>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 13, padding: "5px 13px", borderRadius: 8, marginTop: 8, fontFamily: SG, color: band.fg, background: band.bg }}>{band.label}</div>
        {p.delta !== null && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: p.delta >= 0 ? "#EAF7EF" : "#FDECEC", color: p.delta >= 0 ? "#1F9D5B" : "#E5484D", fontWeight: 700, fontSize: 12.5, padding: "5px 11px", borderRadius: 8, marginTop: 10, fontFamily: JM }}>{p.delta >= 0 ? "▲" : "▼"} {p.delta >= 0 ? "+" : ""}{p.delta} since last week</div>
        )}
        <div style={{ width: "100%", height: 1, background: "#F0EEF6", margin: "18px 0 0" }} />
        <div style={{ width: "100%", textAlign: "left", marginTop: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#9A97A5", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 12 }}>Pillars</div>
          {p.pillars.map((pil) => {
            const c = pillarColor(pil.value);
            return (
              <div key={pil.label} style={{ marginBottom: 13 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 600, marginBottom: 5 }}><span>{pil.label}</span><span style={{ fontFamily: JM, color: c }}>{pil.value}</span></div>
                <div style={{ height: 7, borderRadius: 4, background: "#F2F0F8", overflow: "hidden" }}><div style={{ width: `${pil.value}%`, height: "100%", background: c, borderRadius: 4 }} /></div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right column */}
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {p.nextAction && (
          <div style={{ background: "linear-gradient(120deg, #F4F0FF, #FAF8FF)", border: "1px solid #E7E0FB", borderRadius: 16, padding: "20px 22px", display: "flex", alignItems: "center", gap: 18 }}>
            <div style={{ flex: "1 1 0%" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#6E56F7", textTransform: "uppercase", letterSpacing: "0.04em" }}>Your next action</div>
              <div style={{ fontWeight: 700, fontSize: 17, fontFamily: SG, marginTop: 4 }}>{p.nextAction.title}</div>
              <div style={{ fontSize: 13, color: "#56535F", marginTop: 2 }}>{p.nextAction.meta}</div>
            </div>
            <button style={{ fontFamily: "Plus Jakarta Sans", fontWeight: 700, fontSize: 14, color: "#fff", background: "#6E56F7", border: "none", borderRadius: 10, padding: "11px 18px", cursor: "pointer", whiteSpace: "nowrap" }}>Start →</button>
          </div>
        )}
        <div style={{ background: "#fff", border: "1px solid #ECEAF3", borderRadius: 16, padding: "20px 22px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ fontWeight: 700, fontSize: 15, fontFamily: SG }}>Score history</div>
            <span style={{ fontSize: 11.5, fontWeight: 600, color: "#6E56F7", background: "#F2EEFF", padding: "4px 10px", borderRadius: 7 }}>markers = verified fixes</span>
          </div>
          <ScoreHistory history={p.history} markers={p.markers} current={p.score} />
        </div>
        <div style={{ background: "#fff", border: "1px solid #ECEAF3", borderRadius: 16, padding: "20px 22px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 15, fontFamily: SG }}>This week&apos;s queue</div>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#6E56F7", cursor: "pointer" }}>View all →</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {p.queue.map((q, i) => (
              <div key={q.rank} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 14px", border: "1px solid #F0EEF6", borderRadius: 11 }}>
                <span style={{ width: 24, height: 24, borderRadius: 7, background: TILE[i % 4], color: TILE_FG[i % 4], fontWeight: 700, fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: JM, flex: "0 0 auto" }}>{q.rank}</span>
                <div style={{ flex: "1 1 0%" }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{q.title}</div>
                  <div style={{ fontSize: 12.5, color: "#9A97A5" }}>{q.effort} · {q.pillar}</div>
                </div>
                <span style={{ fontFamily: JM, fontSize: 13, fontWeight: 700, color: "#1F9D5B", flex: "0 0 auto" }}>+{q.pred}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
