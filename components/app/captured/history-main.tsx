/**
 * HistoryMain — the captured app "History" tab (score-over-time chart + scan
 * timeline + predicted-vs-actual), converted 1:1 and wired to live engagement
 * data. Chart geometry calibrated to the 760×230 capture.
 */

const SG = "Space Grotesk", JM = "JetBrains Mono";

function yFor(s: number) { return Math.max(14, Math.min(208, 188.6 - 3.88 * (s - 30))); }

export interface HistoryPoint { label: string; score: number }
export interface Marker { index: number; label: string }
export interface TimelineRow { when: string; score: number; delta: number | null; note: string }
export interface AccuracyRow { label: string; pred: number; actual: number }

export interface HistoryMainProps {
  history: HistoryPoint[];
  markers: Marker[];
  timeline: TimelineRow[];
  accuracy: AccuracyRow[];
  modelAccuracy: number | null;
}

function Chart({ history, markers, current }: { history: HistoryPoint[]; markers: Marker[]; current: number }) {
  if (history.length < 2) {
    return <div style={{ height: 180, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "#9A97A5" }}>Your score history builds with each weekly scan.</div>;
  }
  const n = history.length;
  const x = (i: number) => 30 + (716 * i) / (n - 1);
  const pts = history.map((h, i) => [x(i), yFor(h.score)] as const);
  const line = pts.map(([px, py], i) => `${i === 0 ? "M" : "L"} ${px.toFixed(1)} ${py.toFixed(1)}`).join(" ");
  const area = `${line} L ${pts[n - 1]![0].toFixed(1)} 208 L 30 208 Z`;
  return (
    <svg viewBox="0 0 760 230" width="100%" style={{ display: "block", overflow: "visible" }}>
      <defs><linearGradient id="rkh2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6E56F7" stopOpacity="0.16" /><stop offset="100%" stopColor="#6E56F7" stopOpacity="0" /></linearGradient></defs>
      <rect x="30" y="111" width="716" height="77.6" fill="#FDF0E9" />
      <rect x="30" y="33.4" width="716" height="77.6" fill="#FFFBEF" />
      <rect x="30" y="14" width="716" height="19.4" fill="#F0FAF3" />
      {[30, 50, 70].map((g) => (
        <g key={g}>
          <line x1="30" x2="746" y1={yFor(g)} y2={yFor(g)} stroke="#EAE7F2" strokeWidth="1" strokeDasharray="3 3" />
          <text x="4" y={yFor(g) + 3} style={{ font: `500 9px ${JM}, monospace`, fill: "#B8B5C4" }}>{g}</text>
        </g>
      ))}
      <path d={area} fill="url(#rkh2)" />
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
      {history.map((h, i) => <text key={i} x={x(i)} y="225" textAnchor="middle" style={{ font: `500 10px Plus Jakarta Sans, sans-serif`, fill: "#A8A6B2" }}>{h.label}</text>)}
    </svg>
  );
}

export function HistoryMain(p: HistoryMainProps) {
  const current = p.history[p.history.length - 1]?.score ?? 0;
  const maxPred = Math.max(1, ...p.accuracy.map((a) => Math.max(a.pred, a.actual)));
  return (
    <div>
      <div style={{ background: "#fff", border: "1px solid #ECEAF3", borderRadius: 16, padding: "22px 24px", marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 16, fontFamily: SG }}>Score over time</div>
          <span style={{ fontSize: 11.5, fontWeight: 600, color: "#6E56F7", background: "#F2EEFF", padding: "4px 10px", borderRadius: 7 }}>{p.history.length} weekly scan{p.history.length === 1 ? "" : "s"}</span>
        </div>
        <Chart history={p.history} markers={p.markers} current={current} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 20 }}>
        {/* Scan timeline */}
        <div style={{ background: "#fff", border: "1px solid #ECEAF3", borderRadius: 16, padding: "20px 22px" }}>
          <div style={{ fontWeight: 700, fontSize: 15, fontFamily: SG, marginBottom: 14 }}>Scan timeline</div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {p.timeline.map((r, i) => {
              const last = i === p.timeline.length - 1;
              const dotColor = i === 0 ? "#6E56F7" : last ? "#D9D6E4" : "#C7BCF5";
              const dColor = r.delta === null ? "#9A97A5" : r.delta >= 0 ? "#1F9D5B" : "#E5484D";
              return (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 14, paddingBottom: 16 }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: "0 0 auto" }}>
                    <span style={{ width: 11, height: 11, borderRadius: "50%", background: dotColor, border: "2px solid #fff", boxShadow: `${dotColor} 0px 0px 0px 1px` }} />
                    {!last && <span style={{ width: 2, flex: "1 1 0%", background: "#F0EEF6", minHeight: 22 }} />}
                  </div>
                  <div style={{ flex: "1 1 0%", paddingBottom: 4 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{r.when}</span>
                      <span style={{ fontFamily: JM, fontSize: 13, fontWeight: 700 }}>{r.score} <span style={{ color: dColor }}>{r.delta === null ? "baseline" : `${r.delta >= 0 ? "▲ +" : "▼ −"}${Math.abs(r.delta)}`}</span></span>
                    </div>
                    <div style={{ fontSize: 12.5, color: "#9A97A5", marginTop: 2 }}>{r.note}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        {/* Predicted vs actual */}
        <div style={{ background: "#fff", border: "1px solid #ECEAF3", borderRadius: 16, padding: "20px 22px" }}>
          <div style={{ fontWeight: 700, fontSize: 15, fontFamily: SG, marginBottom: 4 }}>Predicted vs. actual</div>
          <div style={{ fontSize: 12.5, color: "#9A97A5", marginBottom: 14 }}>How accurate our impact estimates have been.</div>
          {p.accuracy.length === 0 ? (
            <div style={{ fontSize: 13, color: "#9A97A5", padding: "12px 0" }}>Accuracy builds as you verify shipped fixes.</div>
          ) : (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {p.accuracy.map((a, i) => (
                  <div key={i}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 5 }}>
                      <span style={{ fontWeight: 600 }}>{a.label}</span>
                      <span style={{ fontFamily: JM, color: "#56535F" }}>+{a.pred} → +{a.actual}</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 3, background: "#F2F0F8", overflow: "hidden" }}><div style={{ height: "100%", width: `${Math.round((a.actual / maxPred) * 100)}%`, background: "#1F9D5B", borderRadius: 3 }} /></div>
                  </div>
                ))}
              </div>
              {p.modelAccuracy !== null && (
                <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid #F0EEF6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 13, color: "#56535F", fontWeight: 500 }}>Model accuracy</span>
                  <span style={{ fontFamily: JM, fontWeight: 700, fontSize: 16, color: "#1F9D5B" }}>{p.modelAccuracy}%</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
