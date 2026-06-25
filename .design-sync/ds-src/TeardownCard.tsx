import * as React from "react";

/**
 * TeardownCard — a teardown index card from the /teardowns hub: an uppercase
 * "{Web|App Store} Teardown" eyebrow, a display app-name title, a band-coloured
 * score badge, a muted blurb, and a violet "Read the teardown →" link. Renders
 * fully with no props.
 */
export interface TeardownCardProps {
  appName?: string;
  platform?: "web" | "ios";
  score?: number;
  blurb?: string;
}

function scoreColor(s: number): string {
  if (s >= 65) return "#46a758";
  if (s >= 45) return "#e0b341";
  if (s >= 25) return "#e8853f";
  return "#e5484d";
}
function tint(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, 0.12)`;
}

export function TeardownCard({ appName = "Plausible Analytics", platform = "web", score = 52, blurb = "Plausible competes for the crowded 'Google Analytics alternative' query. Its sharpest, least-contested audience is teams trying to delete a cookie banner — and the messaging barely speaks to them." }: TeardownCardProps) {
  const color = scoreColor(score);
  const eyebrow = `${platform === "ios" ? "App Store" : "Web"} Teardown`;
  return (
    <div style={{ maxWidth: 360, background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: "var(--radius-lg)", padding: "22px 22px 20px", fontFamily: "var(--font-sans)" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--c-faint)" }}>{eyebrow}</span>
          <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 19, letterSpacing: "-0.01em", color: "var(--c-ink)", margin: "8px 0 0" }}>{appName}</h3>
        </div>
        <span style={{ flex: "0 0 auto", display: "inline-flex", alignItems: "baseline", gap: 2, background: tint(color), color, fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 22, lineHeight: 1, padding: "8px 12px", borderRadius: "var(--radius-md)" }}>
          {score}<span style={{ fontSize: 11, color: "var(--c-faint)", fontWeight: 700 }}>/100</span>
        </span>
      </div>
      <p style={{ fontSize: 14, lineHeight: 1.5, color: "var(--c-muted)", margin: "14px 0 0" }}>{blurb}</p>
      <span style={{ display: "inline-block", marginTop: 14, fontWeight: 600, fontSize: 14, color: "var(--c-action)" }}>Read the teardown →</span>
    </div>
  );
}
