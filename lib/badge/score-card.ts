/**
 * Score-card data builder for the OG share image and badge embed.
 *
 * Pure function — no rendering, no network calls. Consumed by:
 *   - app/report/[slug]/opengraph-image.tsx (ImageResponse)
 *   - app/report/[slug]/page.tsx (badge embed snippet)
 *
 * §7 anti-vanity: the caption is honest — no inflated claims, no vanity
 * metrics. The score is "verified, not vanity" because it applies the
 * §7.2 anti-vanity cap before persisting to report_payload.
 *
 * PURE: deterministic, no side effects, unit-testable.
 */

import type { ReportPayload } from "@/lib/scan/report";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RadarBar {
  /** Axis label */
  label: string;
  /** 0–100 */
  value: number;
  /** Only true for the three active axes */
  active: boolean;
}

export interface ScoreCard {
  /** Verified Discoverability Score total, 0–100 */
  total: number;
  /** Content / Outreach / SEO raw subscores */
  breakdown: { content: number; outreach: number; seo: number };
  /**
   * Radar summary — only the three ACTIVE bars (Content, Outreach, SEO/ASO).
   * Locked axes (Ads, Partnerships, PR, Positioning) are excluded so the OG
   * image stays readable without needing a full radar chart.
   */
  radarSummary: RadarBar[];
  /**
   * Anti-vanity caption — honest, not inflated.
   * Varies slightly based on score tier for clarity.
   */
  caption: string;
  /** Product name from lib/seo.ts SITE constant */
  productName: string;
}

// ---------------------------------------------------------------------------
// Caption strategy (§7 anti-vanity: honest, tier-aware)
// ---------------------------------------------------------------------------

/**
 * Returns an anti-vanity caption that accurately describes what the score is.
 *
 * Rule: no "top performer" / "high achiever" language unless the score
 * genuinely warrants it, and even then it is qualified as "snapshot".
 * "Verified, not vanity" is the permanent sub-clause — it communicates the
 * anti-gaming methodology without self-promotion.
 */
export function buildCaption(total: number): string {
  if (total >= 80) {
    return "Strong discoverability snapshot — verified, not vanity";
  }
  if (total >= 60) {
    return "Solid discoverability snapshot — verified, not vanity";
  }
  if (total >= 40) {
    return "Discoverability snapshot — gaps identified, verified not vanity";
  }
  if (total >= 20) {
    return "Early-stage discoverability snapshot — verified, not vanity";
  }
  return "Discoverability snapshot — verified baseline, not vanity";
}

// ---------------------------------------------------------------------------
// Main builder
// ---------------------------------------------------------------------------

/**
 * Build a `ScoreCard` from a persisted `ReportPayload`.
 *
 * The score and radar are read directly from `payload.score` (already
 * anti-vanity-capped when the pipeline ran). This function adds the caption
 * and filters the radar to only the three active bars.
 */
export function buildScoreCard(payload: ReportPayload): ScoreCard {
  const { score } = payload;

  const radarSummary: RadarBar[] = score.radar
    .filter((ax) => ax.active)
    .map((ax) => ({ label: ax.axis, value: ax.value, active: true }));

  return {
    total: score.total,
    breakdown: score.breakdown,
    radarSummary,
    caption: buildCaption(score.total),
    productName: "ReachKit",
  };
}
