/**
 * Entity enrichment — the shared scoring/traffic-mix primitive used by the
 * supply/demand funnel to score a subject domain and its competitors.
 *
 * `enrichEntity` returns, for one domain: an estimated discoverability score,
 * estimated monthly organic traffic, and a referral traffic-source split
 * (organic/referral/social/direct), reusing profileDomainCached +
 * estimateTrafficMix wholesale.
 */
import { productNameFromHost } from "@/lib/scan/referral/discover-competitors";
import { cachedBrandedSearch } from "@/lib/scan/cache/cached-adapters";
import { profileDomainCached } from "@/lib/scan/profile/cache";
import { estimateTrafficMix } from "@/lib/scan/profile/traffic-mix";
import { bandFor } from "@/lib/scan/score-bands";
import type { DistributionProfile } from "@/lib/scan/profile/types";
import type { TrafficLens } from "@/lib/scan/referral/traffic-lens";

/**
 * Traffic-source split + the raw signals that drive each share, so the UI can
 * drill down. These are ESTIMATES from public SEO signals, not measured analytics:
 *   organic  ← number of organic keywords the domain ranks for
 *   referral ← number of referring domains (backlinks)
 *   social   ← community mentions (HN/Reddit)
 *   direct   ← a fixed 20% assumption (type-in / branded; nothing measures it)
 */
export interface TrafficMixDetail {
  organic: number;
  referral: number;
  social: number;
  direct: number;
  organicKeywords: number;
  referringDomains: number;
  socialMentions: number;
}

export interface ScoredEntity {
  domain: string;
  isSubject: boolean;
  /** Estimated monthly organic traffic (DataForSEO ETV). */
  monthlyTraffic: number;
  /** Estimated discoverability score 0–100 (same engine as the user's score). */
  score: number;
  band: string;
  mix: TrafficMixDetail | null;
  // Supply-lens inputs — raw signals needed by computeTrafficLens in the funnel
  // (byCategory isn't available yet in enrichEntity, so lens is set post-classify).
  /** Estimated paid-search traffic value (same rank-overview response, zero cost). */
  paidEtv: number;
  /** Google Ads monthly search volume for the brand name (direct-traffic proxy). */
  brandedSearchVolume: number;
  /** Number of top organic pages returned by the relevant-pages endpoint. */
  topPagesCount: number;
  /**
   * Two-lens supply view (traffic sources + growth activities). Set to null by
   * `enrichEntity` and populated by `gatherFullFunnel` after `classifyReferrers`
   * provides the per-category referrer breakdown needed to complete the computation.
   */
  lens: TrafficLens | null;
}

const log100 = (value: number, ref: number) => Math.min(100, (Math.log1p(Math.max(0, value)) / Math.log1p(ref)) * 100);

/**
 * Traffic-grounded discoverability score (0–100) for an entity (subject or rival),
 * measured the same way for everyone so the benchmark is comparable.
 *
 * Discoverability = "are people actually finding you", so it is DOMINATED by real
 * monthly organic traffic (ETV). A product with 0 traffic scores near 0 no matter
 * how many surfaces it has — fixing the old bug where a zero-traffic app scored ~46
 * just for having a blog. Keyword footprint + backlink authority + channel presence
 * are secondary contributors.
 */
function entityScore(p: DistributionProfile): number {
  const etv = p.seo?.etv ?? 0;
  const kw = p.seo?.organicKeywords ?? 0;
  const rd = p.seo?.referringDomains ?? 0;
  const presence =
    p.channels.filter((c) => c.cadence?.active).length +
    p.communities.filter((c) => c.active).length +
    (p.marketplace?.length ?? 0);

  const traffic = log100(etv, 100_000); // 100k organic visits/mo → ~100
  const keywords = log100(kw, 5_000);
  const authority = log100(rd, 1_000);
  const reach = log100(presence, 6);

  return Math.round(0.55 * traffic + 0.2 * keywords + 0.15 * authority + 0.1 * reach);
}

const communityMentions = (p: DistributionProfile): number => p.communities.reduce((s, c) => s + (c.mentions ?? 0), 0);

export async function enrichEntity(
  domain: string,
  isSubject: boolean,
  // When the caller has already batch-fetched branded-search volumes for the whole
  // cohort (funnel), it passes this entity's volume in — avoiding the per-entity
  // keywords_data call. Undefined → fall back to the single-brand cached fetch.
  brandedVolume?: number,
): Promise<ScoredEntity> {
  try {
    // backlinks: true → referring domains populate referral share + fair scoring.
    const profile = await profileDomainCached(domain, { light: true, backlinks: true });
    const score = entityScore(profile);
    const base = estimateTrafficMix(profile);
    const mix: TrafficMixDetail | null = base
      ? {
          organic: base.organic,
          referral: base.referral,
          social: base.social,
          direct: base.direct,
          organicKeywords: profile.seo?.organicKeywords ?? 0,
          referringDomains: profile.seo?.referringDomains ?? 0,
          socialMentions: communityMentions(profile),
        }
      : null;

    // Branded-search volume: proxy for direct/branded traffic channel share.
    // Best-effort — a missing keywords subscription returns 0, never throws. Use the
    // caller's batched value when supplied (funnel), else fetch this one brand.
    const brandedSearchVolume =
      brandedVolume ?? (await cachedBrandedSearch(productNameFromHost(domain)).catch(() => 0));

    return {
      domain,
      isSubject,
      monthlyTraffic: Math.round(profile.seo?.etv ?? 0),
      score,
      band: bandFor(score).label,
      mix,
      paidEtv: profile.seo?.paidEtv ?? 0,
      brandedSearchVolume,
      topPagesCount: profile.seo?.topPages?.length ?? 0,
      // lens is null here — byCategory isn't available until gatherFullFunnel
      // runs classifyReferrers. The funnel sets this on each entity post-classify.
      lens: null,
    };
  } catch {
    return {
      domain,
      isSubject,
      monthlyTraffic: 0,
      score: 0,
      band: bandFor(0).label,
      mix: null,
      paidEtv: 0,
      brandedSearchVolume: 0,
      topPagesCount: 0,
      lens: null,
    };
  }
}
