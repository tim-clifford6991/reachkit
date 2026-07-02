import * as React from "react";

/**
 * CompetitorEdgePanel — "You vs. top competitors": ranked horizontal score bars
 * with a highlighted YOU row and per-row pillar-health dots. The `edge` variant
 * renders the "their edge → your move" two-column callout instead.
 */
export interface CompetitorEdgePanelProps {
  rows: { name: string; score: number; isYou?: boolean; scoreColor?: string; dots?: string[] }[];
  title?: string;
  variant?: "bars" | "edge";
  edge?: { name: string; edge: string; move: string };
}

export function CompetitorEdgePanel({ rows, title = "You vs. top competitors", variant = "bars", edge }: CompetitorEdgePanelProps) {
  const wrap: React.CSSProperties = { fontFamily: "var(--font-sans)", color: "var(--c-ink)" };
  if (variant === "edge" && edge) {
    return (
      <div style={wrap}>
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, marginBottom: 10 }}>{edge.name}</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ background: "var(--c-tint-orange)", border: "1px solid var(--c-tint-orange-line)", borderRadius: "var(--radius-lg)", padding: 14 }}>
            <div style={{ fontSize: 11, color: "var(--c-faint)", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 6 }}>Their edge</div>
            <div style={{ fontSize: 14 }}>{edge.edge}</div>
          </div>
          <div style={{ background: "var(--c-tint-violet)", border: "1px solid var(--c-tint-violet-line)", borderRadius: "var(--radius-lg)", padding: 14 }}>
            <div style={{ fontSize: 11, color: "var(--c-faint)", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 6 }}>Your move</div>
            <div style={{ fontSize: 14 }}>{edge.move}</div>
          </div>
        </div>
      </div>
    );
  }
  const max = Math.max(...rows.map(r => r.score), 100);
  return (
    <div style={wrap}>
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, marginBottom: 12 }}>{title}</div>
      {rows.map((r, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 8px", borderRadius: "var(--radius-md)", background: r.isYou ? "var(--c-soft)" : "transparent" }}>
          <span style={{ width: 96, fontSize: 13, fontWeight: r.isYou ? 700 : 500, color: r.isYou ? "var(--c-action)" : "var(--c-ink)" }}>{r.isYou ? "YOU" : r.name}</span>
          <span style={{ flex: 1, height: 8, background: "var(--c-fill)", borderRadius: 99, overflow: "hidden" }}>
            <span style={{ display: "block", height: "100%", width: `${(r.score / max) * 100}%`, background: r.scoreColor || "var(--c-action)" }} />
          </span>
          {r.dots?.map((d, j) => <span key={j} style={{ width: 7, height: 7, borderRadius: 99, background: d }} />)}
          <span style={{ width: 28, textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 13 }}>{r.score}</span>
        </div>
      ))}
    </div>
  );
}
