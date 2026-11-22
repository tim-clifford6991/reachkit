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
import { googleStateOf, onGoogleSince } from "./ladder";
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
      depth?: number;
    }[];
  } | null;
  verdict: { measuredAt: Date };
}

/** The deepest place the verdict counts and the first-page line. */
export const TRACKED_DEPTH = 20;
export const FIRST_PAGE_PLACES = 10;
/** The searches a page earns on that its stored reading keeps, and the places a refresh answers them from. */
export const EARNING = Object.freeze({ kept: 20, answered: { min: 8, max: TRACKED_DEPTH }, offered: { min: 8, max: 30, impressions: 5, words: 6 }, reach: 30 } as const);

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
  let deep = false;
  for (const row of report.pageQuestions?.rows ?? []) {
    if (serp !== null || row.organic == null || normalised(row.question.search) !== key) continue;
    serp = row.organic;
    // A result read past the verdict's line says a page absent from it is not there.
    deep = (row.depth ?? VENDOR.serpDepth) >= TRACKED_DEPTH;
  }
  if (report.ownRanked.kind === "unmeasured") {
    if (serp === null) return unmeasured<SearchRows>(report.ownRanked.reason, at);
    return measured<SearchRows>({ serp, ranked: [], complete: deep }, at);
  }
  return measured<SearchRows>({ serp, ranked: rankedRowsFor(report, query), complete: deep || (opts.tracked && rankedComplete(report)) }, at);
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
  /** Added by Google or shown in a search (`googleStateOf`). */
  onGoogle?: string;
  firstPage?: string;
  readByAi?: string;
  linkedByAi?: string;
  aiVisit?: string;
}

/** What URL Inspection says of one page; a field Google leaves out is absent, never "". */
export interface Inspection {
  indexed: boolean;
  lastCrawl: string | null;
  coverageState?: string;
  googleCanonical?: string;
  userCanonical?: string;
}
const INSPECTION_FIELDS = ["coverageState", "googleCanonical", "userCanonical"] as const;
type Stated = Partial<Pick<Inspection, (typeof INSPECTION_FIELDS)[number]>>;

/** The fields of `value` URL Inspection stated, each a non-empty string. */
export function statedOf(value: Record<string, unknown> | null | undefined): Stated {
  return Object.fromEntries(INSPECTION_FIELDS.flatMap((key) => (typeof value?.[key] === "string" && value[key] !== "" ? [[key, value[key]]] : [])));
}

const coverageKey = (google: Stated | null | undefined): string => (google?.coverageState ?? "").toLowerCase().replace(/\s*[-\u2013\u2014]\s*/g, " - ");
/** Google crawled or found the page and keeps it out of the index; `null` where no coverage line was read. */
export function keptOut(google: Stated | null | undefined): boolean | null {
  return google?.coverageState === undefined ? null : /^(crawled|discovered) - currently not indexed$/.test(coverageKey(google));
}
/** Google has not crawled the page: it does not know it, or only found it. */
export const uncrawled = (google: Stated | null | undefined): boolean => /^(discovered - currently not indexed|url is unknown to google)$/.test(coverageKey(google));

export interface EngineReading extends Stated {
  /** URL Inspection's verdict; `null` where the engine states none. */
  indexed: boolean | null;
  lastCrawl: string | null;
  /** Impressions and clicks over the window, anonymised queries included. */
  impressions: number;
  clicks: number;
  /** The best place over the window on the page's own search only. */
  bestPlace: number | null;
  bestQuery: string | null;
  /** Its searches over the window, most impressions first, at most `EARNING.kept`; absent on a reading stored before. */
  queries?: { query: string; impressions: number; clicks: number; position: number }[];
  /** Set where URL Inspection was not read; the figures still stand. */
  unread?: "inspect_unread";
}

/** Why Google was not read for a page this week. */
export const GOOGLE_UNREAD = ["no_credentials", "bad_credentials", "pool_full", "no_token", "verify_refused", "sitemap_refused", "performance_unread", "inspect_unread", "not_in_property", "property_new"] as const;
export type GoogleUnread = (typeof GOOGLE_UNREAD)[number];

/** A reason is not a reading: it carries no impressions, clicks or place, only URL Inspection's facts where they were read. */
export type GoogleReading = EngineReading | ({ unread: GoogleUnread; indexed?: boolean | null; lastCrawl?: string | null } & Stated);

/** The figures of a Google reading, or `null` where it holds only a reason. */
export function googleRead(google: GoogleReading | null | undefined): EngineReading | null {
  return google == null || !("impressions" in google) ? null : google;
}

/** A page's Google reading from its Search Analytics totals (page only), its rows by query and its URL Inspection. */
export function engineReadingOf(
  totals: readonly { page: string; impressions: number; clicks: number }[],
  rows: readonly { page: string; query: string; impressions: number; clicks: number; position: number }[],
  url: string,
  search: string | null,
  inspected: Inspection | null
): EngineReading {
  const own = rows.filter((row) => addressOf(row.page) === addressOf(url));
  const total = totals.filter((row) => addressOf(row.page) === addressOf(url));
  const key = search === null ? null : normalised(search);
  let top: { position: number; query: string } | null = null;
  for (const row of own) if (normalised(row.query) === key && row.position > 0 && (top === null || row.position < top.position)) top = row;
  return {
    indexed: inspected?.indexed ?? null,
    lastCrawl: inspected?.lastCrawl ?? null,
    impressions: total.reduce((sum, row) => sum + row.impressions, 0),
    clicks: total.reduce((sum, row) => sum + row.clicks, 0),
    bestPlace: top === null ? null : Math.round(top.position * 10) / 10,
    bestQuery: top?.query ?? null,
    queries: [...own].sort((x, y) => y.impressions - x.impressions).slice(0, EARNING.kept).map(({ query, impressions, clicks, position }) => ({ query, impressions, clicks, position })),
    ...(inspected === null ? { unread: "inspect_unread" as const } : statedOf({ ...inspected })),
  };
}

/** `publications.search_reading`, as the weekly pass writes it. */
export interface PageReading {
  at: string;
  /** A verified Googlebot hit was counted on the page, ever; `null` on a
   *  reading stored before only Google counted, whose crawl and Found step
   *  may be Bing's and so are not carried forward. */
  googlebot: boolean | null;
  /** This week's place on the page's own search; `null` where no row held it. */
  place: Place | null;
  first: { at: string; place: number } | null;
  best: { place: number; at: string } | null;
  /** The place the reading before this one held, from the same source; `null` where that source did not place it. */
  prev: number | null;
  /** The answer engines whose answer to the page's own question linked it;
   *  `null` where that question was not asked. */
  linkedBy: string[] | null;
  /** AI fetches over the reads kept (28 days); `null` off a hosted page. */
  aiReads: number | null;
  /** Other searches the page was seen on, best first. */
  variants: { query: string; place: number }[];
  reached: Reached;
  google: GoogleReading | null;
  /** The address this page was put back at because Google still showed it; an address is put back once. */
  restored?: string;
  /** Weekly readings in a row whose coverage line kept the page out of the index; absent is none. */
  unindexedWeeks?: number;
  /** When the page, still not crawled a week after going live, was announced again; it is announced again once. */
  reannounced?: string;
}

const REACHED_KEYS = ["found", "showing", "onGoogle", "firstPage", "readByAi", "linkedByAi", "aiVisit"] as const;
const PLACE_SOURCES: readonly PlaceSource[] = ["serp", "labs", "gsc"];
export const VARIANTS_MAX = 3;

const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const isText = (value: unknown): value is string => typeof value === "string";

function engineOf(value: unknown): GoogleReading | null {
  const e = value as Partial<EngineReading> | null | undefined;
  if (typeof e !== "object" || e === null) return null;
  if (!isNumber(e.impressions)) {
    const unread = e.unread as unknown;
    if (!(GOOGLE_UNREAD as readonly unknown[]).includes(unread)) return null;
    if (unread !== "property_new") return { unread: unread as GoogleUnread };
    return { unread, indexed: typeof e.indexed === "boolean" ? e.indexed : null, lastCrawl: isText(e.lastCrawl) ? e.lastCrawl : null, ...statedOf({ ...e }) };
  }
  return {
    ...(e.unread === "inspect_unread" ? { unread: e.unread } : {}),
    indexed: typeof e.indexed === "boolean" ? e.indexed : null,
    lastCrawl: isText(e.lastCrawl) ? e.lastCrawl : null,
    impressions: e.impressions,
    clicks: isNumber(e.clicks) ? e.clicks : 0,
    bestPlace: isNumber(e.bestPlace) ? e.bestPlace : null,
    bestQuery: isText(e.bestQuery) ? e.bestQuery : null,
    ...(Array.isArray(e.queries) ? { queries: e.queries.filter((q) => isText(q?.query) && isNumber(q.impressions) && isNumber(q.clicks) && isNumber(q.position)) } : {}),
    ...statedOf({ ...e }),
  };
}

/** The searches a stored reading holds the page at `EARNING.answered` places on, the one its refresh answers. */
export function answeredQueries(value: unknown): string[] {
  const { min, max } = EARNING.answered;
  return (googleRead(readingOf(value)?.google)?.queries ?? []).filter((q) => q.position >= min && q.position <= max).map((q) => q.query);
}

/** One search Search Console showed the site's live pages on: impressions summed, position their impression-weighted mean. */
export interface EarnedSearch {
  query: string;
  impressions: number;
  position: number;
}

/** The searches the stored readings measured, but a live page's own; a reading `property_new` or unread holds none. */
export function earnedSearches(pages: readonly { reading?: unknown; search?: string | null }[]): EarnedSearch[] {
  const own = new Set(pages.flatMap((page) => (page.search == null ? [] : [normalised(page.search)])));
  const sums = new Map<string, { query: string; impressions: number; weighted: number }>();
  for (const page of pages) {
    for (const row of googleRead(readingOf(page.reading)?.google)?.queries ?? []) {
      const key = normalised(row.query);
      if (own.has(key) || row.impressions <= 0 || row.position <= 0) continue;
      const held = sums.get(key) ?? { query: key, impressions: 0, weighted: 0 };
      sums.set(key, { query: key, impressions: held.impressions + row.impressions, weighted: held.weighted + row.impressions * row.position });
    }
  }
  return [...sums.values()].map(({ query, impressions, weighted }) => ({ query, impressions, position: Math.round((weighted / impressions) * 10) / 10 })).sort((a, b) => b.impressions - a.impressions);
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
    googlebot: typeof r.googlebot === "boolean" ? r.googlebot : null,
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
    ...(isText(r.restored) ? { restored: r.restored } : {}),
    ...(isNumber(r.unindexedWeeks) && r.unindexedWeeks > 0 ? { unindexedWeeks: r.unindexedWeeks } : {}),
    ...(isText(r.reannounced) ? { reannounced: r.reannounced } : {}),
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
  /** A verified Googlebot hit counted on it now. */
  crawled: boolean;
  /** AI fetches and AI visits over the reads kept; `null` off a hosted page. */
  aiReads: number | null;
  aiVisits: number | null;
  google: GoogleReading | null;
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
  const google = googleRead(page.google);
  // Search Console's place counts only on the page's own search.
  if (place === null && google?.bestPlace != null && page.search !== null) {
    place = { value: Math.round(google.bestPlace), source: "gsc", query: page.search };
  }

  // A second read in the same week keeps the week before as `prev`; a place is never differenced across two sources.
  const sameWeek = before !== null && a.now.getTime() - Date.parse(before.at) < WEEK_MS;
  const sameSource = place !== null && before?.place?.source === place.source;
  const prev = !sameSource ? null : sameWeek ? before!.prev : before!.place!.value;
  const best = place !== null && (before?.best == null || place.value < before.best.place) ? { place: place.value, at: nowIso } : (before?.best ?? null);
  const linkedBy = report === null ? null : linkedByIn(report, page.id, page.liveUrl);
  const variants = report === null ? [] : variantsIn(report, page.search, [page.liveUrl]);
  const googlebot = before?.googlebot === true || page.crawled;
  // A week with no coverage line read keeps the count: not measured is not a reset.
  const out = keptOut(page.google);
  const weeksBefore = before?.unindexedWeeks ?? 0;
  const unindexedWeeks = out === null ? weeksBefore : !out ? 0 : sameWeek ? Math.max(weeksBefore, 1) : weeksBefore + 1;

  const state = googleStateOf({ place, variants, google: page.google }, false);
  const now: Record<(typeof REACHED_KEYS)[number], boolean> = {
    found: googlebot || page.google?.lastCrawl != null || page.google?.indexed === true,
    showing: state.shown === true,
    onGoogle: state.on,
    firstPage: place !== null && place.value <= FIRST_PAGE_PLACES,
    readByAi: (page.aiReads ?? 0) > 0,
    linkedByAi: (linkedBy ?? []).length > 0,
    aiVisit: (page.aiVisits ?? 0) > 0,
  };
  const reached: Reached = {};
  for (const key of REACHED_KEYS) {
    const kept = key === "found" && before?.googlebot === null ? undefined : key === "onGoogle" ? (onGoogleSince(before) ?? undefined) : before?.reached[key];
    const at = kept ?? (now[key] ? nowIso : undefined);
    if (at !== undefined) reached[key] = at;
  }

  return {
    at: nowIso,
    googlebot,
    place,
    first: before?.first ?? (place === null ? null : { at: nowIso, place: place.value }),
    best,
    prev,
    linkedBy,
    aiReads: page.aiReads,
    variants,
    reached,
    google: page.google,
    ...(before?.restored === undefined ? {} : { restored: before.restored }),
    ...(unindexedWeeks > 0 ? { unindexedWeeks } : {}),
    ...(before?.reannounced === undefined ? {} : { reannounced: before.reannounced }),
  };
}
