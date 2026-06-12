/**
 * Preliminary discoverability score (Cycle 2 heuristic).
 *
 * This is a PRELIMINARY score derived from available Cycle 2 signals. The
 * *verified* score with direct-density measurements is Cycle 3/4 work.
 * Label it accordingly in any UI that surfaces it.
 *
 * Weights (§7.1): content .30 / outreach .25 / seo .45
 */

import type { PreliminaryFacts } from "@/lib/scan/types";
import type { KeywordSheet, ScoreResult } from "@/lib/llm/types";

// ---------------------------------------------------------------------------
// Log-scaled helper — maps a count to 0–100 on a log10 scale.
// logScale(0) = 0, logScale(ref) ≈ 100, values above ref are clamped.
// ---------------------------------------------------------------------------
function logScale(value: number, ref: number): number {
  if (value <= 0 || ref <= 0) return 0;
  // log10(1 + value) / log10(1 + ref) * 100, clamped to [0, 100]
  const score = (Math.log10(1 + value) / Math.log10(1 + ref)) * 100;
  return Math.min(100, Math.max(0, score));
}

// ---------------------------------------------------------------------------
// Content subscore (0–100)
// Signals: review volume + theme richness (distinct theme count).
// Reference values calibrated to typical mid-tier app store apps.
// ---------------------------------------------------------------------------
function contentScore(facts: PreliminaryFacts): number {
  // Reference: 10,000 reviews = full review volume score
  const volumeScore = logScale(facts.reviewVolume, 10_000);

  // Reference: 8 themes = full theme richness score
  const themeScore = logScale(facts.themes.length, 8);

  // Weighted blend: volume 60%, theme richness 40%
  return Math.min(100, Math.max(0, 0.6 * volumeScore + 0.4 * themeScore));
}

// ---------------------------------------------------------------------------
// Outreach subscore (0–100)
// CONSERVATIVE in Cycle 2 — no creator/community data yet.
// Web mode: phUpvotes is the best proxy. App mode: review volume is the proxy.
// Cap at 40 to signal that Cycle 2 data is incomplete.
// ---------------------------------------------------------------------------
function outreachScore(facts: PreliminaryFacts): number {
  let raw: number;

  if (facts.mode === "web" && facts.webProxy !== null) {
    // Web mode: use phUpvotes — reference 500 upvotes = top of range
    raw = logScale(facts.webProxy.phUpvotes, 500);
  } else {
    // App mode (or web with no proxy): use review volume as a weak proxy.
    // Reference: 5,000 reviews = top of range
    raw = logScale(facts.reviewVolume, 5_000);
  }

  // Conservative cap: Cycle 2 lacks creator/community data.
  // Max outreach score in Cycle 2 is 40 to reflect data incompleteness.
  return Math.min(40, Math.max(0, raw));
}

// ---------------------------------------------------------------------------
// SEO/ASO subscore (0–100)
// Signals: total keyword volume across all clusters + competitor count (gap pressure).
// ---------------------------------------------------------------------------
function seoScore(facts: PreliminaryFacts, keywords: KeywordSheet | null): number {
  // Keyword volume signal
  let totalVolume = 0;
  if (keywords !== null) {
    for (const cluster of keywords.clusters) {
      for (const kw of cluster.keywords) {
        totalVolume += kw.volume;
      }
    }
  }
  // Reference: 50,000 total monthly volume = full keyword score
  const kwScore = logScale(totalVolume, 50_000);

  // Competitor gap pressure: more competitors = more competitive space = higher SEO pressure/opportunity.
  // Reference: 5 competitors = full competitor score (log-scaled, small signal).
  const compScore = logScale(facts.competitors.length, 5);

  // Weighted blend: keyword volume 75%, competitor pressure 25%
  return Math.min(100, Math.max(0, 0.75 * kwScore + 0.25 * compScore));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export function discoverabilityScore(
  facts: PreliminaryFacts,
  keywords: KeywordSheet | null,
): ScoreResult {
  const content = contentScore(facts);
  const outreach = outreachScore(facts);
  const seo = seoScore(facts, keywords);

  const total = Math.round(
    Math.min(100, Math.max(0, 0.30 * content + 0.25 * outreach + 0.45 * seo)),
  );

  return {
    total,
    breakdown: { content, outreach, seo },
  };
}
