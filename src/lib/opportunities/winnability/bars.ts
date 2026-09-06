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
// The four numbers are `WINNABILITY`'s and are imported, never restated.
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
