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
import { runMarketAnalysis } from "@/lib/scan/gap";
import { emitScanEvent } from "@/lib/scan/progress";
import { hostname } from "@/lib/scan/url";

export async function attachMarketAnalysis(
  scanId: string,
  storeUrl: string,
  opts: { light?: boolean } = {},
): Promise<void> {
  const light = opts.light ?? false;
  // Full pass: 5 pain queries (not 8). Light pass: runMarketAnalysis caps to 2.
  const market = await runMarketAnalysis(hostname(storeUrl), {
    scanId,
    queryCap: light ? undefined : 5,
    light,
  });

  const db = serverDb();
  const { data } = await db.from("scans").select("report_payload").eq("id", scanId).maybeSingle();
  if (!data?.report_payload) return;

  const payload = { ...(data.report_payload as Record<string, unknown>), market };
  const { error } = await db
    .from("scans")
    .update({ report_payload: payload as unknown as Json })
    .eq("id", scanId);
  if (error) throw new Error(`attachMarketAnalysis: persist failed: ${error.message}`);

  await emitScanEvent(scanId, "report", { market: true });
}
