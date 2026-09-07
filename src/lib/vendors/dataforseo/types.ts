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
}

/** `keywordSuggestions` — one keyword DataForSEO returns for a seed term. */
export interface SuggestionRow {
  keyword: string;
  searchVolume: number;
}

/** `competitorsDomain` — one domain DataForSEO names as a search competitor. */
export interface CompetitorRow {
  domain: string;
  overlapKeywords: number;
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
}

/** `serpOrganic` — organic top-10 **and** the `ai_overview` item with its
 *  reference domains, per BP-008's `## Responsibility` ("the free AI
 *  matrix rides here at 0c extra"). */
export interface SerpResult {
  organic: readonly SerpOrganicRow[];
  aiOverview: SerpAiOverview;
}

/** `aiMode` and `llmScraper` — one AI engine's synthesized answer, if it
 *  gave one, and the domains it cited. */
export interface AiAnswer {
  answered: boolean;
  text: string;
  citedDomains: readonly string[];
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
