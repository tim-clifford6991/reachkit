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
  /** The signal key (e.g. "title_tag") — REQUIRED to select the on-site headline
   *  basis. Optional only for legacy callers; headlineFromRows degrades safely. */
  signalKey?: string;
  pillar: Pillar;
  weight: number;
  normalised: number | null;
  state: string;
}

/**
 * The persisted headline score model. v4 (2026-07-09): the headline is the FIXED
 * on-site basis (`headlineScore`) — identical free↔paid, and equal to the pillar
 * bars the dashboard shows — with all off-site strength living in the separate
 * `marketPositionScore` grade. v3 (retired) folded off-site signals into the
 * headline, which moved the number on upgrade (free 74 → paid 66). See
 * docs/architecture.md §4.1 and CLAUDE.md invariant #1.
 */
export const HEADLINE_SCORE_VERSION = 4;

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
 * The headline score to persist for a WEB scan: `registryScore` over the FIXED
 * on-site basis ONLY (`FIXED_BASIS_SIGNAL_KEYS`) — so it's identical whether the
 * scan measured off-site signals or not, and never moves free→paid (v4). Off-site
 * strength is the separate `marketPositionScore` grade, not the headline. App
 * platforms stay on v1 until the app-platform signal set ships.
 *
 * Requires `signalKey` on the rows to select the basis; if absent (legacy rows),
 * degrades to scoring over whatever rows were passed (callers that read back
 * `market:null` signals are already effectively on-site).
 */
export function headlineFromRows(
  mode: Platform,
  v1: { total: number; breakdown: { content: number; outreach: number; seo: number } },
  rows: RegistryScoreRow[],
): Headline {
  if (mode !== "web") return { ...v1, version: 1 };
  const onSite = rows.filter((r) => r.signalKey != null && FIXED_BASIS_SIGNAL_KEYS.includes(r.signalKey));
  const basis = onSite.length > 0 ? onSite : rows; // defensive: legacy rows without signalKey
  const h = registryScore(basis);
  if (h.assessed.length === 0) return { ...v1, version: 1 };
  return { total: h.total, breakdown: h.breakdown, version: HEADLINE_SCORE_VERSION };
}

/**
 * The fixed headline basis: the 8 on-site HTML signals that are computable from
 * the site HTML EVERY scan already fetches (source_type "site_fetch"), and are
 * therefore always measured on a web scan in both the free and paid tiers.
 * Computing the headline over exactly these keys makes the number identical
 * free↔paid — it never moves on upgrade. Deep/off-site signals (keywords,
 * communities, press) enrich the explainability panel but are NOT in the headline.
 */
export const FIXED_BASIS_SIGNAL_KEYS: readonly string[] = [
  "title_tag", "meta_description", "schema_jsonld", "canonical_url", "heading_structure",
  "content_depth", "social_share_tags", "media_richness",
];

/**
 * The single source-of-truth headline score: `registryScore` over the fixed
 * 8-signal subset. Same signals → same number, regardless of what deep signals a
 * paid scan additionally measured.
 */
export function headlineScore(rows: RegistryScoreRow[]): RegistryScore {
  const fixed = rows
    .filter((r) => r.signalKey != null && FIXED_BASIS_SIGNAL_KEYS.includes(r.signalKey))
    .map((r) => ({ pillar: r.pillar, weight: r.weight, normalised: r.normalised, state: r.state }));
  return registryScore(fixed);
}

/**
 * F2 — the "Market Position" grade: `registryScore` over the OFF-SITE signals
 * (everything NOT in the fixed on-site basis) — organic-keyword footprint, ranked
 * positions, referring domains, publishing cadence, owned/marketplace/community
 * presence, share of voice, press. With F2's cohort-relative scoring these reflect
 * how the subject stacks up against its REAL rivals, so a tidy landing page with a
 * tiny keyword footprint (on-site headline 98) honestly reads low here. Paid-only:
 * the deep pass is the first time these are measured. Returns `assessed: []` when
 * none are measured (free scan) — callers then omit the grade.
 */
export function marketPositionScore(rows: RegistryScoreRow[]): RegistryScore {
  const offSite = rows
    .filter((r) => r.signalKey != null && !FIXED_BASIS_SIGNAL_KEYS.includes(r.signalKey))
    .map((r) => ({ pillar: r.pillar, weight: r.weight, normalised: r.normalised, state: r.state }));
  return registryScore(offSite);
}
