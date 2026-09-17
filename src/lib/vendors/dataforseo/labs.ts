// BUILD §6.3 — DataForSEO Labs: rankedKeywords, keywordSuggestions, competitorsDomain (issue #23)
//
// The three Labs endpoints §6.3 admits. Labs is live-only at the vendor
// ("DataForSEO Labs API supports only the Live method of data retrieval"),
// so none takes a `mode`. Each is priced from `PRICE_BOOK` by the row count
// it asks for (§6.1) and cached on the §6.4 window its subject earns:
// `rows` decides both — 50 and 300 are the customer's own domain (7d),
// 100 is a rival's (30d); suggestions are the market's (30d);
// `competitors_domain` keys on the customer's rankings (30d, the rival
// window — it is a warm-start supplement, §6.6).
//
// Per-rival `ranked_keywords` on the free path is on the never-list (§6.4);
// that is the caller's tier logic — this module offers exactly the three
// row counts the price book prices and nothing else.
import type { CostContext } from "@/lib/costs";
import { CACHE_WINDOWS_D, PRICE_BOOK, SERP_LOCATION, VENDOR } from "@/lib/config/constants";
import type { Measured } from "@/lib/measure/measured";
import { asArray, asNumber, asString, callEndpoint, isRecord, ledgered, ledgeredWithTotal, type OnVendorFailure } from "./envelope";
import type { CompetitorRow, RankedResult, RankedRow, SuggestionRow, VolumeWindow } from "./types";

const LABS = "/v3/dataforseo_labs/google";
const LOCALE_KEY = `${SERP_LOCATION.location}|${SERP_LOCATION.language}`;

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
 * The rows, and the vendor's own `total_count` beside them (#117).
 *
 * `total_count` is DataForSEO's count of every search the target ranks
 * for, independent of the `limit` this call bought — which is the whole
 * point: `PRICE_BOOK.RANKED_RIVAL_ROWS` is 100, so a row count can never
 * exceed 100 and the `far` band (a rival above `max(500, 5×C)`) was
 * unreachable from live data.
 *
 * `items_count` is deliberately not read as a fallback: it is the number
 * of rows *returned*, so it is the same capped figure under a different
 * name, and reading it would put the ceiling back while looking like a
 * total. A response with no `total_count` reports `null`, and the reader
 * chooses what to do about not knowing.
 */
function parseRanked(result: unknown): { rows: RankedRow[]; total: number | null } | undefined {
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
      // Only where the vendor gave one (issue 858): the stored own and rival
      // rows keep their shape otherwise.
      ...(difficultyOf(kd) === null ? {} : { difficulty: difficultyOf(kd) }),
    });
  }
  return { rows, total };
}

/** `keyword_properties.keyword_difficulty` on a keyword record (issue 858):
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

/** `full_domain_metrics.organic.count` on a competitor item (issue 858). */
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
    /** The stage that asked, told why the call failed where it did (issue
     *  #504) — so its own reason is the vendor's, never a ledger error. */
    onFailure?: OnVendorFailure;
  }
): Promise<Measured<RankedResult>> {
  return ledgeredWithTotal<RankedRow>(c, {
    ...(a.onFailure ? { onFailure: a.onFailure } : {}),
    source: "dataforseo_labs/google/ranked_keywords",
    // `VENDOR.rankedPayloadVersion` is part of the key because the cached
    // payload's *shape* changed with #117, not its meaning: an entry
    // written before it is a bare array, and reading one back as
    // `{ rows, total }` would report a cached rival as having no rows.
    cacheKey: `${a.domain}|${a.rows}|${LOCALE_KEY}|p${VENDOR.rankedPayloadVersion}`,
    freshnessDays: rankedFreshnessDays(a.rows),
    costCents: rankedCostCents(a.rows),
    fetch: () =>
      callEndpoint({ live: `${LABS}/ranked_keywords/live` }, "live", {
        target: a.domain,
        limit: a.rows,
      }),
    parse: parseRanked,
  });
}

export async function keywordSuggestions(
  c: CostContext,
  a: { seed: string; rows: typeof VENDOR.suggestionsRows; volume: VolumeWindow }
): Promise<Measured<SuggestionRow[]>> {
  return ledgered<SuggestionRow>(c, {
    source: "dataforseo_labs/google/keyword_suggestions",
    // The window is part of the key (issue 846): rows bought for one
    // ceiling are never served to a pass with another.
    cacheKey: `${a.seed}|${a.rows}|v${a.volume.min}-${a.volume.max}|d${a.volume.maxDifficulty}|${LOCALE_KEY}`,
    freshnessDays: CACHE_WINDOWS_D.suggestions,
    costCents: PRICE_BOOK.SUGGESTIONS_COST_C,
    fetch: () =>
      callEndpoint({ live: `${LABS}/keyword_suggestions/live` }, "live", {
        keyword: a.seed,
        limit: a.rows,
        // The vendor's own syntax (docs.dataforseo.com, keyword_suggestions/
        // live: `filters`, `order_by`): the rows inside the window, largest
        // first, so the limit keeps the best right-sized rows. Difficulty
        // (issue 858) is `keyword_properties.keyword_difficulty`; a row the
        // vendor has no difficulty for is kept, since selection reads it on
        // volume alone.
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

export async function competitorsDomain(c: CostContext, a: { domain: string }): Promise<Measured<CompetitorRow[]>> {
  return ledgered<CompetitorRow>(c, {
    source: "dataforseo_labs/google/competitors_domain",
    cacheKey: `${a.domain}|${LOCALE_KEY}`,
    freshnessDays: CACHE_WINDOWS_D.rival,
    costCents: PRICE_BOOK.COMPETITORS_DOMAIN_COST_C,
    fetch: () =>
      callEndpoint({ live: `${LABS}/competitors_domain/live` }, "live", {
        target: a.domain,
        limit: VENDOR.competitorsDomainRows,
      }),
    parse: (result) => parseCompetitors(a.domain, result),
  });
}
