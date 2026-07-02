import * as React from "react";

/**
 * ProgressChart — "Discoverability over time": a tokenised score line/area over
 * weeks with fix-ship dots at score milestones and an optional events list
 * ("what changed"). x is a 0–1 fraction of width; y is a 0–100 score.
 */
export interface ProgressChartProps {
  points: { x: number; y: number }[];
  markers?: { wk: string; score: number; x: number; y: number }[];
  events?: { wk: string; date: string; text: string }[];
  width?: number;
  height?: number;
}

export function ProgressChart({ points, markers = [], events = [], width = 460, height = 160 }: ProgressChartProps) {
  const px = (x: number) => x * width;
  const py = (y: number) => height - (y / 100) * height;
  const line = points.map((p, i) => `${i ? "L" : "M"}${px(p.x).toFixed(1)},${py(p.y).toFixed(1)}`).join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;
  return (
    <div style={{ fontFamily: "var(--font-sans)", color: "var(--c-ink)" }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <path d={area} fill="var(--c-soft)" />
        <path d={line} fill="none" stroke="var(--c-action)" strokeWidth={2.5} />
        {markers.map((m, i) => (
          <g key={i}>
            <circle cx={px(m.x)} cy={py(m.score)} r={4} fill="var(--c-action)" stroke="var(--c-bg)" strokeWidth={2} />
          </g>
        ))}
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--c-faint)", marginTop: 4 }}>
        {markers.map((m, i) => <span key={i} style={{ fontFamily: "var(--font-mono)" }}>{m.wk} · {m.score}</span>)}
      </div>
      {events.length > 0 && (
        <div style={{ marginTop: 12, borderTop: "1px solid var(--c-line)", paddingTop: 10 }}>
          {events.map((e, i) => (
            <div key={i} style={{ display: "flex", gap: 10, fontSize: 13, padding: "3px 0" }}>
              <span style={{ color: "var(--c-faint)", fontFamily: "var(--font-mono)", minWidth: 56 }}>{e.wk}</span>
              <span style={{ color: "var(--c-muted)" }}>{e.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
