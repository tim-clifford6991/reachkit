import * as React from "react";

export interface BadgeProps {
  children: React.ReactNode;
  /**
   * Semantic tone. `band-*` are the discoverability score-band colours; the
   * rest are general-purpose tints that follow light/dark.
   */
  tone?:
    | "violet" | "neutral" | "green" | "amber" | "red" | "blue" | "orange"
    | "band-invisible" | "band-hard" | "band-fair" | "band-findable" | "band-high";
}

const TINT: Record<NonNullable<BadgeProps["tone"]>, { bg: string; fg: string }> = {
  violet: { bg: "var(--c-soft)", fg: "var(--c-action)" },
  neutral: { bg: "var(--c-fill)", fg: "var(--c-muted)" },
  green: { bg: "var(--c-tint-green)", fg: "#1f9d5b" },
  amber: { bg: "var(--c-tint-amber)", fg: "#c98a12" },
  red: { bg: "var(--c-tint-red)", fg: "#e5484d" },
  blue: { bg: "var(--c-tint-blue)", fg: "#3b6fe0" },
  orange: { bg: "var(--c-tint-orange)", fg: "#e0731c" },
  "band-invisible": { bg: "var(--c-tint-red)", fg: "var(--c-band-invisible)" },
  "band-hard": { bg: "var(--c-tint-orange)", fg: "var(--c-band-hard)" },
  "band-fair": { bg: "var(--c-tint-amber)", fg: "var(--c-band-fair)" },
  "band-findable": { bg: "var(--c-tint-green)", fg: "var(--c-band-findable)" },
  "band-high": { bg: "var(--c-tint-green)", fg: "var(--c-band-high)" },
};

/**
 * Compact status pill — score bands, effort tags, and general labels. Inherits
 * the design tokens, so tones follow light/dark automatically.
 */
export function Badge({ children, tone = "violet" }: BadgeProps) {
  const c = TINT[tone];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        background: c.bg,
        color: c.fg,
        fontFamily: "var(--font-sans)",
        fontWeight: 700,
        fontSize: 12.5,
        padding: "4px 11px",
        borderRadius: "var(--radius-xs)",
        lineHeight: 1.2,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}
