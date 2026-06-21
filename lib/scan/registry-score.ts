/**
 * registryScore — the candidate v2 Discoverability total, computed from the
 * persisted 18-signal rows. Mirrors verifiedScore's anti-vanity renormalisation:
 * a pillar is scored over its MEASURED signals only, and the total is the
 * pillar-weighted average over ASSESSED pillars (those with ≥1 measured signal).
 * This is used for the v1-vs-v2 calibration dry-run; it does NOT replace the
 * headline number until the swing is reviewed and score_version is bumped.
 */

import { PILLAR_WEIGHTS, type Pillar } from "./signals";
import type { Platform } from "./router";
import type { VerifiedScore } from "./score-full";

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

const AXIS_PILLAR: Record<string, Pillar> = {
  Content: "content",
  Outreach: "outreach",
  "SEO/ASO": "seo",
};

/**
 * Patch a v1 VerifiedScore into the v2 (registry) score: override total +
 * breakdown and update the 3 active radar axes so the gauge, bars, and radar all
 * agree. The locked axes and `basis` are preserved.
 */
export function applyRegistryScore(score: VerifiedScore, v2: RegistryScore): VerifiedScore {
  const v2val: Record<string, number> = {
    Content: v2.breakdown.content,
    Outreach: v2.breakdown.outreach,
    "SEO/ASO": v2.breakdown.seo,
  };
  const assessedSet = new Set(v2.assessed);
  return {
    ...score,
    total: v2.total,
    breakdown: { content: v2.breakdown.content, outreach: v2.breakdown.outreach, seo: v2.breakdown.seo },
    radar: score.radar.map((ax) =>
      ax.axis in v2val
        ? { ...ax, value: v2val[ax.axis] ?? ax.value, assessed: assessedSet.has(AXIS_PILLAR[ax.axis] as Pillar) }
        : ax,
    ),
  };
}

export interface Headline {
  total: number;
  breakdown: { content: number; outreach: number; seo: number };
  version: number;
}

/**
 * The headline score to persist: the v2 registry score for WEB scans that have
 * measured signals (score_version 2), otherwise the v1 verified score (version 1).
 * App platforms stay on v1 until the app-platform signal set ships.
 */
export function headlineFromRows(
  mode: Platform,
  v1: { total: number; breakdown: { content: number; outreach: number; seo: number } },
  rows: RegistryScoreRow[],
): Headline {
  if (mode !== "web") return { ...v1, version: 1 };
  const v2 = registryScore(rows);
  if (v2.assessed.length === 0) return { ...v1, version: 1 };
  return { total: v2.total, breakdown: v2.breakdown, version: 2 };
}
