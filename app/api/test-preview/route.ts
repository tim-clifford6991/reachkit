/**
 * /api/test-preview — dev preview + trace for the reverse-referral engine.
 *
 * Runs a real (live) scan and returns a step-by-step `trace` of every node hit
 * (input queries, LLM prompt/response/tokens, row counts, timings) so we can see
 * exactly where the funnel narrows. Competitor discovery falls back to an LLM seed
 * when SERP/Tavily come back empty — every app gets ≥2 competitors.
 *
 * Standalone harness (not wired into the product report/tier flow). Requires live
 * keys (REACHKIT_USE_FIXTURES=false). Open and spends API credit — dev only.
 */
import { NextRequest, NextResponse } from "next/server";
import { normalizeHost } from "@/lib/scan/referral/classify";
import { discoverReferralChannels } from "@/lib/scan/referral/discover";
import { classifyOpportunityPages, type OppChannelType } from "@/lib/scan/referral/classify-pages";
import { discoverCompetitors, productNameFromHost, type TraceStep } from "@/lib/scan/referral/discover-competitors";

export const maxDuration = 90;

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const self = normalizeHost(sp.get("self") || "nudgi.ai");
  const explicit = (sp.get("competitors") || "")
    .split(",")
    .map((s) => normalizeHost(s.trim()))
    .filter(Boolean);

  const startedAt = Date.now();
  const trace: TraceStep[] = [];

  let competitors = explicit;
  let competitorsAutoDiscovered = false;
  let category = "";
  if (competitors.length >= 2) {
    trace.push({
      node: "competitor.explicit",
      status: "ok",
      ms: 0,
      input: { provided: explicit },
      output: { domains: explicit },
    });
  } else {
    competitorsAutoDiscovered = true;
    const disc = await discoverCompetitors(self, trace);
    competitors = disc.domains;
    category = disc.category;
  }

  if (competitors.length < 2) {
    return NextResponse.json({
      self,
      competitors,
      competitorsAutoDiscovered,
      measured: false,
      opportunities: [],
      shared: [],
      trace,
      note: `Only ${competitors.length} competitor(s) resolved for ${self} — even the LLM fallback came up short. Add competitors manually.`,
      elapsedMs: Date.now() - startedAt,
    });
  }

  const tRef = Date.now();
  const result = await discoverReferralChannels({ selfDomain: self, competitorDomains: competitors, limit: 40 });
  const d = result.debug;

  // Synthesize the referral-stage steps from the engine's debug counts.
  trace.push({
    node: "referral.domain_intersection",
    status: d.intersectionRows ? "ok" : "empty",
    ms: d.msIntersection,
    input: { endpoint: "backlinks/domain_intersection", targets: competitors },
    output: { referringDomains: d.intersectionRows },
  });
  trace.push({
    node: "referral.self_backlinks",
    status: d.selfReferrers ? "ok" : "empty",
    ms: d.msSelfReferrers,
    input: { endpoint: "backlinks/backlinks (one_per_domain)", target: self },
    output: { selfReferringDomains: d.selfReferrers },
  });
  trace.push({
    node: "referral.traffic_estimation",
    status: d.trafficResolved ? "ok" : "empty",
    ms: d.msTraffic,
    input: { endpoint: "labs/bulk_traffic_estimation", hostsQueried: d.trafficQueried },
    output: { hostsResolved: d.trafficResolved },
  });
  trace.push({
    node: "referral.rank_opportunities",
    status: result.opportunities.length ? "ok" : "empty",
    ms: Date.now() - tRef,
    input: {
      logic: "noise-gate (ubiquitous / customer-embed .edu·.gov / generic-authority / cohort domains) → traffic×coverage rank → subtract self referrers",
      intersectionRows: d.intersectionRows,
    },
    output: { opportunities: result.opportunities.length, shared: result.shared.length },
    note:
      d.intersectionRows > 0 && result.opportunities.length === 0
        ? "Rows found but 0 opportunities — subject likely already present on shared platforms, or all were noise."
        : undefined,
  });

  // Task 6b — page-level classification: keep only sites that are real CHANNELS a
  // founder can get onto (directory/community/podcast/newsletter/guest-post), and
  // drop tools/platforms/competitors (godaddy, moz, semrush, search engines).
  type ClassedOpp = (typeof result.opportunities)[number] & { type: OppChannelType; action: string; actionable: boolean };
  let opportunities: ClassedOpp[] = result.opportunities.map((o) => ({ ...o, type: "other" as OppChannelType, action: "", actionable: false }));
  if (result.opportunities.length) {
    const tC = Date.now();
    const top = result.opportunities.slice(0, 25);
    const cls = await classifyOpportunityPages({
      productName: productNameFromHost(self),
      category,
      hosts: top.map((o) => o.host),
    });
    const byHost = new Map(cls.classifications.map((c) => [c.host, c]));
    const classed: ClassedOpp[] = top.map((o) => {
      const c = byHost.get(o.host.toLowerCase());
      return { ...o, type: c?.type ?? "other", action: c?.action ?? "", actionable: c?.actionable ?? false };
    });
    const kept = classed.filter((o) => o.actionable);
    const droppedByType: Record<string, number> = {};
    for (const o of classed) if (!o.actionable) droppedByType[o.type] = (droppedByType[o.type] ?? 0) + 1;
    trace.push({
      node: "referral.classify_channels",
      status: kept.length ? "ok" : "empty",
      ms: Date.now() - tC,
      input: { model: "claude-haiku-4-5", classified: classed.length, logic: "fetch each homepage → classify channel type → keep only joinable channels, drop tools/competitors/platforms" },
      output: {
        keptActionable: kept.length,
        droppedByType,
        kept: kept.map((o) => ({ host: o.host, type: o.type, action: o.action })),
        tokensIn: cls.tokensIn,
        tokensOut: cls.tokensOut,
      },
    });
    opportunities = kept;
  }

  return NextResponse.json({
    self,
    competitors,
    category,
    competitorsAutoDiscovered,
    measured: result.measured,
    opportunities,
    shared: result.shared,
    debug: d,
    trace,
    elapsedMs: Date.now() - startedAt,
  });
}
