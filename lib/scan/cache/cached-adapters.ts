/**
 * Cache-first wrappers around the expensive per-domain DataForSEO adapters. These
 * are the calls the funnels repeat every run (backlinks, ranked keywords, top
 * pages, link intersections) — caching them globally cuts credit burn sharply.
 *
 * Existing adapters are unchanged; consumers swap the raw adapter for the cached
 * wrapper. TTLs reflect how slowly each data type moves (see the data-architecture
 * plan): backlinks ~30d, keywords/pages ~14d, intersections ~30d.
 */
import { cachedJson, DAY_MS } from "@/lib/scan/cache/external-cache";
import { fetchBacklinks, fetchDomainIntersection, type IntersectionRow } from "@/lib/scan/adapters/dataforseo-backlinks";
import { fetchRankedKeywords, fetchRelevantPages, type RankedKeyword, type TopPage } from "@/lib/scan/adapters/dataforseo-ranked-keywords";
import { fetchKeywordIdeas, type KeywordIdea } from "@/lib/scan/adapters/dataforseo-keyword-ideas";
import { keywordsData } from "@/lib/scan/adapters/keywords";
import {
  discoverClosestCompetitors,
  discoverCompetitors,
  type ClosestCompetitorsResult,
  type DiscoverCompetitorsResult,
} from "@/lib/scan/referral/discover-competitors";
import type { Referrer } from "@/lib/scan/referral/types";

const norm = (s: string) => s.trim().toLowerCase();

/** Backlinks for a domain OR a specific page URL (one_per_domain). 30d. */
export function cachedBacklinks(target: string, limit = 250): Promise<Referrer[]> {
  return cachedJson(`bl:${norm(target)}:${limit}`, 30 * DAY_MS, () => fetchBacklinks(target, { limit }));
}

/** Ranked keywords for a domain (keyword, position, volume, etv, url). 14d. */
export function cachedRankedKeywords(domain: string, limit = 100): Promise<RankedKeyword[]> {
  return cachedJson(`rk:${norm(domain)}:${limit}`, 14 * DAY_MS, () => fetchRankedKeywords(domain, limit));
}

/** Top organic pages for a domain. 14d. */
export function cachedRelevantPages(domain: string, limit = 10): Promise<TopPage[]> {
  return cachedJson(`tp:${norm(domain)}:${limit}`, 14 * DAY_MS, () => fetchRelevantPages(domain, limit));
}

/** Keyword ideas (demand) seeded from category terms. Keyed on the seed set. 30d. */
export function cachedKeywordIdeas(seeds: string[], limit = 200): Promise<KeywordIdea[]> {
  const key = `ki:${[...seeds].map(norm).sort().join("|")}:${limit}`;
  return cachedJson(key, 30 * DAY_MS, () => fetchKeywordIdeas(seeds, limit));
}

/** Cross-competitor backlink intersection. Keyed on the sorted target set. 30d. */
export async function cachedDomainIntersection(targets: string[], limit = 200): Promise<{ rows: IntersectionRow[] }> {
  const key = `di:${[...targets].map(norm).sort().join(",")}:${limit}`;
  const rows = await cachedJson(key, 30 * DAY_MS, async () => (await fetchDomainIntersection(targets, { limit })).rows);
  return { rows };
}

// Competitor discovery (category LLM + Tavily + traffic + closeness LLM) is the
// biggest repeat cost AND non-deterministic. Caching it per subject domain both
// cuts cost and STABILIZES the cohort (same competitors each run → downstream
// per-domain caches hit). 14d.

/** Closeness-ranked competitors (for benchmark / "learn from"). 14d. */
export function cachedClosestCompetitors(self: string): Promise<ClosestCompetitorsResult> {
  return cachedJson(`cc:${norm(self)}`, 14 * DAY_MS, () => discoverClosestCompetitors(self));
}

/** Size-banded competitors (for the referral-channel cohort). 14d. */
export function cachedDiscoverCompetitors(self: string): Promise<DiscoverCompetitorsResult> {
  return cachedJson(`dc:${norm(self)}`, 14 * DAY_MS, () => discoverCompetitors(self));
}

/**
 * Branded-search monthly volume for `brand` (Google Ads search_volume/live).
 * Used as a proxy for direct/branded traffic — replaces the old fixed-20% assumption.
 * The brand string should be the product name (e.g. "Nudgi", not the full domain).
 * Returns 0 on any error (missing subscription, fixtures mode, etc.). 30d TTL.
 */
export function cachedBrandedSearch(brand: string): Promise<number> {
  const key = `bs:${norm(brand)}`;
  return cachedJson(key, 30 * DAY_MS, async () => {
    const { keywords } = await keywordsData([brand]);
    const match = keywords.find((k) => k.keyword.toLowerCase() === brand.toLowerCase());
    return match?.volume ?? 0;
  });
}

/**
 * The cohort to analyze: the user's CHOSEN competitors when given (onboarding
 * selection), else the auto closeness-ranked set. Category/blurb/subjectEtv come
 * from the (cached) closest result either way.
 */
export async function cohortFor(self: string, override?: string[]): Promise<ClosestCompetitorsResult> {
  const base = await cachedClosestCompetitors(self);
  const chosen = (override ?? []).map(norm).filter((d) => d && d !== norm(self));
  if (chosen.length === 0) return base;
  return {
    ...base,
    ranked: [...new Set(chosen)].slice(0, 5).map((d) => ({ domain: d, name: d, closeness: 5, reason: "(selected)", etv: 0, ratio: null, sizeRelevant: true, sizeTier: "similar" as const })),
    suggested: chosen,
  };
}
