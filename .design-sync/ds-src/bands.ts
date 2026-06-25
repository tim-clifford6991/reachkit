// Discoverability score bands — shared by the gauge + score card.

export interface Band {
  key: string;
  label: string;
  color: string;
}

export function bandFor(score: number): Band {
  if (score >= 85) return { key: "high", label: "Highly discoverable", color: "#2f8a4a" };
  if (score >= 65) return { key: "findable", label: "Findable", color: "#46a758" };
  if (score >= 45) return { key: "fair", label: "Getting found", color: "#e0b341" };
  if (score >= 25) return { key: "hard", label: "Hard to find", color: "#e8853f" };
  return { key: "invisible", label: "Invisible", color: "#e5484d" };
}

// SVG gauge geometry — a 270° arc opening at the bottom.
const START = 135;
const SWEEP = 270;

function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const a = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

/** SVG path for an arc from `startDeg` sweeping `sweepDeg` clockwise. */
export function arcPath(cx: number, cy: number, r: number, sweepDeg: number): string {
  const s = START;
  const e = START + Math.max(0, Math.min(SWEEP, sweepDeg));
  const [sx, sy] = polar(cx, cy, r, s);
  const [ex, ey] = polar(cx, cy, r, e);
  const large = e - s > 180 ? 1 : 0;
  return `M ${sx.toFixed(2)} ${sy.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${ex.toFixed(2)} ${ey.toFixed(2)}`;
}

export const GAUGE_SWEEP = SWEEP;
