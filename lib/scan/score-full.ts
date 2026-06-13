/**
 * Verified Discoverability Score + radar (§7 anti-vanity rules).
 *
 * This is the VERIFIED score introduced in Cycle 3. It differs from the
 * preliminary Cycle 2 score (score.ts) in three ways:
 *
 *  1. Inputs are direct density measurements (ScoreComponents) rather than
 *     proxy signals from PreliminaryFacts alone.
 *  2. Anti-vanity rule (§7.2 rule 1): self-reported fractions of each subscore
 *     are capped at contributing ≤20% of that subscore. Other §7.2 rules
 *     (e.g. freshness decay, unverified source discount) are assumed applied at
 *     gather time and are not re-applied here.
 *  3. The result carries `basis: "verified"` and a 7-axis radar.
 *
 * gatherScoreComponents (first scan / Cycle 3):
 *   - directoriesLive and comparisonPagesLive = 0 (no scan executed yet)
 *   - contentSurfaces and outreachSurfaces = 0 (none built yet)
 *   - keywordsRanking estimated from the theme/keyword fact sheet + competitor
 *     count as a density proxy; conservative to avoid false signals
 *   - asoCoverage estimated from the same signals (0 for web mode)
 *
 * These defaults produce an honestly-low first-scan score that grows in
 * Cycle 4 as surfaces are scanned and verified.
 */

import type { ScoreResult } from "@/lib/llm/types";
import type { PreliminaryFacts } from "@/lib/scan/types";
import type { Platform } from "@/lib/scan/router";
import type { ScanContext } from "@/lib/scan/pipeline";
import { serverDb } from "@/lib/db/client";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ScoreComponents {
  /** Normalised keyword/store ranking signal, 0–100. */
  keywordsRanking: number;
  /** Fraction of target directories where the product is live, 0–100. */
  directoriesLive: number;
  /** Fraction of comparison/review pages where the product appears, 0–100. */
  comparisonPagesLive: number;
  /** App-store optimisation coverage score, 0–100 (ignored in web mode). */
  asoCoverage: number;
  /** Count of distinct content surfaces (blog posts, videos, etc.) found. */
  contentSurfaces: number;
  /** Count of distinct outreach surfaces (podcasts, guest posts, etc.) found. */
  outreachSurfaces: number;
  /**
   * Optional: fraction of each subscore attributable to self-reported sources.
   * When provided the anti-vanity cap (§7.2 rule 1) clamps each self-reported
   * contribution to ≤20% of the raw subscore.
   */
  selfReportedFraction?: {
    content?: number;
    outreach?: number;
    seo?: number;
  };
}

export interface RadarAxis {
  axis: string;
  value: number;
  active: boolean;
}

export type VerifiedScore = ScoreResult & { radar: RadarAxis[]; basis: "verified" };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Log-scale a count to 0–100.
 * logScale(0) = 0; logScale(ref) ≈ 100; values above ref are clamped to 100.
 * Reference calibrated to typical mid-tier products.
 */
function logScale(value: number, ref: number): number {
  if (value <= 0 || ref <= 0) return 0;
  const score = (Math.log10(1 + value) / Math.log10(1 + ref)) * 100;
  return Math.min(100, Math.max(0, score));
}

/**
 * Apply the anti-vanity cap (§7.2 rule 1).
 *
 * If `selfFraction` of the raw subscore is self-reported, only
 * min(selfFraction * raw, 0.20 * raw) of that portion is credited.
 *
 * Returns the capped (still unrounded) subscore.
 */
function applyAntiVanityCap(raw: number, selfFraction: number | undefined): number {
  if (selfFraction === undefined || selfFraction <= 0) return raw;
  const selfPortion = selfFraction * raw;
  const allowed = Math.min(selfPortion, 0.20 * raw);
  return raw - selfPortion + allowed;
}

// ---------------------------------------------------------------------------
// Subscore calculations
// ---------------------------------------------------------------------------

/**
 * SEO/ASO subscore from direct density measurements.
 *
 * App mode (ios/android) — 4-way split:
 *   keywordsRanking × 0.40 + directoriesLive × 0.20 +
 *   comparisonPagesLive × 0.20 + asoCoverage × 0.20
 *
 * Web mode — ASO is not applicable; its 20% redistributes:
 *   keywordsRanking × 0.50 + directoriesLive × 0.25 + comparisonPagesLive × 0.25
 */
function rawSeoScore(components: ScoreComponents, mode: Platform): number {
  const { keywordsRanking, directoriesLive, comparisonPagesLive, asoCoverage } = components;
  if (mode === "web") {
    return keywordsRanking * 0.50 + directoriesLive * 0.25 + comparisonPagesLive * 0.25;
  }
  return (
    keywordsRanking * 0.40 +
    directoriesLive * 0.20 +
    comparisonPagesLive * 0.20 +
    asoCoverage * 0.20
  );
}

/**
 * Content subscore: log-scaled from contentSurfaces.
 * Reference: 100 surfaces ≈ 100 score (generous — surfaces grow in Cycle 4).
 */
function rawContentScore(contentSurfaces: number): number {
  return logScale(contentSurfaces, 100);
}

/**
 * Outreach subscore: log-scaled from outreachSurfaces.
 * Reference: 50 surfaces ≈ 100 score.
 */
function rawOutreachScore(outreachSurfaces: number): number {
  return logScale(outreachSurfaces, 50);
}

// ---------------------------------------------------------------------------
// Verified-outcomes counts (the moat — Cycle 4 Task 14)
// ---------------------------------------------------------------------------

/** Per-category counts of an app's verified outcomes. */
interface VerifiedOutcomeCounts {
  content: number;
  outreach: number;
  seoAso: number;
}

const NO_OUTCOMES: VerifiedOutcomeCounts = { content: 0, outreach: 0, seoAso: 0 };

/**
 * SEO/ASO surface increment per verified seo_aso action.
 *
 * A verified seo_aso action (a directory submission, a comparison page going
 * live, a keyword now ranking) is a modest, conservative bump to the live-surface
 * fractions — capped at 100 at the call site. 4 points per verified action means
 * a founder must ship ~25 verified seo_aso surfaces to saturate either fraction.
 */
const SEO_OUTCOME_INCREMENT = 4;

/**
 * Count this app's VERIFIED outcomes grouped by the originating action's category.
 *
 * An outcome is "verified" iff it has a non-null verified_signal (runActionVerification
 * only writes an outcomes row once an action actually verifies). We join through the
 * action to read its category (content | outreach | seo_aso).
 *
 * NEVER throws and NEVER fabricates: any failure (no DB/env in a unit test, query
 * error, malformed rows) returns {@link NO_OUTCOMES} so the zero-outcomes baseline
 * is preserved EXACTLY. A fresh app with no verified outcomes therefore yields the
 * same honest-low score as before this feature existed.
 */
async function countVerifiedOutcomes(appId: string): Promise<VerifiedOutcomeCounts> {
  try {
    const db = serverDb();
    const { data, error } = await db
      .from("outcomes")
      .select("verified_signal, actions(category)")
      .eq("app_id", appId)
      .not("verified_signal", "is", null);
    if (error || data === null) return NO_OUTCOMES;

    const counts: VerifiedOutcomeCounts = { content: 0, outreach: 0, seoAso: 0 };
    for (const row of data) {
      // actions is a to-one join → coerce after null check.
      const action = row.actions as unknown as { category?: string } | null;
      const category = action?.category;
      if (category === "content") counts.content += 1;
      else if (category === "outreach") counts.outreach += 1;
      else if (category === "seo_aso") counts.seoAso += 1;
    }
    return counts;
  } catch {
    return NO_OUTCOMES;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute the verified Discoverability Score + radar from pre-gathered
 * ScoreComponents for the given platform mode.
 *
 * Anti-vanity cap is applied per subscore before rounding.
 * Total = round(0.30 × content + 0.25 × outreach + 0.45 × seo), clamped 0–100.
 */
export function verifiedScore(components: ScoreComponents, mode: Platform): VerifiedScore {
  const { selfReportedFraction } = components;

  // Compute raw subscores (unrounded, uncapped)
  const rawSeo = rawSeoScore(components, mode);
  const rawContent = rawContentScore(components.contentSurfaces);
  const rawOutreach = rawOutreachScore(components.outreachSurfaces);

  // Apply anti-vanity cap (§7.2 rule 1)
  const cappedSeo = applyAntiVanityCap(rawSeo, selfReportedFraction?.seo);
  const cappedContent = applyAntiVanityCap(rawContent, selfReportedFraction?.content);
  const cappedOutreach = applyAntiVanityCap(rawOutreach, selfReportedFraction?.outreach);

  // Round subscores
  const content = Math.round(Math.min(100, Math.max(0, cappedContent)));
  const outreach = Math.round(Math.min(100, Math.max(0, cappedOutreach)));
  const seo = Math.round(Math.min(100, Math.max(0, cappedSeo)));

  // Weighted total
  const total = Math.round(Math.min(100, Math.max(0, 0.30 * content + 0.25 * outreach + 0.45 * seo)));

  // 7-axis radar: 3 active (Content, Outreach, SEO/ASO) + 4 locked
  const radar: RadarAxis[] = [
    { axis: "Content", value: content, active: true },
    { axis: "Outreach", value: outreach, active: true },
    { axis: "SEO/ASO", value: seo, active: true },
    { axis: "Ads", value: 0, active: false },
    { axis: "Partnerships", value: 0, active: false },
    { axis: "PR", value: 0, active: false },
    { axis: "Positioning", value: 0, active: false },
  ];

  return { total, breakdown: { content, outreach, seo }, radar, basis: "verified" };
}

/**
 * Gather ScoreComponents for the first scan (Cycle 3).
 *
 * Design intent (§7, honest-low first scan):
 *   - directoriesLive = 0: no directory scan has run yet
 *   - comparisonPagesLive = 0: no comparison page scan has run yet
 *   - contentSurfaces = 0: no content surfaces built/verified yet
 *   - outreachSurfaces = 0: no outreach surfaces built/verified yet
 *   - keywordsRanking: conservative estimate from theme count + competitor
 *     density (a weak proxy; grows when keyword rank-tracking runs in Cycle 4)
 *   - asoCoverage: conservative estimate from keyword facts; 0 in web mode
 *
 * Other §7.2 rules (freshness decay, duplicate discount, unverified source
 * penalty) are assumed applied at data-gather time by the tools that populate
 * PreliminaryFacts.
 *
 * Cycle 4 Task 14 — score MOVEMENT from the outcomes moat:
 *   After computing the first-scan baseline above, this app's VERIFIED outcomes
 *   are counted (joined to their action's category) and the relevant verified-
 *   surface counts are bumped BEFORE verifiedScore runs:
 *     - category "content"  → contentSurfaces  (each verified outcome = +1 surface)
 *     - category "outreach" → outreachSurfaces (each verified outcome = +1 surface)
 *     - category "seo_aso"  → directoriesLive + comparisonPagesLive (a modest
 *                             per-action increment, each capped at 100)
 *   With ZERO verified outcomes the bumps are all 0, so the baseline above is
 *   preserved EXACTLY (countVerifiedOutcomes degrades to no-op on any failure).
 */
export async function gatherScoreComponents(
  ctx: ScanContext,
  facts: PreliminaryFacts,
): Promise<ScoreComponents> {
  const isWeb = facts.mode === "web";

  // Keyword density proxy: use distinct theme terms as a rough stand-in for
  // keyword breadth. ref=20 themes ≈ broad keyword coverage (conservative).
  const themeCount = facts.themes.length;
  const keywordsRanking = Math.round(logScale(themeCount, 20));

  // ASO coverage proxy: blend theme count signal with rating trend (app only).
  // For apps with a known rating, a higher rating weakly suggests better ASO
  // adoption. Cap conservatively at 30 until a real ASO scan is run.
  let asoCoverage = 0;
  if (!isWeb) {
    const themeProxy = logScale(themeCount, 20);
    const ratingBonus = facts.ratingTrend !== null ? (facts.ratingTrend / 5) * 20 : 0;
    asoCoverage = Math.round(Math.min(30, themeProxy * 0.6 + ratingBonus * 0.4));
  }

  // Verified-outcomes bump (the moat). Zero verified outcomes → no change.
  const verified = await countVerifiedOutcomes(ctx.appId);
  const seoBump = Math.min(100, verified.seoAso * SEO_OUTCOME_INCREMENT);

  return {
    keywordsRanking,
    directoriesLive: seoBump,
    comparisonPagesLive: seoBump,
    asoCoverage,
    contentSurfaces: verified.content,
    outreachSurfaces: verified.outreach,
  };
}
