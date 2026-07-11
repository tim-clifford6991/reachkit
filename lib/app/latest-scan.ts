import { serverDb } from "@/lib/db/client";
import { env } from "@/lib/config/env";
import { newCostSink, runInCostContext } from "@/lib/scan/cost-context";
import { flushExternalCost } from "@/lib/scan/scan-telemetry";
import { emitScanEvent } from "@/lib/scan/progress";

/**
 * The app's most recent scan id — the anchor row for cost attribution and
 * event logging outside the scan pipeline itself (manual refresh, interactive
 * intel gathers). Cost-bearing work run on behalf of an app flushes its
 * external spend onto this row via `costedStep` so no metered call is ever
 * unattributed (CLAUDE.md invariant #2).
 */
export async function latestScanIdForApp(appId: string): Promise<string | null> {
  const { data, error } = await serverDb()
    .from("scans")
    .select("id")
    .eq("app_id", appId)
    .order("started_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return data?.id ?? null;
}

/**
 * Run an interactive intel gather under a cost context anchored on the app's
 * latest scan row: external DataForSEO/Tavily spend flushes onto that row, and
 * when real spend occurred (i.e. the gather wasn't a pure cache hit) an
 * `intel-spend` scan event tags it with the calling surface so interactive
 * spend stays distinguishable from scan-pipeline spend.
 *
 * No scan row (shouldn't happen for a paid app) → run un-contexted;
 * `recordExternalCost` is a safe no-op outside a context.
 */
export async function costedIntelStep<T>(
  appId: string,
  source: "intel" | "intel-stream" | "select" | "candidates",
  fn: () => Promise<T>,
): Promise<T> {
  const scanId = await latestScanIdForApp(appId);
  if (!scanId) return fn();
  // Full-tier soft cap: intel routes are paid surfaces (invariant #2). Fresh sink
  // per call — the cap bounds THIS gather; cumulative spend is alerted separately.
  const sink = newCostSink(env.externalScanCapCentsFull / 100);
  try {
    return await runInCostContext(sink, fn);
  } finally {
    await flushExternalCost(scanId, sink);
    if (sink.dataforseo > 0 || sink.tavily > 0) {
      // Best-effort tag — never fail the gather over telemetry.
      emitScanEvent(scanId, "intel-spend", {
        source,
        dataforseoUsd: sink.dataforseo,
        tavilyUsd: sink.tavily,
      }).catch((e) => console.error("[latest-scan] intel-spend event failed (best-effort)", e));
    }
  }
}
