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
//
// Right-sizing (SPEC §6, 2026-09-16, #779): the bars above measure the
// competition against the site's own footprint; `demandBand` measures the
// search itself against it. A target's band is the lower of the two, and a
// search above the demand ceiling is outsized for the site — `assess()`
// refuses it as `not_yet` before the competition is read at all.
//
// Difficulty (SPEC §6, owner walk 2026-09-17, issue 858): the vendor's own
// keyword difficulty for the search, where it gave one. Above the site's
// difficulty ceiling the search is outsized, like a search too big. At or
// under it, difficulty is a measurement of that very top ten — so it bands
// the competition where the top ten's ranked counts could not be read (the
// small domains of a long-tail SERP are never sized), and a top ten of
// giants whose pages are weak for this search is not read as unwinnable.
import type { Measured } from "@/lib/measure/measured";
import type { Winnability } from "../types";
import { difficultyCeiling, qualifyingBar, qualifyingDemand, winnableBar, winnableDemand, winnableDifficulty } from "./bars";

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

/** The demand band of one search for this site: `winnable` at or under
 *  `winnableDemand`, `reach` at or under `qualifyingDemand`, `not-yet` — a
 *  search outsized for the site — above it. */
export function demandBand(a: { volume: number; ownRanked: number }): Winnability {
  if (a.volume <= winnableDemand(a.ownRanked)) return "winnable";
  if (a.volume <= qualifyingDemand(a.ownRanked)) return "reach";
  return "not-yet";
}

/** The difficulty band of one search for this site, or `null` where the
 *  vendor gave no difficulty: `winnable` at or under `winnableDifficulty`,
 *  `reach` at or under `difficultyCeiling`, `not-yet` above it. */
export function difficultyBand(a: { difficulty?: number | null; ownRanked: number }): Winnability | null {
  if (a.difficulty === undefined || a.difficulty === null) return null;
  if (a.difficulty <= winnableDifficulty(a.ownRanked)) return "winnable";
  if (a.difficulty <= difficultyCeiling(a.ownRanked)) return "reach";
  return "not-yet";
}

const ORDER: readonly Winnability[] = ["not-yet", "reach", "winnable"];

function lower(a: Winnability, b: Winnability): Winnability {
  return ORDER.indexOf(a) <= ORDER.indexOf(b) ? a : b;
}

function higher(a: Winnability, b: Winnability): Winnability {
  return ORDER.indexOf(a) >= ORDER.indexOf(b) ? a : b;
}

/** The competition band: the top ten's ranked counts, raised by the
 *  search's own difficulty where the vendor measured one. */
function competitionBand(a: {
  top10RankedCounts: readonly Measured<number>[];
  ownRanked: number;
  difficulty?: number | null;
}): Winnability {
  const counts = bandWinnability(a);
  const difficulty = difficultyBand(a);
  return difficulty === null ? counts : higher(counts, difficulty);
}

/** A target's right-sized band: the lower of its competition band and its
 *  demand band, so a small top ten does not make a head term winnable for a
 *  site that ranks for nothing. */
export function rightSizedBand(a: {
  top10RankedCounts: readonly Measured<number>[];
  ownRanked: number;
  volume: number;
  difficulty?: number | null;
}): Winnability {
  const band = lower(competitionBand(a), demandBand(a));
  return difficultyBand(a) === "not-yet" ? "not-yet" : band;
}

/** Why a target did not qualify, or the band it qualified into. One call,
 *  so a derivation never has to decide for itself which of the two
 *  rejection counters a failure belongs in.
 *
 *  `outsized` is the search's demand, or its difficulty, above the site's
 *  ceiling. It counts as `not_yet` — the winnability bar was not cleared —
 *  and, unlike the competition bar, it refuses every new target type. */
export type Assessment =
  | { qualified: true; band: Winnability }
  | { qualified: false; because: "outsized" | "not_yet" | "unmeasured_top10" };

export function assess(a: {
  top10RankedCounts: readonly Measured<number>[];
  ownRanked: number;
  volume: number;
  difficulty?: number | null;
}): Assessment {
  if (demandBand(a) === "not-yet") return { qualified: false, because: "outsized" };
  const difficulty = difficultyBand(a);
  if (difficulty === "not-yet") return { qualified: false, because: "outsized" };
  // A measured difficulty inside the ceiling is a reading of this top ten:
  // the search qualifies on it, whatever the counts could or could not say.
  if (difficulty !== null) return { qualified: true, band: rightSizedBand(a) };
  const smallest = smallestComparable(a.top10RankedCounts);
  if (smallest === null) return { qualified: false, because: "unmeasured_top10" };
  if (!qualifies(a)) return { qualified: false, because: "not_yet" };
  return { qualified: true, band: rightSizedBand(a) };
}
