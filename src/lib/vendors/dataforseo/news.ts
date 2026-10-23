// SPEC §7 (D48) — serpNews: one Google News search, its first ten results with the day each was published.
// Bought for the date: *current insights* needs what a market published lately, so an undated result is not a row.
// A `news_search` row names no publisher, so its domain is the source. Its `timestamp` reads Google's "2 days ago",
// exact to the day only for recent stories, so the research step prefers a page's own stated date.
// Live only: a page is written inside one invocation, shorter than the standard queue's wait.
// Cached like the organic SERP, on query, locale and whose purchase it is; the window is the caller's.
import type { CostContext } from "@/lib/costs";
import { PRICE_BOOK } from "@/lib/config/constants";
import type { Locale } from "@/lib/locale/locales";
import { localeCacheKey } from "./transport";
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
    /** The site's country and language (D66): where the read is made, and
     *  part of its cache key. */
    locale: Locale;
    /** Whose purchase this is, as on `serpOrganic`. */
    scope: CacheScope;
    /** The caller's window: `CACHE_WINDOWS_D.news`. */
    freshnessDays: number;
  }
): Promise<Measured<NewsRow[]>> {
  return ledgered<NewsRow>(c, {
    source: "serp/google/news",
    cacheKey: `${a.query}|${localeCacheKey(a.locale)}|${scopeKey(a.scope)}`,
    freshnessDays: a.freshnessDays,
    costCents: PRICE_BOOK.NEWS_LIVE_C,
    fetch: () => callEndpoint(PATHS, "live", a.locale, { keyword: a.query }),
    parse: parseNews,
  });
}
