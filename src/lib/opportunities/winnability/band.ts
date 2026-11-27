// BUILD §7 — qualifying, and the three bands.
//
// §7: "a Write target qualifies only if its top-10 contains at least one
// domain whose ranked count ≤ max(500, 5× customer's). Bands
// (Winnable/Reach/Not-yet)".
//
// Only a `measured` or `zero` count can satisfy a bar (see `counts.ts`), so an
// all-`unmeasured` top ten does not qualify; `assess()` says which of the two it was.
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

/** The smallest count a bar can be compared against; a `zero` count is real and satisfies every bar. */
function smallestComparable(counts: readonly Measured<number>[]): number | null {
  const values = counts.flatMap((count) => (count.kind === "unmeasured" ? [] : [count.value]));
  return values.length === 0 ? null : Math.min(...values);
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

/** The band: `winnable` where the smallest readable count clears the tighter bar, `reach` the qualifying one,
 *  `not-yet` otherwise, a top ten nobody could read included. */
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
 *  ceiling. Neither failure drops a target: `bandOf` gives the band it ranks in. */
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

/** The band an assessed target ranks in: below the bars, or over a top ten nobody could size, it ranks last with the outsized. */
export function bandOf(verdict: Assessment): Winnability {
  return verdict.qualified ? verdict.band : "not-yet";
}
