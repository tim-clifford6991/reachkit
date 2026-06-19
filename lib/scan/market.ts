/**
 * Market-analysis attach — shared by the paid full-scan, the free light pass, and
 * the weekly refresh.
 *
 * `attachMarketAnalysis` runs the M4 pipeline for a scan's domain and patches the
 * result into the already-persisted `report_payload.market`. Best-effort by
 * contract: callers wrap it in `.catch`, so any failure is logged without touching
 * the core report.
 *
 * The `light` option drives the FREE-tier pass: a top-3, ETV-only cohort with a
 * 2-query demand sweep (no Backlinks / ranked-keywords / Tavily-extract), so the
 * free scan can show competitors + channels + traffic + pockets inside ≤20¢. The
 * full (paid) pass runs the complete analysis.
 */

import { serverDb } from "@/lib/db/client";
import type { Json } from "@/lib/db/types";
import { runMarketAnalysis, type MarketAnalysis } from "@/lib/scan/gap";
import { emitScanEvent } from "@/lib/scan/progress";
import { hostname } from "@/lib/scan/url";

/** Returns the computed analysis (so callers can snapshot it), or null when the
 *  scan has no persisted report to patch. */
export async function attachMarketAnalysis(
  scanId: string,
  storeUrl: string,
  opts: { light?: boolean } = {},
): Promise<MarketAnalysis | null> {
  const light = opts.light ?? false;
  // Full pass: 5 pain queries (not 8). Light pass: runMarketAnalysis caps to 2.
  const market = await runMarketAnalysis(hostname(storeUrl), {
    scanId,
    queryCap: light ? undefined : 5,
    light,
  });

  const db = serverDb();
  const { data } = await db.from("scans").select("report_payload").eq("id", scanId).maybeSingle();
  if (!data?.report_payload) return null;

  const payload = { ...(data.report_payload as Record<string, unknown>), market };
  const { error } = await db
    .from("scans")
    .update({ report_payload: payload as unknown as Json })
    .eq("id", scanId);
  if (error) throw new Error(`attachMarketAnalysis: persist failed: ${error.message}`);

  await emitScanEvent(scanId, "report", { market: true });
  return market;
}

// ---------------------------------------------------------------------------
// Market history — weekly per-app snapshot (trends + benchmarking over time)
// ---------------------------------------------------------------------------

interface MarketSnapshotSummary {
  self: { domain: string; organicKeywords: number | null; etv: number | null; referringDomains: number | null };
  rivals: Array<{ domain: string; organicKeywords: number | null; etv: number | null; referringDomains: number | null }>;
  selfSharePct: number | null;
  demandPocketCount: number;
}

const seoSummary = (p: MarketAnalysis["cohort"]["self"]) => ({
  domain: p.domain,
  organicKeywords: p.seo?.organicKeywords ?? null,
  etv: p.seo?.etv ?? null,
  referringDomains: p.seo?.referringDomains ?? null,
});

/** Pure: distil a MarketAnalysis into the small row we persist for trends. */
export function summarizeMarket(market: MarketAnalysis): MarketSnapshotSummary {
  return {
    self: seoSummary(market.cohort.self),
    rivals: market.cohort.competitors.map(seoSummary),
    selfSharePct: market.gap.shareOfVoice?.selfPct ?? null,
    demandPocketCount: market.demand.pockets.length,
  };
}

/** Persist one weekly market snapshot (best-effort; a missing table is inert). */
export async function writeMarketSnapshot(
  appId: string,
  market: MarketAnalysis,
  takenAt: string,
): Promise<void> {
  const { error } = await serverDb()
    .from("market_snapshots")
    .insert({ app_id: appId, taken_at: takenAt, summary: summarizeMarket(market) as unknown as Json });
  if (error) console.error(`[market snapshot] insert failed for ${appId}:`, error.message ?? error);
}
