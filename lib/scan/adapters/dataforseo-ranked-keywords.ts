/**
 * DataForSEO Labs — ranked keywords + relevant pages (ChannelIntel Phase 2).
 *
 * `ranked_keywords/live` → the keywords a domain ranks for (powers the keyword
 * gap: rivals rank, you don't). `relevant_pages/live` → the domain's top organic
 * pages + their topics. Parsers are pure/defensive (unknown shapes → empty,
 * never throw); the fetches are fixtures-aware (return empty so dev/test stays
 * keyless). US/en, matching the rest of the SEO posture.
 */

import { env } from "@/lib/config/env";
import { fixturesEnabled } from "@/lib/dev/fixtures";
import { fetchWithTimeout } from "@/lib/scan/adapters/fetch-timeout";
import { serpAuthHeader } from "@/lib/scan/adapters/dataforseo";

export interface RankedKeyword {
  keyword: string;
  /** Absolute SERP position (1 = top). */
  position: number;
  /** Monthly search volume. */
  volume: number;
  /** Estimated traffic value contributed by this keyword. */
  etv: number;
}

export interface TopPage {
  url: string;
  /** Number of organic keywords the page ranks for. */
  keywordCount: number;
  etv: number;
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Pure: parse Labs ranked_keywords into {keyword, position, volume, etv} rows. */
export function parseRankedKeywords(body: unknown): RankedKeyword[] {
  const items = ((body ?? {}) as {
    tasks?: Array<{ result?: Array<{ items?: Array<Record<string, unknown>> }> }>;
  }).tasks?.[0]?.result?.[0]?.items;
  if (!Array.isArray(items)) return [];
  const out: RankedKeyword[] = [];
  for (const it of items) {
    const kwData = it["keyword_data"] as Record<string, unknown> | undefined;
    const keyword = String(kwData?.["keyword"] ?? "");
    if (!keyword) continue;
    const kwInfo = kwData?.["keyword_info"] as Record<string, unknown> | undefined;
    const serp = (it["ranked_serp_element"] as Record<string, unknown> | undefined)?.["serp_item"] as
      | Record<string, unknown>
      | undefined;
    out.push({
      keyword,
      position: num(serp?.["rank_absolute"]),
      volume: num(kwInfo?.["search_volume"]),
      etv: num(serp?.["etv"]),
    });
  }
  return out;
}

/** Pure: parse Labs relevant_pages into {url, keywordCount, etv} rows. */
export function parseRelevantPages(body: unknown): TopPage[] {
  const items = ((body ?? {}) as {
    tasks?: Array<{ result?: Array<{ items?: Array<Record<string, unknown>> }> }>;
  }).tasks?.[0]?.result?.[0]?.items;
  if (!Array.isArray(items)) return [];
  const out: TopPage[] = [];
  for (const it of items) {
    const url = String(it["page_address"] ?? "");
    if (!url) continue;
    const organic = (it["metrics"] as Record<string, unknown> | undefined)?.["organic"] as
      | Record<string, unknown>
      | undefined;
    out.push({ url, keywordCount: num(organic?.["count"]), etv: num(organic?.["etv"]) });
  }
  return out;
}

async function postLabs(path: string, payload: unknown): Promise<unknown | null> {
  try {
    const res = await fetchWithTimeout(
      `https://api.dataforseo.com/v3/dataforseo_labs/google/${path}`,
      {
        method: "POST",
        headers: {
          Authorization: serpAuthHeader(env.dataforseoLogin, env.dataforseoPassword),
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
      },
      15_000,
    );
    if (!res.ok) return null;
    return (await res.json()) as unknown;
  } catch {
    return null;
  }
}

/** Fetch the top ranked keywords for a domain (full pass only). [] in fixtures. */
export async function fetchRankedKeywords(target: string, limit = 50): Promise<RankedKeyword[]> {
  if (fixturesEnabled()) return [];
  const body = await postLabs("ranked_keywords/live", [
    {
      target,
      location_code: env.dataforseoLocationCode,
      language_code: env.dataforseoLanguageCode,
      limit,
      order_by: ["ranked_serp_element.serp_item.etv,desc"],
    },
  ]);
  return parseRankedKeywords(body);
}

/** Fetch the top organic pages for a domain (full pass only). [] in fixtures. */
export async function fetchRelevantPages(target: string, limit = 10): Promise<TopPage[]> {
  if (fixturesEnabled()) return [];
  const body = await postLabs("relevant_pages/live", [
    { target, location_code: env.dataforseoLocationCode, language_code: env.dataforseoLanguageCode, limit },
  ]);
  return parseRelevantPages(body);
}
