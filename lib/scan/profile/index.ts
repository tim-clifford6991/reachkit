/**
 * Deep domain profiling (M2) — orchestrator.
 *
 * profileDomain(domain) → DistributionProfile: where the domain publishes
 * (content channels + recency cadence) + its SEO standing. Runs the crawl and
 * the SEO pull in parallel; each degrades independently. This is the per-company
 * unit that runs for the user AND each competitor, feeding the gap analysis.
 *
 * (Persistence + a shared cross-user cache land in the next increment; this is
 * the pure compute path.)
 */

import { crawlContentChannels } from "./crawl";
import { fetchSeoPosture } from "./seo";
import type { DistributionProfile } from "./types";

export type {
  DistributionProfile,
  ContentChannel,
  ChannelKind,
  SeoPosture,
  Cadence,
} from "./types";
export { crawlContentChannels, toHost } from "./crawl";
export { computeCadence } from "./cadence";
export { detectChannels } from "./fingerprint";
export { fetchSeoPosture, parseRankOverview, parseBacklinksSummary } from "./seo";

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
    domain: domain,
    channels,
    seo,
    crawledAt: new Date(nowMs).toISOString(),
  };
}
