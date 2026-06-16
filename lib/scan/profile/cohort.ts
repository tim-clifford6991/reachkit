/**
 * Deep domain profiling (M2) — cohort fan-out.
 *
 * profileCohort(domain) → the user's profile + the top-N competitors' profiles,
 * all through the shared cache and computed in parallel. This is the input to
 * the gap analysis ("you vs your 5 rivals"). The whole cohort is bounded to a
 * handful of domains, each cheap (~free crawl + ~$0.05 SEO).
 */

import { discoverProductCompetitors } from "./competitors";
import { profileDomainCached } from "./cache";
import type { DistributionProfile } from "./types";

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
  const competitorDomains = await discoverProductCompetitors(domain, topN);

  const [self, ...competitors] = await Promise.all([
    profileDomainCached(domain, { nowMs: opts.nowMs, maxAgeMs: opts.maxAgeMs }),
    ...competitorDomains.map((d) =>
      profileDomainCached(d, { nowMs: opts.nowMs, maxAgeMs: opts.maxAgeMs }),
    ),
  ]);

  return { self: self!, competitors, competitorDomains };
}
