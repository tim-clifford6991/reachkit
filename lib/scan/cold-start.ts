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

/** Web mode: a domain at least this old (years) is an established site, never pre-launch. */
const COLD_START_MIN_ESTABLISHED_AGE_YEARS = 1;

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

/**
 * True when the subject has little/no footprint and the full scan should run the
 * §4.3 validation-through-distribution queue instead of the standard action set.
 */
export function isColdStart(facts: PreliminaryFacts): boolean {
  // App / Play store: judged on rating volume, with the all-degraded catch.
  if (facts.mode === "ios" || facts.mode === "android") {
    if (hasEffectivelyNoSignal(facts)) return true;
    return facts.reviewVolume < COLD_START_MIN_REVIEWS;
  }

  // Web: an established domain (≥1y, known) is never pre-launch — short-circuit.
  // Otherwise judge purely on whether ANY competitive or review/theme footprint
  // exists. We deliberately do NOT use the niche "alternatives to X" serpResultCount
  // (it reflects that query, not brand presence) or the disabled-PH phUpvotes
  // (always 0), and an UNKNOWN domain age is treated as unknown — never "brand-new".
  const proxy = facts.webProxy;
  if (proxy?.domainAgeYears != null && proxy.domainAgeYears >= COLD_START_MIN_ESTABLISHED_AGE_YEARS) {
    return false;
  }
  return facts.competitors.length === 0 && facts.themes.length === 0;
}
