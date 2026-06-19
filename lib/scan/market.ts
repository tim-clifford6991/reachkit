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
  keywordGapCount: number;
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
    keywordGapCount: market.gap.keywordGap.length,
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

/** Most recent prior snapshot summary for an app (for week-over-week alerts). */
export async function latestMarketSnapshot(appId: string): Promise<MarketSnapshotSummary | null> {
  const { data, error } = await serverDb()
    .from("market_snapshots")
    .select("summary")
    .eq("app_id", appId)
    .order("taken_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data?.summary) return null;
  return data.summary as unknown as MarketSnapshotSummary;
}

// ---------------------------------------------------------------------------
// Weekly market alerts (ChannelIntel Phase 4 — alert foundation)
// ---------------------------------------------------------------------------

export interface MarketAlert {
  kind: "competitor_launch" | "mention_shift" | "keyword_opportunity";
  message: string;
}

// Surface a share-of-voice move only when it crosses this absolute delta.
const SOV_ALERT_DELTA = 0.05;

/**
 * Pure: week-over-week alerts from two market summaries. Returns [] when there's
 * no prior snapshot (first run) or nothing notable changed.
 *  - competitor_launch: a rival domain that wasn't in the cohort last week.
 *  - mention_shift: your share-of-voice moved by ≥ SOV_ALERT_DELTA.
 *  - keyword_opportunity: net-new keyword-gap opportunities appeared.
 */
export function computeMarketAlerts(
  prev: MarketSnapshotSummary | null,
  next: MarketSnapshotSummary,
): MarketAlert[] {
  if (!prev) return [];
  const alerts: MarketAlert[] = [];

  const prevRivals = new Set(prev.rivals.map((r) => r.domain));
  for (const r of next.rivals) {
    if (!prevRivals.has(r.domain)) {
      alerts.push({ kind: "competitor_launch", message: `New competitor in your space: ${r.domain}` });
    }
  }

  if (prev.selfSharePct != null && next.selfSharePct != null) {
    const delta = next.selfSharePct - prev.selfSharePct;
    if (Math.abs(delta) >= SOV_ALERT_DELTA) {
      const dir = delta > 0 ? "up" : "down";
      alerts.push({
        kind: "mention_shift",
        message: `Your share of voice moved ${dir} ${Math.abs(Math.round(delta * 100))} pts (now ${Math.round(next.selfSharePct * 100)}%).`,
      });
    }
  }

  if (next.keywordGapCount > prev.keywordGapCount) {
    alerts.push({
      kind: "keyword_opportunity",
      message: `${next.keywordGapCount - prev.keywordGapCount} new keyword opportunit${next.keywordGapCount - prev.keywordGapCount === 1 ? "y" : "ies"} rivals rank for that you don't.`,
    });
  }

  return alerts;
}
