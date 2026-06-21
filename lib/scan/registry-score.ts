/**
 * registryScore — the candidate v2 Discoverability total, computed from the
 * persisted 18-signal rows. Mirrors verifiedScore's anti-vanity renormalisation:
 * a pillar is scored over its MEASURED signals only, and the total is the
 * pillar-weighted average over ASSESSED pillars (those with ≥1 measured signal).
 * This is used for the v1-vs-v2 calibration dry-run; it does NOT replace the
 * headline number until the swing is reviewed and score_version is bumped.
 */

import { PILLAR_WEIGHTS, type Pillar } from "./signals";

export interface RegistryScoreRow {
  pillar: Pillar;
  weight: number;
  normalised: number | null;
  state: string;
}

export interface RegistryScore {
  total: number;
  breakdown: { content: number; outreach: number; seo: number };
  /** Pillars with at least one measured signal. */
  assessed: Pillar[];
}

const PILLARS: Pillar[] = ["content", "outreach", "seo"];

function pillarNorm(rows: RegistryScoreRow[], pillar: Pillar): number | null {
  const measured = rows.filter(
    (r) => r.pillar === pillar && r.state !== "unmeasured" && r.normalised != null,
  );
  const maxW = measured.reduce((a, r) => a + r.weight, 0);
  if (maxW <= 0) return null;
  const achieved = measured.reduce((a, r) => a + r.weight * ((r.normalised ?? 0) / 100), 0);
  return Math.round((achieved / maxW) * 100);
}

export function registryScore(rows: RegistryScoreRow[]): RegistryScore {
  const norms: Record<Pillar, number | null> = {
    content: pillarNorm(rows, "content"),
    outreach: pillarNorm(rows, "outreach"),
    seo: pillarNorm(rows, "seo"),
  };
  const assessed = PILLARS.filter((p) => norms[p] != null);
  const wsum = assessed.reduce((a, p) => a + PILLAR_WEIGHTS[p], 0);
  const total =
    wsum > 0
      ? Math.round(assessed.reduce((a, p) => a + PILLAR_WEIGHTS[p] * (norms[p] ?? 0), 0) / wsum)
      : 0;
  return {
    total,
    breakdown: {
      content: norms.content ?? 0,
      outreach: norms.outreach ?? 0,
      seo: norms.seo ?? 0,
    },
    assessed,
  };
}
