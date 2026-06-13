/**
 * Cold Start detection (§4.3) — Cycle 5 Task 4.
 *
 * A subject is in "Cold Start" when it has little/no measurable footprint
 * (pre-revenue, pre-launch). For these the full scan must validate THROUGH
 * distribution, not before it — see generateColdStartActions() in
 * lib/llm/cold-start-actions.ts.
 *
 * Pure + deterministic (no I/O) so it can be unit-tested against the thresholds
 * and called synchronously while assembling PreliminaryFacts.
 */

import type { PreliminaryFacts } from "@/lib/scan/types";

// ---------------------------------------------------------------------------
// Thresholds (deliberately conservative — a clearly-established subject must NOT
// be flagged Cold Start, or it gets the wrong, lower-confidence queue).
// ---------------------------------------------------------------------------

/** App/Play mode: fewer than this many ratings → too thin a footprint to validate against. */
export const COLD_START_MIN_REVIEWS = 25;

/** Web mode: a SERP footprint below this is treated as negligible (an established site has 100k+). */
const COLD_START_MAX_SERP_RESULTS = 1_000;
/** Web mode: Product Hunt upvotes below this are treated as no launch signal. */
const COLD_START_MAX_PH_UPVOTES = 25;
/** Web mode: a domain younger than this (years) is treated as brand-new. null age → treated as new. */
const COLD_START_MAX_DOMAIN_AGE_YEARS = 1;

// ---------------------------------------------------------------------------
// "Effectively no signal at all" — degraded/empty facts in ANY mode: no
// competitors discovered AND no review themes extracted AND a thin review volume.
// This catches subjects where every source degraded to empty (a strong Cold Start
// tell regardless of platform).
// ---------------------------------------------------------------------------
function hasEffectivelyNoSignal(facts: PreliminaryFacts): boolean {
  return (
    facts.competitors.length === 0 &&
    facts.themes.length === 0 &&
    facts.reviewVolume < COLD_START_MIN_REVIEWS
  );
}

// ---------------------------------------------------------------------------
// Web-mode negligible footprint: no webProxy at all, OR all three proxy signals
// are weak (low SERP results AND low PH upvotes AND a brand-new / unknown domain).
// ---------------------------------------------------------------------------
function isWebFootprintNegligible(facts: PreliminaryFacts): boolean {
  const proxy = facts.webProxy;
  if (proxy === null) return true;
  const age = proxy.domainAgeYears ?? 0; // unknown age → treat as brand-new
  return (
    proxy.serpResultCount < COLD_START_MAX_SERP_RESULTS &&
    proxy.phUpvotes < COLD_START_MAX_PH_UPVOTES &&
    age < COLD_START_MAX_DOMAIN_AGE_YEARS
  );
}

/**
 * True when the subject has little/no footprint and the full scan should run the
 * §4.3 validation-through-distribution queue instead of the standard action set.
 */
export function isColdStart(facts: PreliminaryFacts): boolean {
  // Effectively no signal in any mode → Cold Start.
  if (hasEffectivelyNoSignal(facts)) return true;

  // App / Play store: judged on rating volume.
  if (facts.mode === "ios" || facts.mode === "android") {
    return facts.reviewVolume < COLD_START_MIN_REVIEWS;
  }

  // Web: judged on the web proxy footprint.
  return isWebFootprintNegligible(facts);
}
