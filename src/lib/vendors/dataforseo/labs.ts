// BUILD §6.3 — DataForSEO Labs: rankedKeywords, keywordSuggestions, competitorsDomain, keywordOverview
// Labs is live-only at the vendor, so none takes a `mode`. The row count sets both the price (§6.1) and the §6.4 window:
// 50 and 300 are the customer's own domain (7d), 100 a rival's (30d). Suggestions and `competitors_domain` take 30d.
// Per-rival `ranked_keywords` on the free path is on the never-list (§6.4); that is the caller's tier logic.
import type { CostContext } from "@/lib/costs";
import { CACHE_WINDOWS_D, PRICE_BOOK, VENDOR } from "@/lib/config/constants";
import type { Locale } from "@/lib/locale/locales";
import type { Measured } from "@/lib/measure/measured";
import { asArray, asNumber, asString, callEndpoint, isRecord, ledgered, ledgeredWithTotal, type OnVendorFailure } from "./envelope";
import { localeCacheKey } from "./transport";
import type { CompetitorRow, KeywordVolumeRow, RankedResult, RankedRow, SuggestionRow, VolumeWindow } from "./types";

const LABS = "/v3/dataforseo_labs/google";

export type RankedRows = typeof PRICE_BOOK.RANKED_FREE_ROWS | typeof PRICE_BOOK.RANKED_RIVAL_ROWS | typeof PRICE_BOOK.RANKED_PAID_ROWS;

/** Row count → the price-book pin that prices it. The three admitted
 *  counts are the three pinned rows; there is no formula and no fourth. */
function rankedCostCents(rows: RankedRows): number {
  switch (rows) {
    case PRICE_BOOK.RANKED_FREE_ROWS:
      return PRICE_BOOK.RANKED_FREE_COST_C;
    case PRICE_BOOK.RANKED_RIVAL_ROWS:
      return PRICE_BOOK.RANKED_RIVAL_COST_C;
    case PRICE_BOOK.RANKED_PAID_ROWS:
      return PRICE_BOOK.RANKED_PAID_COST_C;
  }
}

/** Row count → §6.4 window. The rival count is the only one that is not
 *  the customer's own domain. */
function rankedFreshnessDays(rows: RankedRows): number {
  return rows === PRICE_BOOK.RANKED_RIVAL_ROWS ? CACHE_WINDOWS_D.rival : CACHE_WINDOWS_D.own;
}

/**
 * The rows, and the vendor's `total_count` beside them: every search the target ranks for, whatever `limit` bought.
 * `items_count` is not a fallback: it counts the rows returned, the capped figure under another name. No total is `null`.
 */
function parseRanked(result: unknown, listing = false): { rows: RankedRow[]; total: number | null } | undefined {
  if (!isRecord(result)) return undefined;
  const total = asNumber(result.total_count) ?? null;
  if (result.items === null || result.items === undefined) return { rows: [], total };
  if (!Array.isArray(result.items)) return undefined;
  const rows: RankedRow[] = [];
  for (const item of result.items) {
    if (!isRecord(item)) continue;
    const kd = isRecord(item.keyword_data) ? item.keyword_data : undefined;
    const keyword = kd ? asString(kd.keyword) : undefined;
    if (!keyword) continue;
    const info = kd && isRecord(kd.keyword_info) ? kd.keyword_info : undefined;
    const serp = isRecord(item.ranked_serp_element) && isRecord(item.ranked_serp_element.serp_item)
      ? item.ranked_serp_element.serp_item
      : undefined;
    const position = serp ? (asNumber(serp.rank_group) ?? asNumber(serp.rank_absolute)) : undefined;
    if (position === undefined) continue;
    rows.push({
      keyword,
      position,
      searchVolume: (info ? asNumber(info.search_volume) : undefined) ?? 0,
      url: (serp ? asString(serp.url) : undefined) ?? "",
      // Only where the vendor gave one, so stored rows keep their shape otherwise.
      ...(difficultyOf(kd) === null ? {} : { difficulty: difficultyOf(kd) }),
      ...(listing ? listingOf(serp) : {}),
    });
  }
  return { rows, total };
}

/** The title and snippet of the ranking page as Google shows them, each only where the vendor gave one. */
function listingOf(serp: Record<string, unknown> | undefined): Pick<RankedRow, "title" | "description"> {
  const title = serp ? asString(serp.title)?.trim() : undefined;
  const description = serp ? asString(serp.description)?.trim() : undefined;
  return { ...(title ? { title } : {}), ...(description ? { description } : {}) };
}

/** `keyword_properties.keyword_difficulty` on a keyword record:
 *  the vendor's 0–100 difficulty, `null` where it gave none or gave a value
 *  outside that range. */
function difficultyOf(record: Record<string, unknown> | undefined): number | null {
  const properties = record && isRecord(record.keyword_properties) ? record.keyword_properties : undefined;
  const value = properties ? asNumber(properties.keyword_difficulty) : undefined;
  return value === undefined || value < 0 || value > 100 ? null : value;
}

function parseSuggestions(result: unknown): SuggestionRow[] | undefined {
  if (!isRecord(result)) return undefined;
  if (result.items === null || result.items === undefined) return [];
  if (!Array.isArray(result.items)) return undefined;
  const rows: SuggestionRow[] = [];
  for (const item of result.items) {
    if (!isRecord(item)) continue;
    const keyword = asString(item.keyword);
    if (!keyword) continue;
    const info = isRecord(item.keyword_info) ? item.keyword_info : undefined;
    rows.push({
      keyword,
      searchVolume: (info ? asNumber(info.search_volume) : undefined) ?? 0,
      difficulty: difficultyOf(item),
    });
  }
  return rows;
}

/** `full_domain_metrics.organic.count` on a competitor item. */
function organicCountOf(item: Record<string, unknown>): number | undefined {
  const full = isRecord(item.full_domain_metrics) ? item.full_domain_metrics : undefined;
  const organic = full && isRecord(full.organic) ? full.organic : undefined;
  const count = organic ? asNumber(organic.count) : undefined;
  return count === undefined || count < 0 ? undefined : count;
}

function parseCompetitors(target: string, result: unknown): CompetitorRow[] | undefined {
  if (!isRecord(result)) return undefined;
  if (result.items === null || result.items === undefined) return [];
  if (!Array.isArray(result.items)) return undefined;
  const rows: CompetitorRow[] = [];
  let own: number | undefined;
  for (const item of asArray(result.items)) {
    if (!isRecord(item)) continue;
    const domain = asString(item.domain)?.toLowerCase();
    if (!domain) continue;
    const rankedCount = organicCountOf(item);
    // The vendor lists the target itself as its own first "competitor":
    // not a rival, but its count is the target's own footprint.
    if (domain === target.toLowerCase()) {
      own = rankedCount;
      continue;
    }
    rows.push({
      domain,
      overlapKeywords: asNumber(item.intersections) ?? 0,
      ...(rankedCount === undefined ? {} : { rankedCount }),
    });
  }
  return own === undefined ? rows : rows.map((row) => ({ ...row, ownRankedCount: own }));
}

export async function rankedKeywords(
  c: CostContext,
  a: {
    domain: string;
    rows: RankedRows;
    /** The site's country and language (D66): where the read is made, and
     *  part of its cache key. */
    locale: Locale;
    /** A narrower window than the row count's own, for a pass
     *  that may not be served a read from before its week. Never wider. */
    windowDays?: number;
    /** Each row also carries the title and snippet Google shows
     *  for the page that ranks. The same call at the same price. It is part
     *  of the cache key, so rows stored without them are never served to a
     *  pass that reads the site's market from them. */
    listing?: boolean;
    /** The stage that asked, told why the call failed, so its reason is the vendor's, never a ledger error. */
    onFailure?: OnVendorFailure;
  }
): Promise<Measured<RankedResult>> {
  const listing = a.listing === true;
  return ledgeredWithTotal<RankedRow>(c, {
    ...(a.onFailure ? { onFailure: a.onFailure } : {}),
    source: "dataforseo_labs/google/ranked_keywords",
    // `rankedPayloadVersion` keeps bare-array entries from reading as `{ rows, total }` with no rows;
    // `|etv` keeps unordered rows from serving as a domain's top keywords.
    cacheKey: `${a.domain}|${a.rows}|${localeCacheKey(a.locale)}|p${VENDOR.rankedPayloadVersion}|etv${listing ? "|listing" : ""}`,
    freshnessDays:
      a.windowDays === undefined
        ? rankedFreshnessDays(a.rows)
        : Math.min(rankedFreshnessDays(a.rows), a.windowDays),
    costCents: rankedCostCents(a.rows),
    fetch: () =>
      callEndpoint({ live: `${LABS}/ranked_keywords/live` }, "live", a.locale, {
        target: a.domain,
        limit: a.rows,
        // Unordered, the vendor answers near alphabetically and the limit keeps a slice; estimated traffic first, same price.
        order_by: ["ranked_serp_element.serp_item.etv,desc"],
      }),
    parse: (result) => parseRanked(result, listing),
  });
}

export async function keywordSuggestions(
  c: CostContext,
  a: { seed: string; rows: typeof VENDOR.suggestionsRows; volume: VolumeWindow; locale: Locale }
): Promise<Measured<SuggestionRow[]>> {
  return ledgered<SuggestionRow>(c, {
    source: "dataforseo_labs/google/keyword_suggestions",
    // The window is in the key, so rows bought for one ceiling never serve a pass with another.
    cacheKey: `${a.seed}|${a.rows}|v${a.volume.min}-${a.volume.max}|d${a.volume.maxDifficulty}|${localeCacheKey(a.locale)}`,
    freshnessDays: CACHE_WINDOWS_D.suggestions,
    costCents: PRICE_BOOK.SUGGESTIONS_COST_C,
    fetch: () =>
      callEndpoint({ live: `${LABS}/keyword_suggestions/live` }, "live", a.locale, {
        keyword: a.seed,
        limit: a.rows,
        // Inside the window, largest first, so the limit keeps the best right-sized rows. A row with no difficulty is
        // kept, since selection then reads it on volume alone.
        filters: [
          ["keyword_info.search_volume", ">=", a.volume.min],
          "and",
          ["keyword_info.search_volume", "<=", a.volume.max],
          "and",
          [
            ["keyword_properties.keyword_difficulty", "<=", a.volume.maxDifficulty],
            "or",
            ["keyword_properties.keyword_difficulty", "=", null],
          ],
        ],
        order_by: ["keyword_info.search_volume,desc"],
      }),
    parse: parseSuggestions,
  });
}

function parseOverview(result: unknown): KeywordVolumeRow[] | undefined {
  if (!isRecord(result)) return undefined;
  if (result.items === null || result.items === undefined) return [];
  if (!Array.isArray(result.items)) return undefined;
  const rows: KeywordVolumeRow[] = [];
  for (const item of result.items) {
    if (!isRecord(item)) continue;
    const keyword = asString(item.keyword)?.toLowerCase();
    if (!keyword) continue;
    const info = isRecord(item.keyword_info) ? item.keyword_info : undefined;
    rows.push({ keyword, searchVolume: (info ? asNumber(info.search_volume) : undefined) ?? 0 });
  }
  return rows;
}

/**
 * How often each keyword is searched a month in the site's country (SPEC §6,
 * D49): one request for the whole list. A
 * keyword the vendor holds nothing for has no row, which the caller reads
 * as no searches.
 */
export async function keywordOverview(
  c: CostContext,
  a: { keywords: readonly string[]; locale: Locale }
): Promise<Measured<KeywordVolumeRow[]>> {
  const keywords = [...new Set(a.keywords.map((k) => k.trim().toLowerCase()).filter(Boolean))].sort();
  return ledgered<KeywordVolumeRow>(c, {
    source: "dataforseo_labs/google/keyword_overview",
    cacheKey: `${keywords.join(",")}|${localeCacheKey(a.locale)}`,
    freshnessDays: CACHE_WINDOWS_D.suggestions,
    costCents: PRICE_BOOK.KEYWORD_OVERVIEW_REQUEST_C + keywords.length * PRICE_BOOK.KEYWORD_OVERVIEW_KEYWORD_C,
    fetch: () => callEndpoint({ live: `${LABS}/keyword_overview/live` }, "live", a.locale, { keywords }),
    parse: parseOverview,
  });
}

export async function competitorsDomain(c: CostContext, a: { domain: string; locale: Locale }): Promise<Measured<CompetitorRow[]>> {
  return ledgered<CompetitorRow>(c, {
    source: "dataforseo_labs/google/competitors_domain",
    cacheKey: `${a.domain}|${localeCacheKey(a.locale)}`,
    freshnessDays: CACHE_WINDOWS_D.rival,
    costCents: PRICE_BOOK.COMPETITORS_DOMAIN_COST_C,
    fetch: () =>
      callEndpoint({ live: `${LABS}/competitors_domain/live` }, "live", a.locale, {
        target: a.domain,
        limit: VENDOR.competitorsDomainRows,
      }),
    parse: (result) => parseCompetitors(a.domain, result),
  });
}
