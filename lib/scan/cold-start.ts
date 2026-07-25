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

/**
 * A subject ranking for at least this many keywords has a REAL search footprint —
 * it is established, never pre-launch. This is the signal `isColdStart` structurally
 * cannot see (A1, 2026-07-25): cold-start is decided at facts-assembly time, BEFORE
 * the free pass computes `searchVisibility.keywordsRanked`, and the facts-time
 * signals it does have are unreliable for a live product (a privacy/SPA homepage
 * yields 0 discovered competitors; the archive.org domain-age lookup routinely times
 * out to null). plausible.io — a mature product ranking for 1,425 keywords — was
 * wrongly flagged cold-start and handed the pre-launch "waitlist" template. The deep
 * pass overrides that flag with this footprint check (`resolveColdStart`).
 */
export const ESTABLISHED_MIN_RANKED_KEYWORDS = 25;

/** True when the free pass's ranked-keyword footprint proves a real, established
 *  search presence — regardless of what the facts-time cold-start heuristics saw. */
export function isEstablishedByFootprint(keywordsRanked: number | null | undefined): boolean {
  return (keywordsRanked ?? 0) >= ESTABLISHED_MIN_RANKED_KEYWORDS;
}

/**
 * The deep pass's FINAL cold-start decision (A1): the facts-time flag, but
 * OVERRIDDEN to established when the free pass's ranked-keyword footprint proves a
 * presence the facts-time signals missed. Genuinely pre-launch subjects (no
 * footprint) keep the validation queue; a live product never does. PURE.
 */
export function resolveColdStart(factsColdStart: boolean, keywordsRanked: number | null | undefined): boolean {
  return factsColdStart && !isEstablishedByFootprint(keywordsRanked);
}

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
