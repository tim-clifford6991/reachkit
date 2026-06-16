/**
 * Deep domain profiling (M2) — competitor discovery (Stage 0).
 *
 * DataForSEO Labs `competitors_domain` returns domains that compete on organic
 * keywords, with an `intersections` count (shared keywords) — the cleanest
 * primitive for "closest competitors". We blocklist the subject + aggregators,
 * then rank by intersection strength. Parser + blocklist + rank are pure.
 */

import { env } from "@/lib/config/env";
import { fixturesEnabled } from "@/lib/dev/fixtures";
import { fetchWithTimeout } from "@/lib/scan/adapters/fetch-timeout";
import { serpAuthHeader } from "@/lib/scan/adapters/dataforseo";
import { toHost } from "./crawl";

/** Domains that are never a "competitor" — marketplaces, aggregators, social. */
export const COMPETITOR_BLOCKLIST = new Set([
  "amazon.com", "g2.com", "capterra.com", "getapp.com", "trustpilot.com",
  "reddit.com", "youtube.com", "wikipedia.org", "linkedin.com", "medium.com",
  "producthunt.com", "facebook.com", "twitter.com", "x.com", "instagram.com",
  "github.com", "quora.com", "pinterest.com", "apple.com", "play.google.com",
  "crunchbase.com", "glassdoor.com", "indeed.com", "yelp.com",
]);

export interface CompetitorDomain {
  domain: string;
  intersections: number;
}

/** Pure: parse Labs competitors_domain into {domain, intersections} rows. */
export function parseCompetitorsDomain(body: unknown): CompetitorDomain[] {
  const items = ((body ?? {}) as {
    tasks?: Array<{ result?: Array<{ items?: Array<Record<string, unknown>> }> }>;
  }).tasks?.[0]?.result?.[0]?.items;

  const out: CompetitorDomain[] = [];
  for (const i of items ?? []) {
    const domain = String(i["domain"] ?? "").trim().toLowerCase();
    if (!domain) continue;
    const intersections = Number(i["intersections"] ?? 0);
    out.push({ domain, intersections: Number.isFinite(intersections) ? intersections : 0 });
  }
  return out;
}

/**
 * Pure: drop the subject + parent/sub-domains + aggregators, dedupe, sort by
 * intersection strength, take top-N. PURE.
 */
export function rankCompetitorDomains(
  rows: CompetitorDomain[],
  ownDomain: string,
  topN: number,
): string[] {
  const own = toHost(ownDomain);
  const ownRoot = own.split(".").slice(-2).join(".");
  const seen = new Set<string>();
  const ranked = [...rows].sort((a, b) => b.intersections - a.intersections);

  const out: string[] = [];
  for (const { domain } of ranked) {
    const host = toHost(domain);
    if (host === own) continue;
    if (host.endsWith(`.${ownRoot}`) || host === ownRoot) continue; // own sub/parent
    if (COMPETITOR_BLOCKLIST.has(host)) continue;
    if (seen.has(host)) continue;
    seen.add(host);
    out.push(host);
    if (out.length >= topN) break;
  }
  return out;
}

/**
 * Discover the top-N closest competitor domains for a domain. Fixtures-mode (or
 * failure) returns []. Never throws.
 */
export async function discoverCompetitorDomains(domain: string, topN = 5): Promise<string[]> {
  if (fixturesEnabled()) return [];
  const target = toHost(domain);
  try {
    const res = await fetchWithTimeout(
      "https://api.dataforseo.com/v3/dataforseo_labs/google/competitors_domain/live",
      {
        method: "POST",
        headers: {
          Authorization: serpAuthHeader(env.dataforseoLogin, env.dataforseoPassword),
          "content-type": "application/json",
        },
        body: JSON.stringify([
          {
            target,
            location_code: env.dataforseoLocationCode,
            language_code: env.dataforseoLanguageCode,
            limit: Math.max(topN * 4, 20),
            exclude_top_domains: true,
          },
        ]),
      },
      15_000,
    );
    if (!res.ok) return [];
    const body = (await res.json()) as unknown;
    return rankCompetitorDomains(parseCompetitorsDomain(body), target, topN);
  } catch {
    return [];
  }
}
