// BUILD §6.3 — the product types the closed endpoint list returns
// Product types, not vendor payload shapes; each endpoint's parser lives beside it and parses into these.

/** `rankedKeywords` — one keyword the domain ranks for. */
export interface RankedRow {
  keyword: string;
  position: number;
  searchVolume: number;
  url: string;
  /** The vendor's keyword difficulty, 0–100, where it gave one. Absent on an older cached row. */
  difficulty?: number | null;
  /** The ranking page's title and snippet (SPEC §2): the market is read from these where bot protection kept the
   *  reader off the site. Only on rows bought with `listing`, where the vendor gave one. */
  title?: string;
  description?: string;
}

/** `keywordOverview` — one keyword the vendor holds data for, as it spells
 *  it (lower case). A keyword it has nothing for has no row. */
export interface KeywordVolumeRow {
  keyword: string;
  searchVolume: number;
}

/** `keywordSuggestions` — one keyword DataForSEO returns for a seed term. */
export interface SuggestionRow {
  keyword: string;
  searchVolume: number;
  /** `keyword_properties.keyword_difficulty`: difficulty of reaching the top 10, 0–100 on a log scale. `null` where the
   *  vendor gave none; absent on an older cached row. */
  difficulty?: number | null;
}

/** The monthly search volume a `keywordSuggestions` call buys between,
 *  both ends inclusive: the vendor filters and orders by it, so
 *  the rows returned are the largest right-sized ones rather than the
 *  seed's top rows by volume. */
export interface VolumeWindow {
  min: number;
  max: number;
  /** The hardest keyword difficulty bought. A row the vendor
   *  gives no difficulty is still bought. */
  maxDifficulty: number;
}

/** `competitorsDomain` — one domain DataForSEO names as a search competitor. */
export interface CompetitorRow {
  domain: string;
  overlapKeywords: number;
  /** `full_domain_metrics.organic.count`: how many organic SERPs hold the domain, its footprint, where the vendor gave it. */
  rankedCount?: number;
  /** The same count for the target itself, which the vendor lists as its
   *  own first competitor — the footprint the competitor is banded against. */
  ownRankedCount?: number;
}

/** One organic result inside a `SerpResult`'s top 10 (depth 10, fixed by
 *  `transport.ts`, never a caller argument). */
export interface SerpOrganicRow {
  position: number;
  domain: string;
  url: string;
  title: string;
}

/** The AI Overview element of one SERP, if Google served one. Not cosmetic: `serpOrganic`'s `settleCents` reads
 *  `asynchronousAiOverview` to settle the base price or the surcharge. */
export interface SerpAiOverview {
  /** `false` when Google served no AI Overview at all on this SERP. */
  present: boolean;
  /** DataForSEO's own `asynchronous_ai_overview` flag on the response
   *  element — meaningless when `present` is `false`. */
  asynchronousAiOverview: boolean;
  /** The domains the AI Overview cited, in the order DataForSEO returned
   *  them. Empty when `present` is `false`. */
  referenceDomains: readonly string[];
  /** The addresses it cited, in the vendor's order. Absent on an older stored response, which says nothing about them. */
  referenceUrls?: readonly string[];
  /** The answer's text, cut at `AI_OVERVIEW_TEXT_MAX_CHARS`: a brand named without a link is read from it. Absent on an
   *  older stored response, which says nothing about whom it named. */
  text?: string;
  /** Google loads this overview after the page and this read did not buy that load, so whom it names is not known.
   *  Never an answer that names nobody. */
  unread?: true;
}

/** `serpOrganic` — organic top-10 **and** the `ai_overview` item with its
 *  reference domains: the free AI matrix rides here at 0¢ extra. */
export interface SerpResult {
  organic: readonly SerpOrganicRow[];
  aiOverview: SerpAiOverview;
  /** SPEC §2: when the cache's `fetches` row was bought, where another pass bought it; absent means this pass paid.
   *  On the result because the stored report carries the result and must say where its answers came from. */
  reusedFrom?: string;
  /** Google's "People also ask" questions on this SERP, in its order (SPEC
   *  §7, D61). Absent where it showed none, and on a SERP
   *  stored before they were read — which is why a caller that needs them
   *  buys under a key of its own (`serpOrganic`'s `questions`). */
  peopleAlsoAsk?: readonly string[];
  /** The searches Google lists as related to this one. Absent as above. */
  relatedSearches?: readonly string[];
  /** The businesses Google's local pack shows on this SERP that have a site
   *  of their own (SPEC §6, D67). Absent where it showed
   *  none: a search that is not asked of a place has no pack. */
  localPack?: readonly { title: string; domain: string }[];
}

/** `serpNews` — one result of a Google News search (SPEC §7, D48): the
 *  page, who published it, and the day the search itself dates it. A result
 *  the vendor gave no date is not a row: a date is all this search is
 *  bought for. */
export interface NewsRow {
  url: string;
  domain: string;
  title: string;
  /** The publisher as the search names it; the domain where it names none. */
  source: string;
  /** `YYYY-MM-DD`, UTC, from the vendor's own timestamp. */
  publishedAt: string;
}

/** `aiMode` and `llmScraper` — one AI engine's synthesized answer, if it
 *  gave one, and the domains it cited. */
export interface AiAnswer {
  answered: boolean;
  text: string;
  citedDomains: readonly string[];
  /** The addresses it cited, where the vendor gave them: "your pages cited" is read from these. Absent on an older cached answer. */
  citedUrls?: readonly string[];
}

/**
 * One `ranked_keywords` answer: the rows this call bought, and the vendor's
 * own count of every search the domain ranks for.
 *
 * `total` is `null` where the vendor did not report one, never `0` or the row count, so "ranks for nothing" and
 * "unknown" stay apart. It sits beside the rows because it belongs to the domain, not to a keyword.
 */
export interface RankedResult {
  readonly rows: readonly RankedRow[];
  readonly total: number | null;
}

// ── Cache scope — BUILD §6.4 ──────────────────────────────────

/**
 * Whose purchase a cached vendor payload is: the site on a paid pass, the domain on a free scan, which has no account.
 * The cost model is per customer (`DATA-COSTS.md` §5), so a key of query and locale alone would share one purchase across customers.
 * A union, prefixed in `scopeKey`, so a site id can never pass for a domain or share its key.
 */
export type CacheScope = { readonly site: string } | { readonly domain: string };

/** The scope, as the segment that goes in a cache key. */
export function scopeKey(scope: CacheScope): string {
  return "site" in scope ? `site:${scope.site}` : `domain:${scope.domain}`;
}

/** The ledger `source` of each engine a tracked prompt is asked on, beside the shapes so a reader of stored rows
 *  names them without loading the vendor seam. */
export const AI_ANSWER_SOURCES = Object.freeze({
  ai_mode: "serp/google/ai_mode",
  chatgpt: "ai_optimization/chat_gpt/llm_scraper",
} as const);

/** How much of an AI answer's text is kept: enough to read whom
 *  it names, never the whole page of a long answer on every stored SERP. */
export const AI_OVERVIEW_TEXT_MAX_CHARS = 4000;
