/**
 * Deep domain profiling (M2) — single-domain compute path.
 *
 * Crawl (content channels + recency cadence) + SEO posture, in parallel, each
 * degrading independently. The per-company unit; `profileCohort` fans this out
 * over the user + competitors, and `profileDomainCached` adds the shared cache.
 */

import { crawlContentChannels } from "./crawl";
import { fetchSeoPosture } from "./seo";
import type { DistributionProfile } from "./types";

export async function profileDomain(
  domain: string,
  opts: { nowMs?: number } = {},
): Promise<DistributionProfile> {
  const nowMs = opts.nowMs ?? Date.now();
  const [channels, seo] = await Promise.all([
    crawlContentChannels(domain, nowMs),
    fetchSeoPosture(domain),
  ]);
  return {
    domain,
    channels,
    seo,
    crawledAt: new Date(nowMs).toISOString(),
  };
}
