// BUILD §7 — qualifying, and the three bands.
//
// §7: "a Write target qualifies only if its top-10 contains at least one
// domain whose ranked count ≤ max(500, 5× customer's). Bands
// (Winnable/Reach/Not-yet)".
//
// Only a `measured` or `zero` count can satisfy a bar (see `counts.ts`).
// An all-`unmeasured` top ten therefore does not qualify — and the caller
// must be able to tell that case from a top ten of large rivals, because
// the two mean different things: one is a market we could not read, the
// other a market we read and found too hard. `assess()` returns which.
import type { Measured } from "@/lib/measure/measured";
import type { Winnability } from "../types";
import { qualifyingBar, winnableBar } from "./bars";

/** A count that may be compared against a bar at all. `zero` counts — a
 *  domain that ranks for nothing — are real values and are the smallest
 *  possible, so they satisfy every bar. */
function comparable(count: Measured<number>): number | null {
  return count.kind === "unmeasured" ? null : count.value;
}

function smallestComparable(counts: readonly Measured<number>[]): number | null {
  let smallest: number | null = null;
  for (const count of counts) {
    const value = comparable(count);
    if (value === null) continue;
    if (smallest === null || value < smallest) smallest = value;
  }
  return smallest;
}

/** True where at least one top-ten domain has a readable ranked count at or
 *  under the qualifying bar. */
export function qualifies(a: {
  top10RankedCounts: readonly Measured<number>[];
  ownRanked: number;
}): boolean {
  const smallest = smallestComparable(a.top10RankedCounts);
  return smallest !== null && smallest <= qualifyingBar(a.ownRanked);
}

/**
 * The band. `winnable` where the smallest readable count clears the tighter
 * bar, `reach` where it clears only the qualifying bar, `not-yet`
 * otherwise — including a top ten we could not read at all, which is a
 * `not-yet` for the caller and an `unmeasured_top10` rejection for the
 * counter. `assess()` is the call that keeps those two apart.
 */
export function bandWinnability(a: {
  top10RankedCounts: readonly Measured<number>[];
  ownRanked: number;
}): Winnability {
  const smallest = smallestComparable(a.top10RankedCounts);
  if (smallest === null) return "not-yet";
  if (smallest <= winnableBar(a.ownRanked)) return "winnable";
  if (smallest <= qualifyingBar(a.ownRanked)) return "reach";
  return "not-yet";
}

/** Why a target did not qualify, or the band it qualified into. One call,
 *  so a derivation never has to decide for itself which of the two
 *  rejection counters a failure belongs in. */
export type Assessment =
  | { qualified: true; band: Winnability }
  | { qualified: false; because: "not_yet" | "unmeasured_top10" };

export function assess(a: {
  top10RankedCounts: readonly Measured<number>[];
  ownRanked: number;
}): Assessment {
  const smallest = smallestComparable(a.top10RankedCounts);
  if (smallest === null) return { qualified: false, because: "unmeasured_top10" };
  if (!qualifies(a)) return { qualified: false, because: "not_yet" };
  return { qualified: true, band: bandWinnability(a) };
}
