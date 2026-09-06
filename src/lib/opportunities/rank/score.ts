// BUILD §7 — `demand × intent × (1−effort) × fit`, one list.
//
// §7 fixes the shape of the product and no term's scale. The four scales
// below are this module's, each with its derivation:
//
//   demand  `min(1, log10(volume + 1) / DEMAND_LOG_DIVISOR)` — log-scaled
//           for the reason §6.7 gives for the selection score ("volume
//           enters log-scaled so it breaks ties inside an intent class
//           rather than steamrolling across classes"). The divisor puts
//           100,000/mo at 1.0, above any volume the market set carries, so
//           the term saturates rather than clips. An `unmeasured` volume
//           gives 0 — never a default, never a guess.
//   intent  `intentWeight(query, profile) / max(intentWeights)`, reusing
//           §6.7's own classifier. One classification in the product, not
//           two: the intent a search is ranked by is the intent it was
//           selected by. The divisor is read off `SELECTION.intentWeights`
//           rather than written as a number, so a re-weighting there
//           cannot leave a stale scale here.
//   effort  `EFFORT_BY_TYPE`, the pinned per-type table. `unblock` has no
//           entry because it is never ranked.
//   fit     `FIT_WEIGHT`, where `not-yet` weighs 0 — so the formula cannot
//           surface a target the winnability rule bars, even if a caller
//           passes one.
//
// Nothing here is stored. The order is computed on every read, which is
// what makes retuning a constants edit rather than a backfill over rows
// whose evidence has not changed.
import { DEMAND_LOG_DIVISOR, EFFORT_BY_TYPE, FIT_WEIGHT, SELECTION } from "@/lib/config/constants";
import { intentWeight } from "@/lib/market/questions/select";
import type { Profile } from "@/lib/market/questions/profile";
import type { Measured } from "@/lib/measure/measured";
import type { OpportunityType, Winnability } from "../types";

/** The largest weight the intent classifier can return, read off the pin
 *  itself. A second copy of "3" here is exactly the drift `SELECTION` was
 *  centralised to prevent. */
const INTENT_WEIGHT_MAX = Math.max(...Object.values(SELECTION.intentWeights));

/** 0 for an unmeasured volume: a search whose demand we could not read
 *  contributes no demand, rather than an average one. */
export function demandTerm(volume: Measured<number> | null): number {
  if (volume === null || volume.kind === "unmeasured") return 0;
  return Math.min(1, Math.log10(volume.value + 1) / DEMAND_LOG_DIVISOR);
}

export function intentTerm(query: string, profile: Profile): number {
  return intentWeight(query, profile) / INTENT_WEIGHT_MAX;
}

/** `unblock` has no effort weight and is never ranked; `effortTerm` is
 *  total over the seven that are, and returns `null` for the eighth so a
 *  caller cannot accidentally score one. */
export function effortTerm(type: OpportunityType): number | null {
  if (type === "unblock") return null;
  return EFFORT_BY_TYPE[type];
}

export function fitTerm(fit: Winnability): number {
  return FIT_WEIGHT[fit];
}

/**
 * One score, in `[0, 1]`. Returns 0 for an `unblock` — it takes no
 * publishing day and consumes no supply, so it has no place in the one
 * list — and callers exclude it before ranking rather than relying on the
 * zero.
 *
 * `profile` is required and has no default: the own-brand drop set and the
 * relevance vocabulary are the profile's, so an intent weight derived
 * without one would be a second classifier.
 */
export function rankScore(a: {
  volume: Measured<number> | null;
  query: string;
  type: OpportunityType;
  fit: Winnability;
  profile: Profile;
}): number {
  const effort = effortTerm(a.type);
  if (effort === null) return 0;
  return demandTerm(a.volume) * intentTerm(a.query, a.profile) * (1 - effort) * fitTerm(a.fit);
}
