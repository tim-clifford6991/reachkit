/**
 * Demand discovery (M3) — orchestrator.
 *
 * brief → pain queries → search each (DataForSEO SERP) → dedupe → classify
 * intent → cluster into ranked demand pockets. Bounded by a query cap; every
 * stage degrades gracefully so a partial sweep still yields pockets.
 */

import type { ProductBrief, DemandHit, DemandResult } from "./types";
import { generatePainQueries } from "./queries";
import { searchDemand } from "./search";
import { classifyHits } from "./classify";
import { clusterIntoPockets } from "./pockets";

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

export async function discoverDemand(
  brief: ProductBrief,
  opts: { queryCap?: number; maxHits?: number; scanId?: string | null } = {},
): Promise<DemandResult> {
  const queryCap = opts.queryCap ?? 10;
  const maxHits = opts.maxHits ?? 60;
  const scanId = opts.scanId ?? null;

  const painQueries = await generatePainQueries(brief, { count: queryCap, scanId });

  // Search all pain queries (each degrades to [] on failure), then dedupe + cap.
  const perQuery = await Promise.all(painQueries.map((q) => searchDemand(q)));
  const hits = dedupeHits(perQuery.flat()).slice(0, maxHits);

  const classified = await classifyHits(brief.problem, hits, { scanId });
  const pockets = clusterIntoPockets(classified);

  return {
    painQueries,
    pockets,
    totalHits: hits.length,
    buyerPainHits: classified.filter((h) => h.isBuyerPain).length,
  };
}
