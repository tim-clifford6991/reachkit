/**
 * Deep domain profiling (M2) — single-domain compute path.
 *
 * Crawl (content channels + recency cadence) + SEO posture, in parallel, each
 * degrading independently. The per-company unit; `profileCohort` fans this out
 * over the user + competitors, and `profileDomainCached` adds the shared cache.
 */

import { crawlContentChannels, toHost } from "./crawl";
import { fetchSeoPosture } from "./seo";
import { gatherCommunityPresence } from "./community";
import { gatherMarketplacePresence } from "./marketplace";
import type { DistributionProfile } from "./types";

export async function profileDomain(
  domain: string,
  opts: { nowMs?: number; reddit?: boolean; light?: boolean; backlinks?: boolean } = {},
): Promise<DistributionProfile> {
  const nowMs = opts.nowMs ?? Date.now();
  const brand = toHost(domain).split(".")[0] ?? domain;
  // Marketplace presence costs a Tavily call — full/paid pass only.
  const [channels, seo, communities, marketplace] = await Promise.all([
    crawlContentChannels(domain, nowMs),
    fetchSeoPosture(domain, { light: opts.light, backlinks: opts.backlinks }),
    gatherCommunityPresence(brand, nowMs, { reddit: opts.reddit }),
    opts.light ? Promise.resolve([]) : gatherMarketplacePresence(brand),
  ]);
  const profile: DistributionProfile = {
    domain,
    channels,
    communities,
    seo,
    crawledAt: new Date(nowMs).toISOString(),
  };
  if (marketplace.length > 0) profile.marketplace = marketplace;
  return profile;
}
