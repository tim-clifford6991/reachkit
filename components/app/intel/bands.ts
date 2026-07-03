// Discoverability score bands + gauge geometry — the canonical source of truth
// for what a score "means" is `lib/scan/score-bands.ts` (used by the report,
// OG image, share card, and history chart). This module maps that canonical
// scale onto the intel-facing `Band` shape ({key, label, color}) so every
// intel dashboard (Supply/Demand/Synthesis/Plans/Progress) agrees with the
// report on band thresholds/labels/colors — plus the 270° gauge arc geometry
// used across the intel dashboards.
//
// Server-safe (no "use client", no React): server components (e.g.
// progress-view.tsx) import `bandFor` directly and must be able to call it
// during SSR without pulling in the "use client" intel kit.
import { bandFor as scoreBandFor } from "@/lib/scan/score-bands";

export interface Band {
  key: string;
  label: string;
  color: string;
}

/** The band a score falls in — delegates to the canonical score-bands scale. */
export function bandFor(score: number): Band {
  const { key, label, color } = scoreBandFor(score);
  return { key, label, color };
}

const START = 135;
const SWEEP = 270;

function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const a = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

/** SVG path for an arc from the 135° start sweeping `sweepDeg` clockwise. */
export function arcPath(cx: number, cy: number, r: number, sweepDeg: number): string {
  const s = START;
  const e = START + Math.max(0, Math.min(SWEEP, sweepDeg));
  const [sx, sy] = polar(cx, cy, r, s);
  const [ex, ey] = polar(cx, cy, r, e);
  const large = e - s > 180 ? 1 : 0;
  return `M ${sx.toFixed(2)} ${sy.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${ex.toFixed(2)} ${ey.toFixed(2)}`;
}

export const GAUGE_SWEEP = SWEEP;
