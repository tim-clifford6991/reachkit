/**
 * Demand discovery (M3) — orchestrator.
 *
 * brief → pain queries → search each (DataForSEO SERP) → dedupe → classify
 * intent → cluster into ranked demand pockets. Bounded by a query cap; every
 * stage degrades gracefully so a partial sweep still yields pockets.
 */

import type { ProductBrief, DemandHit, DemandResult, DemandPocket } from "./types";
import { generatePainQueries } from "./queries";
import { searchDemand } from "./search";
import { classifyHits } from "./classify";
import { clusterIntoPockets } from "./pockets";
import { fetchThreadActivity, type ThreadActivity } from "@/lib/scan/adapters/thread-activity";

export type { ProductBrief, DemandHit, DemandResult, ClassifiedHit, DemandPocket } from "./types";
export { generatePainQueries, normalizePainQueries } from "./queries";
export { searchDemand, parseDemandHits, buildRedditDemandKeyword, subredditFromUrl } from "./search";
export { classifyHits, intentLabelToScore } from "./classify";
export { clusterIntoPockets, pocketScore } from "./pockets";

/** Dedupe hits by URL across queries (keep the first occurrence). */
export function dedupeHits(hits: DemandHit[]): DemandHit[] {
  const seen = new Set<string>();
  const out: DemandHit[] = [];
  for (const h of hits) {
    if (seen.has(h.url)) continue;
    seen.add(h.url);
    out.push(h);
  }
  return out;
}

/** WS2 — attach pre-fetched engagement to each pocket's threads by URL. Pure;
 *  a thread absent from the map stays activity:null (never invented). */
export function attachActivity(pockets: DemandPocket[], byUrl: Map<string, ThreadActivity>): DemandPocket[] {
  return pockets.map((p) => ({
    ...p,
    topThreads: p.topThreads.map((t) => ({ ...t, activity: byUrl.get(t.url) ?? null })),
  }));
}

/** Bounded, best-effort engagement fetch for the shown top threads. Free (public
 *  APIs); concurrency-capped; every failure degrades to no-count. */
async function enrichPocketActivity(pockets: DemandPocket[]): Promise<DemandPocket[]> {
  const urls = [...new Set(pockets.flatMap((p) => p.topThreads.map((t) => t.url)))].slice(0, 40);
  const byUrl = new Map<string, ThreadActivity>();
  const CONCURRENCY = 5;
  for (let i = 0; i < urls.length; i += CONCURRENCY) {
    const chunk = urls.slice(i, i + CONCURRENCY);
    const results = await Promise.all(chunk.map((u) => fetchThreadActivity(u).catch(() => null)));
    chunk.forEach((u, j) => { const a = results[j]; if (a) byUrl.set(u, a); });
  }
  return attachActivity(pockets, byUrl);
}

export async function discoverDemand(
  brief: ProductBrief,
  opts: {
    queryCap?: number;
    maxHits?: number;
    scanId?: string | null;
    /** Extra labeled Reddit queries seeded from demand themes / keywords / buyer
     *  insights — the lever for finding MANY subreddits + threads. Each carries a
     *  `theme` so results can be classified by it in the UI. */
    seedQueries?: Array<{ query: string; theme: string }>;
  } = {},
): Promise<DemandResult> {
  const queryCap = opts.queryCap ?? 10;
  const maxHits = opts.maxHits ?? 60;
  const scanId = opts.scanId ?? null;

  // Product-grounded pain queries, each already tagged with its product-relevant
  // angle (the theme). This is what keeps the search on-topic for THIS product.
  const painQueries = await generatePainQueries(brief, { count: queryCap, scanId });
  const labeled = [...painQueries, ...(opts.seedQueries ?? [])];

  // Search each (Reddit-scoped), tagging every hit with the signal it came from.
  // Run with bounded concurrency — DataForSEO throttles many parallel SERP calls,
  // which was making the sweep hang. 5-at-a-time is reliable and still fast.
  const perQuery: DemandHit[][] = [];
  const CONCURRENCY = 5;
  for (let i = 0; i < labeled.length; i += CONCURRENCY) {
    const chunk = labeled.slice(i, i + CONCURRENCY);
    const res = await Promise.all(chunk.map(async (lq) => (await searchDemand(lq.query)).map((h) => ({ ...h, theme: lq.theme }))));
    perQuery.push(...res);
  }
  const hits = dedupeHits(perQuery.flat()).slice(0, maxHits);

  // Classify against the FULL product context (problem + who it's for) so tangential
  // threads — and "what tool should I use" alternative-shopping — are filtered out.
  const problemContext = `${brief.problem}${brief.audience ? ` — the person is ${brief.audience}` : ""}`;
  const classified = await classifyHits(problemContext, hits, { scanId });
  const pockets = await enrichPocketActivity(clusterIntoPockets(classified));

  return {
    painQueries: painQueries.map((p) => p.query),
    pockets,
    totalHits: hits.length,
    buyerPainHits: classified.filter((h) => h.isBuyerPain).length,
  };
}
