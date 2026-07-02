import * as React from "react";

/**
 * LeverBanner — the weakest-pillar lever callout: a tinted strip naming the
 * weakest pillar, the one-line rationale, the points on offer, and a CTA link
 * to the plan. Not to be confused with the report's UnlockBand.
 */
export interface LeverBannerProps {
  /** Weakest pillar, e.g. "Outreach". */
  pillar: string;
  /** One-line rationale. */
  note: string;
  /** Points on offer, e.g. "+9 pts". */
  points?: string;
  ctaLabel?: string;
}

export function LeverBanner({ pillar, note, points, ctaLabel = "See your plan" }: LeverBannerProps) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, fontFamily: "var(--font-sans)", color: "var(--c-ink)", background: "var(--c-tint-amber)", border: "1px solid var(--c-tint-amber-line)", borderRadius: "var(--radius-lg)", padding: "12px 16px" }}>
      <span style={{ fontSize: 18 }}>⚡</span>
      <div style={{ fontSize: 14, flex: 1 }}>
        <strong>{pillar} is your weakest pillar</strong> — {note}
        {points && <span style={{ color: "var(--c-action)", fontFamily: "var(--font-mono)", fontWeight: 700 }}> {points}</span>}
      </div>
      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--c-action)", whiteSpace: "nowrap" }}>{ctaLabel} →</span>
    </div>
  );
}
