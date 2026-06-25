import * as React from "react";

/**
 * CompareCard — a "ReachKit vs X" index card from the /compare hub: a display
 * title, an uppercase mono tagline eyebrow, a muted blurb, and a violet
 * "See the comparison →" link. Renders fully with no props.
 */
export interface CompareCardProps {
  competitor?: string;
  tagline?: string;
  blurb?: string;
}

export function CompareCard({ competitor = "Ahrefs", tagline = "SEO toolset", blurb = "A deep SEO suite for agencies. ReachKit scores App Store + web and turns it into a small weekly to-do list at indie pricing." }: CompareCardProps) {
  return (
    <div style={{ maxWidth: 360, background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: "var(--radius-lg)", padding: "26px 26px 22px", fontFamily: "var(--font-sans)" }}>
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 20, letterSpacing: "-0.01em", color: "var(--c-ink)" }}>
        ReachKit vs {competitor}
      </div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, fontWeight: 600, color: "var(--c-faint)", textTransform: "uppercase", letterSpacing: "0.05em", margin: "4px 0 12px" }}>{tagline}</div>
      <p style={{ fontSize: 14.5, lineHeight: 1.55, color: "var(--c-muted)", margin: 0 }}>{blurb}</p>
      <div style={{ marginTop: 16, fontWeight: 600, fontSize: 14, color: "var(--c-action)" }}>See the comparison →</div>
    </div>
  );
}
