// One page's reading of where it stands in search and in AI answers, stored
// on `publications.search_reading` once a week and read by the Overview
// tiles, the ladder, the verdict and the Monday mail alike.
//
// The place is decided once, here, from stored rows: the page's own Google
// result (the twelve's SERP or its page question's), then the keyword
// database's own ranked rows, then Search Console. Every reader asks this
// file, so a page at #7 on its own result is on the first page everywhere.
//
// Pure. Nothing is bought, and a field nothing measured is `null`, never 0.
import { VENDOR } from "@/lib/config/constants";
import { measured, measuredZero, unmeasured, type Measured } from "./measured";

/** One address a week read on a search, and the place it held. */
export interface PlacedUrl {
  readonly url: string;
  readonly position: number;
}

/**
 * What one week read for one search. `serp` is the page's own Google result
 * (one of the twelve, or its page question's), `null` where none was read;
 * `ranked` is the site's own keyword-database rows for it; `complete` says
 * whether a page in neither holds no place at all.
 */
export interface SearchRows {
  readonly serp: readonly PlacedUrl[] | null;
  readonly ranked: readonly PlacedUrl[];
  readonly complete: boolean;
}

/** An answer cell as the reading reads it: the page addresses it linked. */
interface LinkCell {
  kind: string;
  ownUrls?: readonly string[];
}

/** The parts of a stored report a page's place is read from. Structural, so
 *  the screens that read a reading never load the report's module. */
export interface PlaceReport {
  questions: Measured<readonly { search: { keyword: string } }[]>;
  serps: readonly Measured<{ organic: readonly PlacedUrl[] }>[];
  ownRanked: Measured<number>;
  ownRankedRows: readonly { keyword: string; url: string; position: number }[];
  pageQuestions: {
    rows: readonly {
      publicationId: string;
      question: { search: string };
      cell: LinkCell;
      engines: readonly { engine: string; cell: LinkCell }[];
      organic?: readonly PlacedUrl[] | null;
    }[];
  } | null;
  verdict: { measuredAt: Date };
}

/** The deepest place the verdict counts and the first-page line. */
export const TRACKED_DEPTH = 20;
export const FIRST_PAGE_PLACES = 10;

/** One page's address as two readings of it compare: tracking parameters,
 *  the fragment, the scheme, `www.` and a trailing slash dropped, lower-cased. */
export function addressOf(url: string): string {
  return canonicalUrl(withoutTracking(url));
}

/** The canonical form of an address; a query string stays part of it. */
export function canonicalUrl(url: string): string {
  return url
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/#.*$/, "")
    .replace(/\/+$/, "");
}

function withoutTracking(url: string): string {
  try {
    const parsed = new URL(url);
    for (const key of [...parsed.searchParams.keys()]) if (key.toLowerCase().startsWith("utm_")) parsed.searchParams.delete(key);
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return url;
  }
}

function normalised(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, " ");
}

function rankedRowsFor(report: PlaceReport, query: string): PlacedUrl[] {
  const wanted = normalised(query);
  return (report.ownRankedRows ?? [])
    .filter((row) => normalised(row.keyword) === wanted)
    .map((row) => ({ url: row.url, position: row.position }));
}

/** Whether the ranked rows are every search the site ranks for. */
function rankedComplete(report: PlaceReport): boolean {
  return report.ownRanked.kind !== "unmeasured" && report.ownRanked.value <= (report.ownRankedRows ?? []).length;
}

/**
 * What the week read for one search. One of the twelve reads its SERP;
 * any other reads the Google result bought for a page's own question, then
 * the ranked rows. `tracked` says the keyword database measures the search,
 * so its silence there is a measured zero.
 */
export function searchRowsFor(report: PlaceReport, query: string, opts: { tracked: boolean }): Measured<SearchRows> {
  const at = report.verdict.measuredAt;
  const questions = report.questions.kind === "unmeasured" ? [] : report.questions.value;
  let index = -1;
  questions.forEach((question, i) => {
    if (question.search.keyword === query) index = i;
  });
  if (index !== -1) {
    const serpAt = report.serps[index];
    if (serpAt === undefined) return unmeasured<SearchRows>("not_attempted", at);
    if (serpAt.kind === "unmeasured") return unmeasured<SearchRows>(serpAt.reason, at);
    return measured<SearchRows>(
      {
        serp: serpAt.value.organic.map((row) => ({ url: row.url, position: row.position })),
        ranked: report.ownRanked.kind === "unmeasured" ? [] : rankedRowsFor(report, query),
        // A ten-deep SERP cannot say a page is not at 11–20.
        complete: VENDOR.serpDepth >= TRACKED_DEPTH || rankedComplete(report),
      },
      at
    );
  }

  const key = normalised(query);
  let serp: readonly PlacedUrl[] | null = null;
  for (const row of report.pageQuestions?.rows ?? []) {
    if (serp === null && row.organic != null && normalised(row.question.search) === key) serp = row.organic;
  }
  if (report.ownRanked.kind === "unmeasured") {
    if (serp === null) return unmeasured<SearchRows>(report.ownRanked.reason, at);
    return measured<SearchRows>({ serp, ranked: [], complete: false }, at);
  }
  return measured<SearchRows>({ serp, ranked: rankedRowsFor(report, query), complete: opts.tracked && rankedComplete(report) }, at);
}

/** The page's best row on its own result, else in the ranked rows. */
export function ownPlaceIn(rows: SearchRows, addresses: readonly string[]): { value: number; source: "serp" | "labs" } | null {
  const own = new Set(addresses.map(addressOf));
  const best = (list: readonly PlacedUrl[]): number | null => {
    let found: number | null = null;
    for (const row of list) if (own.has(addressOf(row.url)) && (found === null || row.position < found)) found = row.position;
    return found;
  };
  const serp = best(rows.serp ?? []);
  if (serp !== null) return { value: serp, source: "serp" };
  const labs = best(rows.ranked);
  return labs === null ? null : { value: labs, source: "labs" };
}

/** The page's place as the verdict counts it: a page in no row is a measured
 *  zero where the rows are complete, and not measured where they are not. */
export function placeOf(reading: Measured<SearchRows>, addresses: readonly string[]): Measured<number> {
  if (reading.kind === "unmeasured") return unmeasured<number>(reading.reason, reading.at, reading.because);
  const place = ownPlaceIn(reading.value, addresses);
  if (place !== null) return measured(place.value, reading.at);
  return reading.value.complete ? measuredZero(0, reading.at) : unmeasured<number>("undeterminable", reading.at);
}

/** The search a page is read on: a `top20` test's query, else its topic's. */
export function pageSearchOf(acceptance: unknown, targetQuery: string | null | undefined): string | null {
  const test = acceptance as { form?: unknown; query?: unknown } | null | undefined;
  if (test?.form === "top20" && typeof test.query === "string" && test.query.trim() !== "") return test.query;
  return typeof targetQuery === "string" && targetQuery.trim() !== "" ? targetQuery.trim() : null;
}

// ── The stored reading ────────────────────────────────────────────────────

export type PlaceSource = "serp" | "labs" | "gsc";

export interface Place {
  value: number;
  source: PlaceSource;
  query: string;
}

/** The date each step was first reached; a step not yet reached is absent. */
export interface Reached {
  found?: string;
  showing?: string;
  firstPage?: string;
  readByAi?: string;
  linkedByAi?: string;
  aiVisit?: string;
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

/** `publications.search_reading`, as the weekly pass writes it. */
export interface PageReading {
  at: string;
  /** A verified Googlebot or Bingbot hit was counted on the page, ever. */
  crawled: boolean;
  /** This week's place on the page's own search; `null` where no row held it. */
  place: Place | null;
  first: { at: string; place: number } | null;
  best: { place: number; at: string } | null;
  /** The place the reading before this one held. */
  prev: number | null;
  /** The answer engines whose answer to the page's own question linked it;
   *  `null` where that question was not asked. */
  linkedBy: string[] | null;
  /** AI fetches over the reads kept (28 days); `null` off a hosted page. */
  aiReads: number | null;
  /** Other searches the page was seen on, best first. */
  variants: { query: string; place: number }[];
  reached: Reached;
  google: EngineReading | null;
  bing: EngineReading | null;
}

const REACHED_KEYS = ["found", "showing", "firstPage", "readByAi", "linkedByAi", "aiVisit"] as const;
const PLACE_SOURCES: readonly PlaceSource[] = ["serp", "labs", "gsc"];
export const VARIANTS_MAX = 3;

const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const isText = (value: unknown): value is string => typeof value === "string";

function engineOf(value: unknown): EngineReading | null {
  const e = value as Partial<EngineReading> | null | undefined;
  if (typeof e !== "object" || e === null || !isNumber(e.impressions)) return null;
  return {
    indexed: typeof e.indexed === "boolean" ? e.indexed : null,
    lastCrawl: isText(e.lastCrawl) ? e.lastCrawl : null,
    impressions: e.impressions,
    clicks: isNumber(e.clicks) ? e.clicks : 0,
    bestPlace: isNumber(e.bestPlace) ? e.bestPlace : null,
    bestQuery: isText(e.bestQuery) ? e.bestQuery : null,
  };
}

/** The stored JSON, read defensively; `null` for a page never read. */
export function readingOf(value: unknown): PageReading | null {
  const r = value as Record<string, unknown> | null | undefined;
  if (typeof r !== "object" || r === null || !isText(r.at)) return null;
  const place = r.place as Partial<Place> | null | undefined;
  const first = r.first as { at?: unknown; place?: unknown } | null | undefined;
  const best = r.best as { at?: unknown; place?: unknown } | null | undefined;
  const reached: Reached = {};
  const storedReached = (typeof r.reached === "object" && r.reached !== null ? r.reached : {}) as Record<string, unknown>;
  for (const key of REACHED_KEYS) {
    const at = storedReached[key];
    if (isText(at)) reached[key] = at;
  }
  return {
    at: r.at,
    crawled: r.crawled === true,
    place:
      place != null && isNumber(place.value) && PLACE_SOURCES.includes(place.source as PlaceSource) && isText(place.query)
        ? { value: place.value, source: place.source as PlaceSource, query: place.query }
        : null,
    first: first != null && isText(first.at) && isNumber(first.place) ? { at: first.at, place: first.place } : null,
    best: best != null && isText(best.at) && isNumber(best.place) ? { place: best.place, at: best.at } : null,
    prev: isNumber(r.prev) ? r.prev : null,
    linkedBy: Array.isArray(r.linkedBy) ? r.linkedBy.filter(isText) : null,
    aiReads: isNumber(r.aiReads) ? r.aiReads : null,
    variants: Array.isArray(r.variants)
      ? r.variants
          .filter((v): v is { query: string; place: number } => isText((v as { query?: unknown })?.query) && isNumber((v as { place?: unknown })?.place))
          .slice(0, VARIANTS_MAX)
      : [],
    reached,
    google: engineOf(r.google),
    bing: engineOf(r.bing),
  };
}

/** The answer engines whose answer to the page's own question linked its
 *  address; `null` where the report asked no question for the page. */
export function linkedByIn(report: Pick<PlaceReport, "pageQuestions"> | null, publicationId: string, liveUrl: string): string[] | null {
  const rows = (report?.pageQuestions?.rows ?? []).filter((row) => row.publicationId === publicationId);
  if (rows.length === 0) return null;
  const page = addressOf(liveUrl);
  const engines = new Set<string>();
  for (const row of rows) {
    const cells = row.engines.length === 0 ? [{ engine: "ai_overview", cell: row.cell }] : row.engines;
    for (const { engine, cell } of cells) {
      const urls = cell.kind === "answered" ? (cell.ownUrls ?? []) : [];
      if (urls.some((url) => addressOf(url) === page)) engines.add(engine);
    }
  }
  return [...engines];
}

/** The other searches the page holds a row on, best place first. */
function variantsIn(report: PlaceReport, search: string | null, addresses: readonly string[]): { query: string; place: number }[] {
  const own = new Set(addresses.map(addressOf));
  const skip = search === null ? null : normalised(search);
  const best = new Map<string, { query: string; place: number }>();
  const add = (query: string, url: string, place: number): void => {
    const key = normalised(query);
    if (key === skip || !own.has(addressOf(url))) return;
    const held = best.get(key);
    if (held === undefined || place < held.place) best.set(key, { query, place });
  };
  const questions = report.questions.kind === "unmeasured" ? [] : report.questions.value;
  questions.forEach((question, i) => {
    const serp = report.serps[i];
    if (serp?.kind !== "unmeasured") for (const row of serp?.value.organic ?? []) add(question.search.keyword, row.url, row.position);
  });
  for (const row of report.pageQuestions?.rows ?? []) for (const hit of row.organic ?? []) add(row.question.search, hit.url, hit.position);
  for (const row of report.ownRankedRows ?? []) add(row.keyword, row.url, row.position);
  return [...best.values()].sort((a, b) => a.place - b.place || a.query.localeCompare(b.query)).slice(0, VARIANTS_MAX);
}

/** What the weekly pass knows of one page beside the stored report. */
export interface PageFacts {
  id: string;
  liveUrl: string;
  /** The search the page is read on; `null` where it has none. */
  search: string | null;
  /** A verified search-engine crawler hit counted on it now. */
  crawled: boolean;
  /** AI fetches and AI visits over the reads kept; `null` off a hosted page. */
  aiReads: number | null;
  aiVisits: number | null;
  google: EngineReading | null;
  bing: EngineReading | null;
}

const WEEK_MS = 6 * 86_400_000;

/**
 * This week's reading of one page, carried forward from the one before it:
 * the first place, the best place and every step's first date are kept,
 * since the rows behind them are not kept for ever.
 */
export function assembleReading(a: { before: PageReading | null; report: PlaceReport | null; page: PageFacts; now: Date }): PageReading {
  const { before, report, page } = a;
  const nowIso = a.now.toISOString();

  let place: Place | null = null;
  if (report !== null && page.search !== null) {
    const rows = searchRowsFor(report, page.search, { tracked: false });
    const own = rows.kind === "unmeasured" ? null : ownPlaceIn(rows.value, [page.liveUrl]);
    if (own !== null) place = { value: own.value, source: own.source, query: page.search };
  }
  if (place === null && page.google?.bestPlace != null) {
    place = { value: Math.round(page.google.bestPlace), source: "gsc", query: page.google.bestQuery ?? page.search ?? "" };
  }

  // A second read in the same week keeps the week before as `prev`.
  const sameWeek = before !== null && a.now.getTime() - Date.parse(before.at) < WEEK_MS;
  const prev = sameWeek ? before.prev : (before?.place?.value ?? null);
  const best = place !== null && (before?.best == null || place.value < before.best.place) ? { place: place.value, at: nowIso } : (before?.best ?? null);
  const linkedBy = report === null ? null : linkedByIn(report, page.id, page.liveUrl);
  const variants = report === null ? [] : variantsIn(report, page.search, [page.liveUrl]);
  const crawled = before?.crawled === true || page.crawled;
  const impressions = (page.google?.impressions ?? 0) + (page.bing?.impressions ?? 0);

  const now: Record<(typeof REACHED_KEYS)[number], boolean> = {
    found: crawled || page.google?.lastCrawl != null || page.bing?.lastCrawl != null || page.google?.indexed === true,
    showing: place !== null || variants.length > 0 || impressions > 0,
    firstPage: place !== null && place.value <= FIRST_PAGE_PLACES,
    readByAi: (page.aiReads ?? 0) > 0,
    linkedByAi: (linkedBy ?? []).length > 0,
    aiVisit: (page.aiVisits ?? 0) > 0,
  };
  const reached: Reached = {};
  for (const key of REACHED_KEYS) {
    const at = before?.reached[key] ?? (now[key] ? nowIso : undefined);
    if (at !== undefined) reached[key] = at;
  }

  return {
    at: nowIso,
    crawled,
    place,
    first: before?.first ?? (place === null ? null : { at: nowIso, place: place.value }),
    best,
    prev,
    linkedBy,
    aiReads: page.aiReads,
    variants,
    reached,
    google: page.google,
    bing: page.bing,
  };
}
