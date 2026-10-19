// Issue 1553 — how far a page has got toward being found.
//
// published → crawled → indexed → impressions → best place → cited
//
// Each step is read from a stored row and nothing else: the page's weekly
// `search_reading` (Search Console, Bing, issue 1538's `seen`, the AI
// answers that cited it) and the verified crawler hits counted on it. A
// step has three answers. `true` or a figure: proved. `false`: a source
// that would show it was read and does not show it yet. `null`: nothing
// ReachKit reads can tell, and the step is not drawn. "Not verified" is
// never "not indexed".
//
// Pure. The screens read it; the weekly pass writes the reading.

/** `publications.search_reading`, as the weekly pass writes it. */
export interface SearchReading {
  at: string;
  /** A verified Googlebot or Bingbot hit was counted on the page. */
  crawled: boolean;
  /** Issue 1538: a stored SERP or ranked row held the page. */
  seen: boolean;
  /** A stored AI answer to the page's own question cited the page; `null`
   *  where no answer to it is stored. */
  cited: boolean | null;
  google: EngineReading | null;
  bing: EngineReading | null;
}

export interface EngineReading {
  /** URL Inspection's verdict; `null` where the engine states none. */
  indexed: boolean | null;
  lastCrawl: string | null;
  impressions: number;
  clicks: number;
  /** The best place the page was shown at over the window, by query. */
  bestPlace: number | null;
  bestQuery: string | null;
}

export interface Ladder {
  crawled: boolean | null;
  indexed: boolean | null;
  impressions: number | null;
  bestPlace: number | null;
  cited: boolean | null;
}

function engineOf(value: unknown): EngineReading | null {
  const e = value as Partial<EngineReading> | null | undefined;
  if (typeof e !== "object" || e === null || typeof e.impressions !== "number") return null;
  return {
    indexed: typeof e.indexed === "boolean" ? e.indexed : null,
    lastCrawl: typeof e.lastCrawl === "string" ? e.lastCrawl : null,
    impressions: e.impressions,
    clicks: typeof e.clicks === "number" ? e.clicks : 0,
    bestPlace: typeof e.bestPlace === "number" ? e.bestPlace : null,
    bestQuery: typeof e.bestQuery === "string" ? e.bestQuery : null,
  };
}

/** The stored JSON, read defensively; `null` for a page never read. */
export function readingOf(value: unknown): SearchReading | null {
  const r = value as Partial<SearchReading> | null | undefined;
  if (typeof r !== "object" || r === null || typeof r.at !== "string") return null;
  return {
    at: r.at,
    crawled: r.crawled === true,
    seen: r.seen === true,
    cited: typeof r.cited === "boolean" ? r.cited : null,
    google: engineOf(r.google),
    bing: engineOf(r.bing),
  };
}

/**
 * One page's ladder. `crawls` is the verified crawler hits counted on it,
 * or `null` where none can be counted (a page ReachKit does not serve).
 */
export function ladderOf(reading: SearchReading | null, crawls: number | null): Ladder {
  const engines = [reading?.google, reading?.bing].filter((e): e is EngineReading => e != null);
  const impressions = engines.length === 0 ? null : engines.reduce((sum, e) => sum + e.impressions, 0);
  const places = engines.map((e) => e.bestPlace).filter((p): p is number => p !== null);

  const crawledProved =
    reading?.crawled === true || (crawls ?? 0) > 0 || engines.some((e) => e.lastCrawl !== null);
  const crawled = crawledProved ? true : crawls !== null || engines.length > 0 ? false : null;

  const inspected = reading?.google?.indexed ?? null;
  const indexed = inspected === true || reading?.seen === true || (impressions ?? 0) > 0 ? true : inspected === false ? false : null;

  return {
    crawled,
    indexed,
    impressions,
    bestPlace: places.length === 0 ? null : Math.round(Math.min(...places)),
    cited: reading?.cited ?? null,
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
