// BUILD §7 — the two winnability bars.
//
// §7, verbatim: "a Write target qualifies only if its top-10 contains at
// least one domain whose ranked count ≤ max(500, 5× customer's)". That is
// the qualifying bar. The band inside it — Winnable rather than Reach — is
// the same shape one notch tighter, `max(100, 2× customer's)`.
//
// Both take one number and nothing else: no site id, no options object, no
// configuration. The threshold applied to one customer is therefore
// identical to the threshold applied to every other by construction, since
// there is no argument through which a per-customer bar could arrive.
// Tuning the engine per customer is a §17 non-goal; this is what makes it
// unrepresentable rather than merely discouraged.
//
// The numbers are `WINNABILITY`'s and are imported, never restated.
import { WINNABILITY } from "@/lib/config/constants";

/** `max(500, 5 × ownRanked)` — the bar a Write target must clear at all. */
export function qualifyingBar(ownRanked: number): number {
  return Math.max(WINNABILITY.qualifyFloor, WINNABILITY.qualifyMultiple * ownRanked);
}

/** `max(100, 2 × ownRanked)` — the tighter bar that separates Winnable
 *  from Reach.
 *
 *  The strict inequality `winnableBar(r) < qualifyingBar(r)` holds for
 *  every `ownRanked >= 0` and is asserted as a property, not assumed: it is
 *  the only reason the Reach band is reachable at all, and it is what would
 *  catch someone raising `WINNABILITY.nearFloor` to the qualifying floor. */
export function winnableBar(ownRanked: number): number {
  return Math.max(WINNABILITY.nearFloor, WINNABILITY.nearMultiple * ownRanked);
}

// The demand side of the right-sizing law (SPEC §6, 2026-09-16, #779). The
// same shape as the two bars above, over a search's monthly volume instead
// of a rival's ranked count: a search bigger than this is outsized for the
// site, however small the domains that rank for it today.

/** `max(300, 10 × ownRanked)` searches a month — the most demand a target
 *  may carry and still be offered at all. */
export function qualifyingDemand(ownRanked: number): number {
  return Math.max(WINNABILITY.demandFloor, WINNABILITY.demandMultiple * ownRanked);
}

/** `max(100, 2 × ownRanked)` searches a month — the demand under which a
 *  target is Winnable rather than Reach, so a small site's ranking prefers
 *  its small, specific searches. */
export function winnableDemand(ownRanked: number): number {
  return Math.max(WINNABILITY.demandNearFloor, WINNABILITY.demandNearMultiple * ownRanked);
}

// The difficulty side (SPEC §6, owner walk 2026-09-17, issue 858). Volume
// alone let a 1 000/mo head term owned by zapier.com through for a site
// ranking for three keywords; the vendor's keyword difficulty is the
// measurement of how hard that top ten is, and it scales with the site's
// footprint on a log scale because the vendor's own score is one.

function difficultyBar(floor: number, ownRanked: number): number {
  const scaled = floor + WINNABILITY.difficultyPerDecade * Math.log10(1 + Math.max(0, ownRanked));
  return Math.min(WINNABILITY.difficultyMax, Math.round(scaled));
}

/** `30 + 10 × log10(1 + ownRanked)`, at most 100 — the hardest search (by
 *  the vendor's 0–100 keyword difficulty) a site may be offered at all. */
export function difficultyCeiling(ownRanked: number): number {
  return difficultyBar(WINNABILITY.difficultyFloor, ownRanked);
}

/** `15 + 10 × log10(1 + ownRanked)`, at most 100 — the difficulty under
 *  which a search is Winnable rather than Reach. */
export function winnableDifficulty(ownRanked: number): number {
  return difficultyBar(WINNABILITY.difficultyNearFloor, ownRanked);
}
