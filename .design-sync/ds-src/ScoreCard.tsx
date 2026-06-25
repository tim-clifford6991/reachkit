import * as React from "react";
import { ScoreGauge } from "./ScoreGauge";

export interface Pillar {
  label: string;
  value: number;
  note?: string;
}

export interface ScoreCardProps {
  score: number;
  /** Bold takeaway headline. */
  headline: string;
  /** Supporting sentence under the headline. */
  intro: string;
  /** Sub-score breakdown bars (e.g. Content / Outreach / SEO). */
  pillars?: Pillar[];
}

function pillarColor(v: number): string {
  if (v >= 65) return "#46a758";
  if (v >= 45) return "#e0b341";
  return "#e8853f";
}

/**
 * The report hero — gauge on the left, takeaway headline + sub-score pillar bars
 * on the right, in a bordered surface card. ReachKit's most recognisable block.
 */
export function ScoreCard({ score, headline, intro, pillars = [] }: ScoreCardProps) {
  return (
    <div
      style={{
        background: "var(--c-surface)",
        border: "1px solid var(--c-line)",
        borderRadius: "var(--radius-xl)",
        padding: 32,
        boxShadow: "var(--elevation-lg)",
        display: "grid",
        gridTemplateColumns: "auto 1fr",
        gap: 34,
        alignItems: "center",
        fontFamily: "var(--font-sans)",
        color: "var(--c-ink)",
        maxWidth: 720,
      }}
    >
      <ScoreGauge score={score} />
      <div>
        <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 26, letterSpacing: "-0.02em", margin: "0 0 8px" }}>{headline}</h2>
        <p style={{ fontSize: 15, lineHeight: 1.6, color: "var(--c-muted)", margin: "0 0 16px" }}>{intro}</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
          {pillars.map((p) => {
            const c = pillarColor(p.value);
            return (
              <div key={p.label} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 74, fontSize: 13, fontWeight: 600 }}>{p.label}</div>
                <div style={{ flex: 1, height: 8, borderRadius: 5, background: "var(--c-fill)", overflow: "hidden" }}>
                  <div style={{ height: "100%", borderRadius: 5, width: `${p.value}%`, background: c }} />
                </div>
                {p.note && <div style={{ width: 78, fontSize: 12.5, color: "var(--c-muted)" }}>{p.note}</div>}
                <div style={{ width: 28, textAlign: "right", fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 14, color: c }}>{p.value}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
