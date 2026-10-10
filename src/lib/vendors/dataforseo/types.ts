// BUILD §6.3 — the product types the closed endpoint list returns (issue #23)
//
// Product types, not vendor payload shapes: every field here is what the
// rest of the product needs to read, not whatever name-and-nesting
// DataForSEO's own JSON happens to use. The parsers that turn a vendor
// response into these shapes live beside the endpoint that returns them —
// `labs.ts`, `serp.ts`, `ai.ts` — and this file is the one address they
// all parse into.

/** `rankedKeywords` — one keyword the domain ranks for. */
export interface RankedRow {
  keyword: string;
  position: number;
  searchVolume: number;
  url: string;
  /** The vendor's keyword difficulty, 0–100, where it gave one (issue 858).
   *  Absent on a row cached before it was read. */
  difficulty?: number | null;
  /** The title and the snippet Google shows for the page that ranks (SPEC
   *  §2, issue 1387): what a site's market is read from where bot protection
   *  kept the reader off its own pages. Only on rows bought with `listing`,
   *  and only where the vendor gave one. */
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
  /** `keyword_properties.keyword_difficulty` — "difficulty of ranking in
   *  the first top-10 organic results for a keyword", 0–100 on a log scale
   *  (docs.dataforseo.com, keyword_suggestions/live, issue 858). `null`
   *  where the vendor gave none. Absent on a row cached before it was read. */
  difficulty?: number | null;
}

/** The monthly search volume a `keywordSuggestions` call buys between,
 *  both ends inclusive (issue 846): the vendor filters and orders by it, so
 *  the rows returned are the largest right-sized ones rather than the
 *  seed's top rows by volume. */
export interface VolumeWindow {
  min: number;
  max: number;
  /** The hardest keyword difficulty bought (issue 858). A row the vendor
   *  gives no difficulty is still bought. */
  maxDifficulty: number;
}

/** `competitorsDomain` — one domain DataForSEO names as a search competitor. */
export interface CompetitorRow {
  domain: string;
  overlapKeywords: number;
  /** `full_domain_metrics.organic.count` — "total count of organic SERPs
   *  that contain the domain" (docs.dataforseo.com, competitors_domain/live)
   *  — the competitor's own footprint, where the vendor gave it (issue 858). */
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

/** The AI Overview element of one SERP, if Google served one. BP-008
 *  `## Error & edge behavior` (ADR-094 decision 3a): the settlement closure
 *  reads `asynchronousAiOverview` to decide the vendor's own documented
 *  charge — base price where this element is absent or
 *  `asynchronousAiOverview` is `false`, the surcharge rate otherwise — so
 *  this field is not cosmetic; it is what `serpOrganic`'s `settleCents`
 *  argument to `CostContext.recordFetch` reads. */
export interface SerpAiOverview {
  /** `false` when Google served no AI Overview at all on this SERP. */
  present: boolean;
  /** DataForSEO's own `asynchronous_ai_overview` flag on the response
   *  element — meaningless when `present` is `false`. */
  asynchronousAiOverview: boolean;
  /** The domains the AI Overview cited, in the order DataForSEO returned
   *  them. Empty when `present` is `false`. */
  referenceDomains: readonly string[];
  /** The addresses the AI Overview cited, in the vendor's order (issue
   *  1147). Absent on a response stored before it was read, which says
   *  nothing about what that answer cited. */
  referenceUrls?: readonly string[];
  /** Google showed an AI Overview whose content loads after the page, and
   *  this read did not buy that load (issue 1357): whom it names is not
   *  known. Never an answer that names nobody. Absent where the sources
   *  were read. */
  unread?: true;
}

/** `serpOrganic` — organic top-10 **and** the `ai_overview` item with its
 *  reference domains, per BP-008's `## Responsibility` ("the free AI
 *  matrix rides here at 0c extra"). */
export interface SerpResult {
  organic: readonly SerpOrganicRow[];
  aiOverview: SerpAiOverview;
  /**
   * When this answer was bought, where it was not bought by the pass that
   * is holding it (SPEC §2, issue 715) — an ISO instant, the `fetches` row
   * the cache served it from.
   *
   * Absent is the ordinary case and means "this pass paid for it": a
   * freshly bought SERP has nothing to say about an earlier one. It is on
   * the *result* rather than beside it because the result is what the
   * stored report carries, and a report that cannot say where its answers
   * came from cannot be asked again afterwards.
   */
  reusedFrom?: string;
  /** Google's "People also ask" questions on this SERP, in its order (SPEC
   *  §7, owner D61; issue 1295). Absent where it showed none, and on a SERP
   *  stored before they were read — which is why a caller that needs them
   *  buys under a key of its own (`serpOrganic`'s `questions`). */
  peopleAlsoAsk?: readonly string[];
  /** The searches Google lists as related to this one. Absent as above. */
  relatedSearches?: readonly string[];
  /** The businesses Google's local pack shows on this SERP that have a site
   *  of their own (SPEC §6, owner D67, issue 1318). Absent where it showed
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
  /** The addresses it cited, where the vendor gave them (#1162): what
   *  "your pages cited" is read from. Absent on an answer cached before
   *  the member existed. */
  citedUrls?: readonly string[];
}

/**
 * One `ranked_keywords` answer: the rows this call bought, and the vendor's
 * own count of every search the domain ranks for (#117).
 *
 * `total` is `null` where the vendor did not report one — never `0` and
 * never the row count in disguise, so a reader can tell "the domain ranks
 * for nothing" from "we do not know how much it ranks for" and choose its
 * own fallback. A wrapper beside the rows rather than a field on
 * `RankedRow`: the total is a property of the domain, not of a keyword,
 * and repeating it per row would let a hundred copies disagree.
 */
export interface RankedResult {
  readonly rows: readonly RankedRow[];
  readonly total: number | null;
}

// ── Cache scope — BUILD §6.4, issue #75 ──────────────────────────────────

/**
 * Whose purchase a cached vendor payload is.
 *
 * §6.4 keys the cache "source+key+policy-version" and says nothing about
 * what the key is for an endpoint. For the SERP and the AI battery that
 * choice decides the product's largest recurring cost: a key of query and
 * locale alone is shared across every customer whose market contains that
 * search — a market's thirteen weekly target SERPs bought once however
 * many customers track it — while a key carrying the site buys them once
 * per customer.
 *
 * `DATA-COSTS.md` §5's roll-up is stated "Monthly **per customer**", so it
 * already assumes the second, and the shared key silently made the
 * published cost model wrong in the product's favour. The frozen corpus
 * ruled the same way (BP-008 decision 5): the paid battery's key carries
 * the site id, and the free path's carries the domain, "the same shape,
 * since a free scan has no account".
 *
 * A discriminated union rather than a bare string: a caller cannot pass a
 * domain where a site id belongs without saying which it is, and the two
 * are prefixed below so an id that happened to read like a domain could
 * never share a key with one.
 */
export type CacheScope = { readonly site: string } | { readonly domain: string };

/** The scope, as the segment that goes in a cache key. */
export function scopeKey(scope: CacheScope): string {
  return "site" in scope ? `site:${scope.site}` : `domain:${scope.domain}`;
}

// ── LLM Mentions — SPEC §6 (2026-09-22, #1004) ───────────────────────────

/**
 * One row of DataForSEO's LLM Mentions database: a buyer's question an
 * answer engine answered, in an answer that cited this site.
 *
 * Product fields, as everywhere else in this file — `platform`/`model_name`
 * become one `engine`/`model` pair, `first_response_at`/`last_response_at`
 * become the two dates the card reads, and the vendor's nesting does not
 * travel.
 *
 * **What is deliberately absent.** The answer's own prose, any rank
 * position and anything that could be read as sentiment. SPEC §4
 * (2026-09-20) closes the AI answers tab on the first two — "'AI rank
 * position' and sentiment are never shown" — and #1004 repeats it; a field
 * that does not exist is the only way a later surface cannot render one.
 * The engines' prose is generated text with no labelled home (`CLAUDE.md`),
 * exactly as `AiAnswer` already records.
 *
 * `citedUrls` is **the site's own pages only**. The call is made with
 * `search_scope: ["sources"]` against this one domain, so every row cites
 * it somewhere; the other domains an answer cites are a different site's
 * business and no card on this tab shows them.
 */
export interface MentionRow {
  /** The buyer's question, as the engine was asked it. */
  question: string;
  /** The engine that answered — the vendor's `platform`. `null` where it
   *  named none, which is a row we still know the question of. */
  engine: string | null;
  /** The model behind it, where the vendor named one. */
  model: string | null;
  /** The site's own pages this answer cites, de-duplicated in vendor
   *  order. Empty where the match could not be attributed to a URL. */
  citedUrls: readonly string[];
  /** How often this question is asked of an answer engine, the vendor's
   *  own figure. `null` where it gave none — never 0, which is a reading. */
  aiSearchVolume: number | null;
  /** The same question's monthly searches on Google, where the vendor
   *  carries it. */
  monthlySearches: number | null;
  /** `first_response_at` / `last_response_at` as ISO instants — when this
   *  question was first and last seen answered this way. `null` where the
   *  vendor gave none. */
  firstSeenAt: string | null;
  lastSeenAt: string | null;
}

/**
 * One `search_mentions` answer: the rows bought, and the vendor's own count
 * of every mention it holds for this domain.
 *
 * `total` is the breadth the 100-row cap does not buy — the pilot's reason
 * for capping rather than paging ("`total_count` reports the true breadth
 * for free: we pay for a sample, not a census"). `null` where the vendor
 * reported none, never 0 and never the row count under another name.
 */
export interface MentionsResult {
  readonly rows: readonly MentionRow[];
  readonly total: number | null;
}
