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
}

export async function profileCohort(
  domain: string,
  opts: { topN?: number; nowMs?: number; maxAgeMs?: number } = {},
): Promise<Cohort> {
  const topN = opts.topN ?? 5;
  const product = await subjectInfo(domain);
  const competitorDomains = await discoverCompetitorsSmart(domain, product, { topN });

  const [self, ...competitors] = await Promise.all([
    profileDomainCached(domain, { nowMs: opts.nowMs, maxAgeMs: opts.maxAgeMs }),
    ...competitorDomains.map((d) =>
      profileDomainCached(d, { nowMs: opts.nowMs, maxAgeMs: opts.maxAgeMs }),
    ),
  ]);

  return { self: self!, competitors, competitorDomains };
}
