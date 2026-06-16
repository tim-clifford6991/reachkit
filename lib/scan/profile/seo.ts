/**
 * Deep domain profiling (M2) — SEO posture (DataForSEO Labs + Backlinks).
 *
 * "Where they stand": organic keyword footprint + estimated traffic value (ETV)
 * from Labs `domain_rank_overview`, and a domain-authority proxy + referring
 * domains from Backlinks `summary`. Parsers are pure/defensive (unknown shapes →
 * zeros, never throw); the fetch is fixtures-aware.
 */

import { env } from "@/lib/config/env";
import { fixturesEnabled } from "@/lib/dev/fixtures";
import { fetchWithTimeout } from "@/lib/scan/adapters/fetch-timeout";
import { serpAuthHeader } from "@/lib/scan/adapters/dataforseo";
import { toHost } from "./crawl";
import type { SeoPosture } from "./types";

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Pure: organic keyword count + ETV from Labs domain_rank_overview. */
export function parseRankOverview(body: unknown): { organicKeywords: number; etv: number } {
  const organic = ((body ?? {}) as {
    tasks?: Array<{ result?: Array<{ items?: Array<{ metrics?: { organic?: Record<string, unknown> } }> }> }>;
  }).tasks?.[0]?.result?.[0]?.items?.[0]?.metrics?.organic;
  return { organicKeywords: num(organic?.["count"]), etv: num(organic?.["etv"]) };
}

/** Pure: authority (rank) + referring domains from Backlinks summary. Returns
 *  nulls when the response carries no result (e.g. Backlinks not subscribed) —
 *  so "no data" is distinct from a genuine 0. */
export function parseBacklinksSummary(body: unknown): {
  authority: number | null;
  referringDomains: number | null;
} {
  const r = ((body ?? {}) as {
    tasks?: Array<{ result?: Array<Record<string, unknown>> }>;
  }).tasks?.[0]?.result?.[0];
  if (!r) return { authority: null, referringDomains: null };
  return { authority: num(r["rank"]), referringDomains: num(r["referring_domains"]) };
}

async function post(url: string, payload: unknown): Promise<unknown | null> {
  try {
    const res = await fetchWithTimeout(
      url,
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

/**
 * Fetch a domain's SEO posture. Fixtures-mode (or failure) returns null.
 *
 * The Backlinks API is a SEPARATE DataForSEO subscription and is off by default —
 * calling it when unsubscribed just burns a request and returns nothing, so
 * authority/referringDomains stay null unless `env.dataforseoBacklinks` is set.
 */
export async function fetchSeoPosture(domain: string): Promise<SeoPosture | null> {
  if (fixturesEnabled()) return null;
  const target = toHost(domain);

  const [overview, backlinks] = await Promise.all([
    post("https://api.dataforseo.com/v3/dataforseo_labs/google/domain_rank_overview/live", [
      { target, location_code: env.dataforseoLocationCode, language_code: env.dataforseoLanguageCode },
    ]),
    env.dataforseoBacklinks
      ? post("https://api.dataforseo.com/v3/backlinks/summary/live", [{ target }])
      : Promise.resolve(null),
  ]);

  if (!overview && !backlinks) return null;

  const { organicKeywords, etv } = parseRankOverview(overview);
  const { authority, referringDomains } = parseBacklinksSummary(backlinks);
  return { organicKeywords, etv, authority, referringDomains };
}
