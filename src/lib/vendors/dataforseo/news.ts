// SPEC §7 (owner, D48, 2026-10-04; issue 1259) — serpNews: one Google News
// search, its first ten results with the day each was published.
//
// *Current insights* is a page of what a market published lately, and an
// ordinary web search returns pages of any age: on 2026-10-04 reachkit.app's
// returned none dated inside 30 days (issue 1252's proof). The news search
// dates every result itself, so this is the one thing it is bought for — a
// result the vendor gives no date is not a row.
//
// Live only: a page is written inside one invocation, and the standard
// queue's wait is longer than that. Depth 10 and `SERP_LOCATION` are fixed
// in `transport.ts`, as they are for the organic SERP.
//
// Cache: keyed on the query, the locale and whose purchase it is, like the
// organic SERP's (`serp.ts`, #75). The window is the caller's.
import type { CostContext } from "@/lib/costs";
import { PRICE_BOOK, SERP_LOCATION } from "@/lib/config/constants";
import type { Measured } from "@/lib/measure/measured";
import { asArray, asString, callEndpoint, isRecord, ledgered, type EndpointPaths } from "./envelope";
import { scopeKey, type CacheScope, type NewsRow } from "./types";

const PATHS: EndpointPaths = { live: "/v3/serp/google/news/live/advanced" };

/** The vendor writes `2026-10-01 09:30:00 +00:00`; the day is its UTC date. */
function dayOf(timestamp: string | undefined): string | null {
  if (timestamp === undefined) return null;
  const at = new Date(timestamp.trim().replace(/^(\d{4}-\d{2}-\d{2}) /, "$1T").replace(/ (?=[+-]\d{2}:?\d{2}$)/, ""));
  return Number.isNaN(at.getTime()) ? null : at.toISOString().slice(0, 10);
}

function rowOf(item: Record<string, unknown>): NewsRow | null {
  const url = asString(item.url);
  const publishedAt = dayOf(asString(item.timestamp));
  if (!url || publishedAt === null) return null;
  let domain = asString(item.domain)?.toLowerCase();
  if (!domain) {
    try {
      domain = new URL(url).hostname.toLowerCase();
    } catch {
      return null;
    }
  }
  domain = domain.replace(/^www\./, "");
  return { url, domain, title: asString(item.title) ?? "", source: asString(item.source) ?? domain, publishedAt };
}

/** The dated results, in the search's own order, each address once. A
 *  `top_stories` block holds its stories one level down. `[]` is a search
 *  with no dated result, which the seam never caches (§6.4). */
export function parseNews(result: unknown): NewsRow[] | undefined {
  if (!isRecord(result)) return undefined;
  if (result.items === null || result.items === undefined) return [];
  if (!Array.isArray(result.items)) return undefined;
  const rows: NewsRow[] = [];
  const take = (item: unknown): void => {
    if (!isRecord(item)) return;
    const row = rowOf(item);
    if (row !== null && !rows.some((held) => held.url === row.url)) rows.push(row);
  };
  for (const item of result.items) {
    if (!isRecord(item)) continue;
    if (item.type === "top_stories") asArray(item.items).forEach(take);
    else take(item);
  }
  return rows;
}

export async function serpNews(
  c: CostContext,
  a: {
    query: string;
    /** Whose purchase this is, as on `serpOrganic`. */
    scope: CacheScope;
    /** The caller's window: `CACHE_WINDOWS_D.news`. */
    freshnessDays: number;
  }
): Promise<Measured<NewsRow[]>> {
  return ledgered<NewsRow>(c, {
    source: "serp/google/news",
    cacheKey: `${a.query}|${SERP_LOCATION.location}|${SERP_LOCATION.language}|${scopeKey(a.scope)}`,
    freshnessDays: a.freshnessDays,
    costCents: PRICE_BOOK.NEWS_LIVE_C,
    fetch: () => callEndpoint(PATHS, "live", { keyword: a.query }),
    parse: parseNews,
  });
}
