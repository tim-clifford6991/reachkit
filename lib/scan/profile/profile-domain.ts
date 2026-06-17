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
import type { DistributionProfile } from "./types";

export async function profileDomain(
  domain: string,
  opts: { nowMs?: number; reddit?: boolean } = {},
): Promise<DistributionProfile> {
  const nowMs = opts.nowMs ?? Date.now();
  const brand = toHost(domain).split(".")[0] ?? domain;
  const [channels, seo, communities] = await Promise.all([
    crawlContentChannels(domain, nowMs),
    fetchSeoPosture(domain),
    gatherCommunityPresence(brand, nowMs, { reddit: opts.reddit }),
  ]);
  return {
    domain,
    channels,
    communities,
    seo,
    crawledAt: new Date(nowMs).toISOString(),
  };
}
