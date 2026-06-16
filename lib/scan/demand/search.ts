/**
 * Demand discovery (M3) — search surface.
 *
 * Runs pain queries through DataForSEO's SERP API (already integrated/keyed) —
 * NO Reddit API needed. `site:reddit.com "{pain}"` surfaces the threads where
 * people describe the problem; a plain query surfaces forums/Q&A. Pure parsing
 * is split out so it's unit-testable without the network.
 */

import { env } from "@/lib/config/env";
import { fixturesEnabled } from "@/lib/dev/fixtures";
import { fetchWithTimeout } from "@/lib/scan/adapters/fetch-timeout";
import { serpAuthHeader } from "@/lib/scan/adapters/dataforseo";
import type { DemandHit } from "./types";

/** Reddit-scoped demand query for a pain phrasing. */
export function buildRedditDemandKeyword(pain: string): string {
  return `site:reddit.com "${pain}"`;
}

/** Extract "r/{name}" from a Reddit thread URL, else null. */
export function subredditFromUrl(url: string): string | null {
  const m = url.match(/reddit\.com\/r\/([A-Za-z0-9_]+)/i);
  return m ? `r/${m[1]}` : null;
}

/** Pure: parse a DataForSEO SERP body into demand hits for one query. */
export function parseDemandHits(body: unknown, query: string): DemandHit[] {
  const result = ((body ?? {}) as {
    tasks?: Array<{ result?: Array<{ items?: Array<Record<string, unknown>> }> }>;
  }).tasks?.[0]?.result?.[0];

  const seen = new Set<string>();
  const hits: DemandHit[] = [];
  for (const i of result?.items ?? []) {
    if (i["type"] !== "organic") continue;
    const url = String(i["url"] ?? "");
    if (!url || seen.has(url)) continue;
    seen.add(url);
    hits.push({
      title: String(i["title"] ?? "").trim(),
      url,
      snippet: String(i["description"] ?? "").trim(),
      subreddit: subredditFromUrl(url),
      query,
    });
  }
  return hits;
}

/**
 * Search one pain query via DataForSEO live SERP. Fixtures-mode returns [] (the
 * dogfood/live run needs real keys). Never throws — a failed query degrades to
 * an empty list so one bad query doesn't sink the sweep.
 */
export async function searchDemand(
  query: string,
  opts: { redditOnly?: boolean; depth?: number } = {},
): Promise<DemandHit[]> {
  if (fixturesEnabled()) return [];

  const keyword = opts.redditOnly === false ? query : buildRedditDemandKeyword(query);
  try {
    const res = await fetchWithTimeout(
      "https://api.dataforseo.com/v3/serp/google/organic/live/advanced",
      {
        method: "POST",
        headers: {
          Authorization: serpAuthHeader(env.dataforseoLogin, env.dataforseoPassword),
          "content-type": "application/json",
        },
        body: JSON.stringify([
          {
            keyword,
            location_code: env.dataforseoLocationCode,
            language_code: env.dataforseoLanguageCode,
            depth: opts.depth ?? 10,
          },
        ]),
      },
      15_000,
    );
    if (!res.ok) return [];
    const body = (await res.json()) as unknown;
    return parseDemandHits(body, query);
  } catch {
    return [];
  }
}
