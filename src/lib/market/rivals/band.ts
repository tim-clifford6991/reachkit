// BUILD §6.6 — how big a rival is, against the customer's own count.
//
// The archived plan is WO-086. Two bars and three handles, computed from
// `RIVAL_SIZE_BANDS` and from nothing else: pure, total, no I/O, no clock,
// no throw. It is marked to §6.6 rather than to §7 because what it holds
// is §6.6's law, not §7's list — "every derivation in the product must
// work for a domain that ranks for nothing". §7's winnability sentence
// gives both bars their shape — a floor, or a multiple of the customer's
// own count, whichever is greater — and §6.6's cold-start line names the
// same expression again for winnable targets at a ranked count of zero.
// That shape is why all three bands stay assignable at every customer
// count, zero included, and why the customer's own zero is not a special
// case anywhere below.
//
// **Handles here; words in `BAND_LABELS`** (ADR-001). Nothing in this file
// maps a handle to a word — no string, no label, no `band.rivalSize.*`
// key, and nothing imported from the copy layer. The three rendered words
// exist in the registry already, and their existing is not permission to
// inline a second copy of them here: the registry is the one place they
// can be moved from.
//
// **The band is derived, never stored as an independent column.** Moving a
// boundary re-renders every measurement already stored, with no migration
// and no re-measurement, because `RivalSize` stores the two counts beside
// the band and `size.ts` re-derives from them.
import { RIVAL_SIZE_BANDS } from "@/lib/config/constants";

/** The three internal handles, ordered near → far by measured size. Never
 *  rendered: the rendered terms are `BAND_LABELS.rivalSize`'s, and no term
 *  rendered for a rival's size is a term rendered for a target's
 *  winnability (REQ-096 c9). */
export type RivalSizeBand = "near" | "middle" | "far";

/**
 * REQ-096 c2, as two bars over one pair of counts.
 *
 *   near   : R ≤ max(nearFloor,   nearMultiple   × C)
 *   middle : not near and R ≤ max(middleFloor, middleMultiple × C)
 *   far    : above that
 *
 * Both bars read all four operands from `RIVAL_SIZE_BANDS`, so moving a
 * boundary moves this function and its test together and no number is
 * written twice in the product.
 *
 * The floors are what carry the expression at `C = 0`, and above zero the
 * two multipliers differ, so the bars never coincide: at every customer
 * count, zero included, some rival count falls in each of the three bands.
 * That is REQ-096 c8, and it is a property of the shape rather than of a
 * branch — there is no `ownRanked === 0` arm in this file to get wrong.
 *
 * Monotone in `R` at a fixed `C`: of two rivals measured against the same
 * customer count, the larger never carries a band ordered nearer than the
 * smaller.
 */
export function bandRivalSize(a: { rivalRanked: number; ownRanked: number }): RivalSizeBand {
  const nearBar = Math.max(RIVAL_SIZE_BANDS.nearFloor, RIVAL_SIZE_BANDS.nearMultiple * a.ownRanked);
  if (a.rivalRanked <= nearBar) return "near";

  const middleBar = Math.max(
    RIVAL_SIZE_BANDS.middleFloor,
    RIVAL_SIZE_BANDS.middleMultiple * a.ownRanked
  );
  if (a.rivalRanked <= middleBar) return "middle";

  return "far";
}
