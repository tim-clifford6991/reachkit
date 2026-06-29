/**
 * Cohort-level reverse-referral discovery (validated design).
 *
 * 1. `domain_intersection` over the COMPETITORS → domains referring to multiple
 *    rivals (the cross-competitor intersection, computed server-side).
 * 2. `fetchBacklinks(self)` → the subject's own referring domains.
 * 3. Traffic-weight every referring host, then rank: opportunities = feeds
 *    ≥minCompetitors rivals AND subject absent; shared = subject already present.
 *
 * Adapter fns are injectable so the algorithm is unit-testable without network.
 *
 * NOTE: domain_intersection returns the FULL intersection of the targets (a domain
 * linking to all competitors), so competitor coverage is typically N/N. Partial
 * coverage (feeds 2 of 3) is a v2 refinement via pairwise/union intersections.
 */
import type { IntersectionRow } from "@/lib/scan/adapters/dataforseo-backlinks";
import { cachedBacklinks, cachedDomainIntersection } from "@/lib/scan/cache/cached-adapters";
import { fetchTrafficForHosts as realFetchTraffic } from "@/lib/scan/adapters/dataforseo-traffic";
import { normalizeHost } from "./classify";
import { rankOpportunities, type ReferralRow } from "./intersect";
import type { CompetitorReferralChannels, Referrer } from "./types";

interface Input {
  selfDomain: string;
  competitorDomains: string[];
  fetchIntersectionFn?: (
    targets: string[],
    opts?: { limit?: number },
  ) => Promise<{ rows: IntersectionRow[] }>;
  fetchSelfReferrersFn?: (domain: string, opts?: { limit?: number }) => Promise<Referrer[]>;
  fetchTrafficFn?: (hosts: string[]) => Promise<Map<string, number>>;
  minCompetitors?: number;
  /** Organic-traffic floor for referrers — drops the near-zero SEO-spam tail. */
  minRefererTraffic?: number;
  limit?: number;
}

/** Step-by-step counts so callers can see WHERE the funnel narrows. */
export interface ReferralDebug {
  competitorDomains: string[];
  intersectionRows: number; // domains feeding multiple rivals (raw)
  selfReferrers: number; // subject's own referring domains
  trafficQueried: number; // hosts sent for traffic estimation
  trafficResolved: number; // hosts that came back with an ETV
  opportunities: number;
  shared: number;
  msIntersection: number;
  msSelfReferrers: number;
  msTraffic: number;
}

export type DiscoverResult = CompetitorReferralChannels & { debug: ReferralDebug };

const emptyDebug = (competitorDomains: string[]): ReferralDebug => ({
  competitorDomains,
  intersectionRows: 0,
  selfReferrers: 0,
  trafficQueried: 0,
  trafficResolved: 0,
  opportunities: 0,
  shared: 0,
  msIntersection: 0,
  msSelfReferrers: 0,
  msTraffic: 0,
});

export async function discoverReferralChannels(input: Input): Promise<DiscoverResult> {
  const competitorDomains = input.competitorDomains.map(normalizeHost).filter(Boolean);
  if (competitorDomains.length < 2) {
    return { opportunities: [], shared: [], measured: false, debug: emptyDebug(competitorDomains) };
  }

  const fetchIntersection = input.fetchIntersectionFn ?? ((targets: string[], opts?: { limit?: number }) => cachedDomainIntersection(targets, opts?.limit ?? 400));
  const fetchSelfReferrers = input.fetchSelfReferrersFn ?? ((domain: string, opts?: { limit?: number }) => cachedBacklinks(domain, opts?.limit ?? 1000));
  const fetchTraffic = input.fetchTrafficFn ?? realFetchTraffic;
  const self = normalizeHost(input.selfDomain);

  // 1 + 2 in parallel: competitor intersection and the subject's own referrers.
  const t0 = Date.now();
  const [{ rows: interRows }, selfRefs] = await Promise.all([
    fetchIntersection(competitorDomains, { limit: input.limit ? input.limit * 10 : 400 }),
    fetchSelfReferrers(input.selfDomain, { limit: 1000 }),
  ]);
  const tFetched = Date.now();

  if (interRows.length === 0 && selfRefs.length === 0) {
    return { opportunities: [], shared: [], measured: false, debug: emptyDebug(competitorDomains) };
  }

  // Resolve each intersection row's target indices → competitor hostnames.
  const rows: ReferralRow[] = interRows.map((r) => ({
    host: r.referringHost,
    competitorHosts: r.targetIdxs.map((i) => competitorDomains[i]).filter((h): h is string => h !== undefined),
    exampleUrl: r.exampleUrl,
  }));

  const selfHosts = new Set(selfRefs.map((r) => normalizeHost(r.referringHost)));
  const exclude = new Set<string>([self, ...competitorDomains]);

  // One traffic call for every non-excluded referring host.
  const hosts = [...new Set(rows.map((r) => r.host))].filter((h) => !exclude.has(h));
  const tTraffic0 = Date.now();
  const traffic = await fetchTraffic(hosts);
  const tTraffic1 = Date.now();

  const { opportunities, shared } = rankOpportunities(rows, {
    selfHosts,
    traffic,
    exclude,
    minCompetitors: input.minCompetitors ?? 2,
    minRefererTraffic: input.minRefererTraffic ?? 300,
    limit: input.limit ?? 25,
  });

  return {
    opportunities,
    shared,
    measured: true,
    debug: {
      competitorDomains,
      intersectionRows: interRows.length,
      selfReferrers: selfHosts.size,
      trafficQueried: hosts.length,
      trafficResolved: traffic.size,
      opportunities: opportunities.length,
      shared: shared.length,
      msIntersection: tFetched - t0,
      msSelfReferrers: tFetched - t0,
      msTraffic: tTraffic1 - tTraffic0,
    },
  };
}
