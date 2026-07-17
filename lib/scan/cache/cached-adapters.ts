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
import { fetchDomainOverview, type DomainOverview } from "@/lib/scan/adapters/dataforseo-domain-overview";
import { fetchKeywordIdeas, type KeywordIdea } from "@/lib/scan/adapters/dataforseo-keyword-ideas";
import { keywordsData } from "@/lib/scan/adapters/keywords";
import type { KeywordRow } from "@/lib/scan/types";
import {
  discoverClosestCompetitors,
  discoverCompetitors,
  type ClosestCompetitorsResult,
  type DiscoverCompetitorsResult,
} from "@/lib/scan/referral/discover-competitors";
import type { Referrer } from "@/lib/scan/referral/types";
import { MAX_SELECTED } from "@/lib/scan/competitor-selection";

const norm = (s: string) => s.trim().toLowerCase();

/** Backlinks for a domain OR a specific page URL (one_per_domain). 30d. */
export function cachedBacklinks(target: string, limit = 250): Promise<Referrer[]> {
  return cachedJson(`bl:${norm(target)}:${limit}`, 30 * DAY_MS, () => fetchBacklinks(target, { limit }));
}

/** Ranked keywords for a domain (keyword, position, volume, etv, url). 14d. */
export function cachedRankedKeywords(domain: string, limit = 100): Promise<RankedKeyword[]> {
  return cachedJson(`rk:${norm(domain)}:${limit}`, 14 * DAY_MS, () => fetchRankedKeywords(domain, limit));
}

/** TRUE organic footprint totals (count + ETV) for a domain. 14d. `null` is the
 *  degraded result (no subscription / fixtures / bad shape) — don't cache it, so a
 *  transient miss doesn't pin a false "no footprint" for 14d and the caller can
 *  fall back to the top-sample. Same TTL as ranked_keywords → both cache-hit on the
 *  paid deep-pass re-run (no double spend). */
export function cachedDomainOverview(domain: string): Promise<DomainOverview | null> {
  return cachedJson(`do:${norm(domain)}`, 14 * DAY_MS, () => fetchDomainOverview(domain), { isEmpty: (o) => o === null });
}

/** Top organic pages for a domain. 14d. */
export function cachedRelevantPages(domain: string, limit = 10): Promise<TopPage[]> {
  return cachedJson(`tp:${norm(domain)}:${limit}`, 14 * DAY_MS, () => fetchRelevantPages(domain, limit));
}

/** Keyword ideas (demand) seeded from category terms. Keyed on the seed set. 30d. */
export function cachedKeywordIdeas(seeds: string[], limit = 200): Promise<KeywordIdea[]> {
  const key = `ki:${[...seeds].map(norm).sort().join("|")}:${limit}`;
  // fetchKeywordIdeas returns [] on !res.ok / timeout / fixtures — don't cache
  // that transient-failure poison for 30d.
  return cachedJson(key, 30 * DAY_MS, () => fetchKeywordIdeas(seeds, limit), { isEmpty: (ideas) => ideas.length === 0 });
}

/** EXACT monthly search volume for a set of phrases (google_ads/search_volume).
 *  Unlike keyword_ideas this does NOT expand into related terms, so it measures the
 *  precise category phrases with no off-topic noise. Keyed on the sorted set. 30d. */
export function cachedKeywordVolumes(seeds: string[]): Promise<KeywordRow[]> {
  const key = `kv:${[...seeds].map(norm).sort().join("|")}`;
  return cachedJson(
    key,
    30 * DAY_MS,
    async () => {
      // google_ads/search_volume flakes intermittently (timeout / transient 5xx);
      // retry once before giving up so category demand isn't silently lost.
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const rows = (await keywordsData(seeds)).keywords;
          if (rows.length > 0) return rows;
        } catch { /* transient — retry once, then fall through to [] */ }
      }
      return [];
    },
    { isEmpty: (rows) => rows.length === 0 },
  );
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
  // ranked=[] means discovery (Tavily/traffic/LLM) degraded — don't cache a
  // no-competitors result for 14d (it would blank the whole cohort until TTL).
  return cachedJson(`cc:${norm(self)}`, 14 * DAY_MS, () => discoverClosestCompetitors(self), { isEmpty: (r) => r.ranked.length === 0 });
}

/** Size-banded competitors (for the referral-channel cohort). 14d. */
export function cachedDiscoverCompetitors(self: string): Promise<DiscoverCompetitorsResult> {
  // domains=[] means discovery degraded — don't cache an empty cohort for 14d.
  return cachedJson(`dc:${norm(self)}`, 14 * DAY_MS, () => discoverCompetitors(self), { isEmpty: (r) => r.domains.length === 0 });
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
  }, {
    // 0 is the degraded result (missing subscription, fixtures, error) — don't
    // cache it for 30d and re-serve a false "no branded traffic".
    isEmpty: (vol) => vol === 0,
  });
}

/**
 * Branded-search volume for MANY brands in ONE keywords_data call. The funnel used
 * to call `cachedBrandedSearch` once per cohort entity (N+1 keywords_data calls on
 * a cold cohort); `search_volume/live` already accepts a keyword array, so this
 * collapses that fan-out to a single billed call. Keyed on the brand set (the funnel
 * is itself cached per cohort, so the set is stable per app). Returns a
 * lowercased-brand → volume map; brands with no volume are simply absent (0). 30d.
 */
export function cachedBrandedSearchBatch(brands: string[]): Promise<Record<string, number>> {
  const uniq = [...new Set(brands.map(norm))].filter(Boolean).sort();
  const key = `bsv:${uniq.join("|")}`;
  return cachedJson(key, 30 * DAY_MS, async () => {
    if (uniq.length === 0) return {};
    const { keywords } = await keywordsData(uniq);
    const map: Record<string, number> = {};
    for (const k of keywords) {
      const v = k.volume ?? 0;
      if (v > 0) map[norm(k.keyword)] = v;
    }
    return map;
  }, {
    // An all-zero/empty map is the degraded result (missing subscription, fixtures,
    // error) — don't cache it for 30d and re-serve false "no branded traffic".
    isEmpty: (m) => Object.keys(m).length === 0,
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
    ranked: [...new Set(chosen)].slice(0, MAX_SELECTED).map((d) => ({ domain: d, name: d, closeness: 5, reason: "(selected)", etv: 0, ratio: null, sizeRelevant: true, sizeTier: "similar" as const })),
    suggested: chosen,
  };
}
