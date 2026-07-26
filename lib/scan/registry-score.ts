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

/**
 * v5 (2026-07-11): the headline is the UNIFIED **Discoverability Score** —
 * `discoverabilityScore` = geometric mean of **on-page readiness** (the v4
 * `headlineScore`, 8 on-site signals) × **search presence** (the free-tier
 * `searchVisibility.score`, from `ranked_keywords`). Both inputs are computed on
 * BOTH tiers, so the number is still identical free↔paid (never moves on upgrade)
 * — but it's now HONEST: a flawless page nobody finds scores low (a tidy landing
 * page can't read 98 while it's invisible in search). The two drivers are shown
 * beneath the gauge. Off-site cohort strength stays the separate
 * `marketPositionScore` grade. See CLAUDE.md invariant #1 + docs/architecture.md.
 */
/**
 * v6 (2026-07-26): the FINDABILITY BLEND. `searchPresence` (`sv.score`) is the
 * CATEGORY-CLASSIFIED presence — for a site whose category the classifier can't
 * recover (x.com; a broken SPA fetch that starves the classifier) it reads ~0
 * even though the site ranks for millions of keywords, and the geometric mean
 * then collapses the WHOLE score to "Invisible" (x.com: 15,060,115 ranked
 * keywords → 4/100, savvycal 32k → 7, getapp 120k → 32). That is the launch-
 * credibility "one red rule": a household-name site scanning "Invisible".
 *
 * `keywordsRanked` is a RAW count from the same `ranked_keywords` call — NOT the
 * frozen category classifier — so blending it in is invariant-#1-safe: it never
 * touches `classify`/`computeSearchVisibility`, and because keywordsRanked is
 * identical free↔paid (the deepen reuses the persisted free searchVisibility),
 * the unified number is STILL identical free↔paid, never moving on upgrade. We
 * floor search presence by a scale-invariant findability curve so a site that
 * demonstrably ranks broadly cannot read "Invisible", while a genuinely
 * footprint-less site (0 ranked → floor 0) stays low (reachkit.app, unlaunched,
 * correctly stays ~9). Owner-approved targets (2026-07-26): x.com 4→~45,
 * savvycal 7→~55, getapp 32→~61, resend 85 unchanged, reachkit.app ~9 unchanged.
 */
export const DISCOVERABILITY_SCORE_VERSION = 6;

/**
 * Findability floor from the raw ranked-keyword footprint (0..100). 0 ranked → 0
 * (a footprint-less site stays low, so a genuinely unlaunched product still reads
 * Invisible); ~350 → ~36; ~32k → ~63; 15M → 100. Log-scale so it's scale-invariant
 * across a tiny niche and a mega-site. PURE. Invariant-#1-safe: keywordsRanked is a
 * raw count, not the frozen category classifier.
 */
export function findabilityFloor(keywordsRanked: number | null | undefined): number {
  const k = keywordsRanked ?? 0;
  if (!Number.isFinite(k) || k < 1) return 0;
  return Math.min(100, Math.max(0, Math.round(14 * Math.log10(k))));
}

/**
 * The unified Discoverability Score: geometric mean of on-page readiness and search
 * presence, both 0–100. Geometric (not arithmetic) so BOTH must be strong — a great
 * page with no search presence, or strong rankings on a broken page, both score low.
 * `searchPresence` is floored at 1 so a well-built but wholly-unfound site reads a
 * low single digit rather than a hard 0 (which looks like an error). v6: search
 * presence is additionally floored by the raw findability footprint
 * (`findabilityFloor(keywordsRanked)`) so a broadly-ranking site can't read as
 * search-invisible on a classifier miss — see DISCOVERABILITY_SCORE_VERSION.
 * `keywordsRanked` omitted (undefined) → no findability floor (v5 behavior). PURE.
 */
export function discoverabilityScore(
  onPageReadiness: number,
  searchPresence: number,
  keywordsRanked?: number | null,
): number {
  const onPage = Math.max(0, Math.min(100, onPageReadiness));
  const floored = Math.max(1, Math.min(100, searchPresence));
  const search = Math.max(floored, findabilityFloor(keywordsRanked));
  return Math.round(Math.sqrt(onPage * search));
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
 * Combine an on-page `Headline` with the persisted search-presence score into the
 * v5 unified total — the single place the score-over-time writers (verify / refresh
 * / pulse) turn the recomputed on-page score into the same Discoverability Score the
 * scan persisted, so the trend line never mixes scales. `searchPresence` is the
 * persisted `report_payload.searchVisibility.score` (null on app platforms / legacy
 * scans → falls back to the on-page headline unchanged).
 */
export function unifiedHeadline(
  headline: Headline,
  searchPresence: number | null | undefined,
  keywordsRanked?: number | null,
): Headline {
  if (headline.version === 1 || searchPresence == null) return headline;
  return {
    ...headline,
    total: discoverabilityScore(headline.total, searchPresence, keywordsRanked),
    version: DISCOVERABILITY_SCORE_VERSION,
  };
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
