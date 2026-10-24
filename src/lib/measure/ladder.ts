// How far a page has got toward being found.
//
// published → crawled → indexed → impressions → best place → cited
//
// Each step is read from a stored row and nothing else: the page's weekly
// reading (`./page-reading.ts`) and the verified crawler hits counted on it. A
// step has three answers. `true` or a figure: proved. `false`: a source
// that would show it was read and does not show it yet. `null`: nothing
// ReachKit reads can tell, and the step is not drawn. "Not verified" is
// never "not indexed".
//
// Pure. The screens read it; the weekly pass writes the reading.
import type { EngineReading, PageReading, PlaceSource } from "./page-reading";

export interface Ladder {
  crawled: boolean | null;
  indexed: boolean | null;
  impressions: number | null;
  /** Seen in a search: a place on its own search, or an impression. */
  showing: boolean | null;
  /** The page's place on its own search, from the reading. */
  bestPlace: number | null;
  /** Where that place was read: its own Google result, the keyword
   *  database's estimate, or Search Console. */
  placeSource: PlaceSource | null;
  cited: boolean | null;
}

/**
 * One page's ladder. `crawls` is the verified crawler hits counted on it,
 * or `null` where none can be counted (a page ReachKit does not serve).
 */
export function ladderOf(reading: PageReading | null, crawls: number | null): Ladder {
  const engines = [reading?.google, reading?.bing].filter((e): e is EngineReading => e != null);
  const impressions = engines.length === 0 ? null : engines.reduce((sum, e) => sum + e.impressions, 0);

  const crawledProved =
    reading?.crawled === true || (crawls ?? 0) > 0 || engines.some((e) => e.lastCrawl !== null);
  const crawled = crawledProved ? true : crawls !== null || engines.length > 0 ? false : null;

  const inspected = reading?.google?.indexed ?? null;
  const seen = reading?.reached.showing !== undefined || (impressions ?? 0) > 0;
  const indexed = inspected === true || seen ? true : inspected === false ? false : null;
  const showing = reading?.place != null || (impressions ?? 0) > 0 ? true : impressions === null ? null : false;

  return {
    crawled,
    indexed,
    impressions,
    showing,
    bestPlace: reading?.place == null ? null : Math.round(reading.place.value),
    placeSource: reading?.place?.source ?? null,
    cited: reading?.linkedBy == null ? null : reading.linkedBy.length > 0,
  };
}

/** Overview's Content tile: how many live pages reached each step. A step
 *  no page can be read on is `null` and not drawn. */
export interface LadderTotals {
  crawled: number | null;
  indexed: number | null;
  impressions: number | null;
  bestPlace: number | null;
  cited: number | null;
}

export function ladderTotals(ladders: readonly Ladder[]): LadderTotals {
  const count = (step: "crawled" | "indexed" | "cited"): number | null =>
    ladders.some((l) => l[step] !== null) ? ladders.filter((l) => l[step] === true).length : null;
  const shown = ladders.map((l) => l.impressions).filter((n): n is number => n !== null);
  const places = ladders.map((l) => l.bestPlace).filter((p): p is number => p !== null);
  return {
    crawled: count("crawled"),
    indexed: count("indexed"),
    impressions: shown.length === 0 ? null : shown.reduce((a, b) => a + b, 0),
    bestPlace: places.length === 0 ? null : Math.min(...places),
    cited: count("cited"),
  };
}
