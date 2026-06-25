import * as React from "react";

/**
 * RankedFix — a single bordered "ranked fix" card from the report: an
 * effort-coloured rank badge, the fix title (display font), a muted "why", and
 * effort/pillar tag chips. Renders fully with no props.
 */
export interface RankedFixProps {
  rank?: number;
  title?: string;
  why?: string;
  effort?: "Quick win" | "Medium" | "Long play";
  pillar?: string;
}

export function RankedFix({
  rank = 1,
  title = "Add a one-line value proposition above the fold",
  why = "Your hero leads with a feature, not the outcome — buyers can't tell what they get in the first 3 seconds.",
  effort = "Quick win",
  pillar = "Clarity",
}: RankedFixProps) {
  const ec =
    effort === "Quick win" ? { bg: "var(--c-tint-green)", fg: "#1F9D5B" }
    : effort === "Long play" ? { bg: "var(--c-tint-violet)", fg: "var(--c-action)" }
    : { bg: "var(--c-tint-amber)", fg: "#C98A12" };
  return (
    <div style={{ background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: "var(--radius-lg)", padding: "18px 20px", display: "flex", alignItems: "flex-start", gap: 16, fontFamily: "var(--font-sans)", color: "var(--c-ink)", maxWidth: 560 }}>
      <span style={{ width: 30, height: 30, borderRadius: "var(--radius-md)", background: ec.bg, color: ec.fg, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-mono)", flex: "0 0 auto" }}>{rank}</span>
      <div style={{ flex: "1 1 0%" }}>
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 15.5, letterSpacing: "-0.01em" }}>{title}</div>
        <div style={{ fontSize: 13.5, lineHeight: 1.5, color: "var(--c-faint)", marginTop: 3 }}>{why}</div>
        <div style={{ display: "flex", gap: 7, marginTop: 10 }}>
          <span style={{ fontSize: 11.5, fontWeight: 600, color: ec.fg, background: ec.bg, padding: "3px 9px", borderRadius: "var(--radius-md)" }}>{effort}</span>
          <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--c-muted)", background: "var(--c-fill)", padding: "3px 9px", borderRadius: "var(--radius-md)" }}>{pillar}</span>
        </div>
      </div>
    </div>
  );
}
