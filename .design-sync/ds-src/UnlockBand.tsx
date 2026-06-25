import * as React from "react";

/**
 * UnlockBand — the report "unlock" banner: a dark violet gradient surface with a
 * white display title, a muted-light subtitle, and a light CTA button. Renders
 * fully with no props.
 */
export interface UnlockBandProps {
  title?: string;
  subtitle?: string;
  ctaLabel?: string;
}

export function UnlockBand({ title = "Unlock the full report", subtitle = "See all 7 ranked fixes, the 18-signal breakdown, and weekly tracking.", ctaLabel = "Unlock the full report" }: UnlockBandProps) {
  return (
    <div style={{ boxSizing: "border-box", maxWidth: 720, background: "linear-gradient(135deg, var(--c-dark), var(--c-dark2))", borderRadius: "var(--radius-xl)", padding: "30px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 320px", minWidth: 0 }}>
        <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 22, letterSpacing: "-0.01em", color: "var(--c-on-dark)", margin: "0 0 6px" }}>{title}</h3>
        <p style={{ fontFamily: "var(--font-sans)", fontSize: 14.5, lineHeight: 1.55, color: "var(--c-on-dark-muted)", margin: 0, maxWidth: 430 }}>{subtitle}</p>
      </div>
      <button type="button" style={{ flex: "0 0 auto", fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: 15, color: "var(--c-ink)", background: "var(--c-surface)", border: "none", borderRadius: "var(--radius-md)", padding: "13px 24px", cursor: "pointer", whiteSpace: "nowrap" }}>{ctaLabel} →</button>
    </div>
  );
}
