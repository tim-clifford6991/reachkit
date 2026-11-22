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
import { googleRead, type PageReading, type PlaceSource } from "./page-reading";

/** Where a live page stands with Google: added (indexed), shown in a search, on Google (either),
 *  and checked (any part read). `null` is a part nothing read; one definition for every screen. */
export interface GoogleState {
  added: boolean | null;
  shown: boolean | null;
  on: boolean;
  checked: boolean;
}

/** `serpRead`: the latest healthy pass read the page's own search's result page. */
export function googleStateOf(reading: Pick<PageReading, "place" | "variants" | "google"> | null, serpRead: boolean): GoogleState {
  const read = googleRead(reading?.google);
  const indexed = reading?.google?.indexed;
  const added = typeof indexed === "boolean" ? indexed : null;
  const seen = reading != null && (reading.place !== null || reading.variants.length > 0 || (read?.impressions ?? 0) > 0);
  const shown = seen ? true : read !== null || serpRead ? false : null;
  const on = added === true || shown === true;
  return { added, shown, on, checked: on || added !== null || read !== null || serpRead };
}

/** The first reading date the page was on Google; a page shown before the date was kept counts from then. */
export function onGoogleSince(reading: Pick<PageReading, "reached"> | null | undefined): string | null {
  const dates = [reading?.reached.onGoogle, reading?.reached.showing].filter((at): at is string => at !== undefined);
  return dates.length === 0 ? null : dates.reduce((a, b) => (Date.parse(a) <= Date.parse(b) ? a : b));
}

export interface Ladder {
  crawled: boolean | null;
  indexed: boolean | null;
  impressions: number | null;
  /** Shown in a search (`googleStateOf`). */
  showing: boolean | null;
  /** The page's place on its own search, from the reading. */
  bestPlace: number | null;
  /** Where that place was read: its own Google result, the keyword
   *  database's estimate, or Search Console. */
  placeSource: PlaceSource | null;
  cited: boolean | null;
}

/**
 * One page's ladder. `crawls` is the verified Googlebot hits counted on it,
 * or `null` where none can be counted (a page ReachKit does not serve).
 */
export function ladderOf(reading: PageReading | null, crawls: number | null): Ladder {
  const google = googleRead(reading?.google);
  const impressions = google === null ? null : google.impressions;

  const crawledProved = reading?.googlebot === true || (crawls ?? 0) > 0 || reading?.google?.lastCrawl != null;
  const crawled = crawledProved ? true : crawls !== null || google !== null ? false : null;

  const state = googleStateOf(reading, false);

  return {
    crawled,
    indexed: state.added,
    impressions,
    showing: state.shown,
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
