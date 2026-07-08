/**
 * Deep domain profiling (M2) — cohort fan-out.
 *
 * profileCohort(domain) → the user's profile + the top-N competitors' profiles,
 * all through the shared cache and computed in parallel. This is the input to
 * the gap analysis ("you vs your 5 rivals"). The whole cohort is bounded to a
 * handful of domains, each cheap (~free crawl + ~$0.05 SEO).
 */

import { discoverCompetitorsSmart, type ProductInfo } from "./discover";
import { profileDomainCached } from "./cache";
import { toHost } from "./crawl";
import { fetchSiteListing } from "@/lib/scan/adapters/site-fetch";
import type { DistributionProfile } from "./types";

/** Best-effort product info (name + what it does) from the subject's homepage —
 *  the basis for category/market-first competitor discovery. Falls back to the
 *  host as the name if the homepage can't be read. */
async function subjectInfo(domain: string): Promise<ProductInfo> {
  const host = toHost(domain);
  try {
    const { listing } = await fetchSiteListing(`https://${host}/`);
    return {
      name: listing.name || host,
      description: listing.description || undefined,
    };
  } catch {
    return { name: host };
  }
}

export interface Cohort {
  self: DistributionProfile;
  competitors: DistributionProfile[];
  competitorDomains: string[];
  /** The subject's name + description (drives discovery; reused for demand). */
  product: ProductInfo;
}

/** Below this organic-keyword count a domain is treated as dead/rebranded/parked. */
const HUSK_ORGANIC_KEYWORD_FLOOR = 20;

/**
 * F5 — drop dead/rebranded/parked domains from the cohort. A domain that redirects
 * away (e.g. microacquire.com → acquire.com) shows only a few residual organic
 * keywords, and pairing it next to 5–14k-keyword rivals both pollutes the "you vs
 * rivals" view and double-counts one company. We drop only when organic keywords
 * are KNOWN and near-zero — a null (unfetched) SEO profile is kept (absence of data
 * ≠ dead). PURE; unit-tested. Never empties the list below one entry if that one is
 * the only survivor — callers already tolerate a small cohort.
 */
export function pruneHuskCompetitors(competitors: DistributionProfile[]): DistributionProfile[] {
  return competitors.filter((c) => {
    const kw = c.seo?.organicKeywords;
    return !(kw != null && kw < HUSK_ORGANIC_KEYWORD_FLOOR);
  });
}

export async function profileCohort(
  domain: string,
  opts: { topN?: number; nowMs?: number; maxAgeMs?: number; light?: boolean } = {},
): Promise<Cohort> {
  const topN = opts.topN ?? 5;
  const product = await subjectInfo(domain);
  const competitorDomains = await discoverCompetitorsSmart(domain, product, { topN });

  const [self, ...profiled] = await Promise.all([
    // Reddit community (paid SERP) only for the subject; competitors keep free HN.
    profileDomainCached(domain, { nowMs: opts.nowMs, maxAgeMs: opts.maxAgeMs, reddit: true, light: opts.light }),
    ...competitorDomains.map((d) =>
      profileDomainCached(d, { nowMs: opts.nowMs, maxAgeMs: opts.maxAgeMs, reddit: false, light: opts.light }),
    ),
  ]);

  // F5 — drop dead/rebranded husks (near-zero organic footprint); derive the domain
  // list from the survivors so the two stay in sync regardless of host formatting.
  const competitors = pruneHuskCompetitors(profiled);
  return { self: self!, competitors, competitorDomains: competitors.map((c) => c.domain), product };
}
