import type { ReferralOpportunity } from "./types";
import { classifyReferrer, isNoiseHost } from "./classify";

/**
 * One referring domain already aggregated server-side (DataForSEO domain_intersection):
 * we know which competitors it links to. Ranking + noise-filtering happens here.
 */
export interface ReferralRow {
  host: string;
  competitorHosts: string[]; // which of the cohort's competitors this domain refers
  exampleUrl: string;
}

interface RankCtx {
  /** Hosts already referring the subject — anything here is parity (`shared`), not an opportunity. */
  selfHosts: Set<string>;
  /** host → estimated monthly organic traffic (ETV), for reach weighting. */
  traffic: Map<string, number>;
  /** Subject + competitor domains, excluded from results (a rival's own domain isn't a channel). */
  exclude?: Set<string>;
  minCompetitors?: number;
  /** Drop referrers below this organic-traffic floor — kills the near-zero SEO-spam tail. */
  minRefererTraffic?: number;
  limit?: number;
}

/** log1p traffic weight so one huge referrer doesn't dwarf everything. */
function weight(traffic: number | null): number {
  return Math.log1p(Math.max(0, traffic ?? 0));
}

/**
 * Rank referral rows into opportunities (subject absent) and shared (subject present),
 * after dropping noise hosts and rows below the competitor-coverage threshold.
 * Sort key = traffic weight × competitor coverage.
 */
export function rankOpportunities(
  rows: ReferralRow[],
  ctx: RankCtx,
): { opportunities: ReferralOpportunity[]; shared: ReferralOpportunity[] } {
  const minCompetitors = ctx.minCompetitors ?? 2;
  const minRefererTraffic = ctx.minRefererTraffic ?? 0;
  const limit = ctx.limit ?? 25;
  const exclude = ctx.exclude ?? new Set<string>();

  const all: ReferralOpportunity[] = rows
    .filter((r) => !isNoiseHost(r.host, exclude))
    .filter((r) => r.competitorHosts.length >= minCompetitors)
    .filter((r) => (ctx.traffic.get(r.host) ?? 0) >= minRefererTraffic)
    .map((r) => ({
      host: r.host,
      exampleUrl: r.exampleUrl,
      channel: classifyReferrer(r.host, r.exampleUrl),
      competitorsUsing: r.competitorHosts.length,
      competitorHosts: r.competitorHosts,
      reachWeight: weight(ctx.traffic.get(r.host) ?? null) * r.competitorHosts.length,
      selfPresent: ctx.selfHosts.has(r.host),
    }))
    .sort((a, b) => b.reachWeight - a.reachWeight);

  return {
    opportunities: all.filter((o) => !o.selfPresent).slice(0, limit),
    shared: all.filter((o) => o.selfPresent).slice(0, limit),
  };
}
