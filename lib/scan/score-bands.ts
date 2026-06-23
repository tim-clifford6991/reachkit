/**
 * Discoverability Score bands — the single source of truth for the score's
 * plain-English label + semantic color, used everywhere the score appears
 * (gauge, dashboard, OG image, history-chart zones, badge embed).
 *
 * Five bands (per the UI/data requirements): the band label and the numeral
 * always carry the meaning — color is reinforcement, never the sole signal.
 * Colors are an OKLCH red→amber→green ramp matching the "Violet Discoverability"
 * palette (mirrors the band() colors from the Claude Design mockup).
 */

export interface ScoreBand {
  /** Stable identifier (usable as a CSS hook / data attr). */
  key: string;
  /** Inclusive lower bound (0–100). */
  min: number;
  /** Inclusive upper bound (0–100). */
  max: number;
  /** Plain-English label shown beside the numeral. */
  label: string;
  /** OKLCH color for ring/zone/text. */
  color: string;
}

export const SCORE_BANDS: readonly ScoreBand[] = [
  { key: "invisible", min: 0, max: 29, label: "Invisible", color: "oklch(0.60 0.20 23)" },
  { key: "hard", min: 30, max: 49, label: "Hard to find", color: "oklch(0.65 0.17 47)" },
  { key: "fair", min: 50, max: 69, label: "Fair — room to climb", color: "oklch(0.70 0.13 75)" },
  { key: "findable", min: 70, max: 84, label: "Findable", color: "oklch(0.62 0.13 153)" },
  { key: "high", min: 85, max: 100, label: "Highly discoverable", color: "oklch(0.52 0.12 155)" },
] as const;

/** The band a score falls in. Out-of-range scores clamp to the end bands. */
export function bandFor(score: number): ScoreBand {
  const n = Math.round(score);
  const match = SCORE_BANDS.find((b) => n >= b.min && n <= b.max);
  if (match) return match;
  // Out of range → clamp. SCORE_BANDS is a non-empty constant.
  const first = SCORE_BANDS[0];
  const last = SCORE_BANDS[SCORE_BANDS.length - 1];
  if (!first || !last) throw new Error("SCORE_BANDS is empty");
  return n < first.min ? first : last;
}
