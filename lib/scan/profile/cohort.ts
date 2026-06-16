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
import { toHost } from "./crawl";
import { fetchSiteListing } from "@/lib/scan/adapters/site-fetch";
import type { DistributionProfile } from "./types";

/** Best-effort one-line description of what the subject does (homepage title +
 *  meta description) — gives the competitor filter the context to judge category
 *  closeness. Returns undefined if the homepage can't be read. */
async function subjectDescription(domain: string): Promise<string | undefined> {
  try {
    const { listing } = await fetchSiteListing(`https://${toHost(domain)}/`);
    const desc = [listing.name, listing.description].filter(Boolean).join(" — ");
    return desc || undefined;
  } catch {
    return undefined;
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
  const description = await subjectDescription(domain);
  const competitorDomains = await discoverProductCompetitors(domain, topN, { description });

  const [self, ...competitors] = await Promise.all([
    profileDomainCached(domain, { nowMs: opts.nowMs, maxAgeMs: opts.maxAgeMs }),
    ...competitorDomains.map((d) =>
      profileDomainCached(d, { nowMs: opts.nowMs, maxAgeMs: opts.maxAgeMs }),
    ),
  ]);

  return { self: self!, competitors, competitorDomains };
}
