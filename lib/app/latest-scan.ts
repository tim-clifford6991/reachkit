import { serverDb } from "@/lib/db/client";
import { env } from "@/lib/config/env";
import { newCostSink, runInCostContext } from "@/lib/scan/cost-context";
import { flushExternalCost } from "@/lib/scan/scan-telemetry";
import { emitScanEvent } from "@/lib/scan/progress";
import { checkAllInCostOverrun, checkUserDailyCostOverrun } from "@/lib/telemetry/pipeline-runs";

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
 * The subject's REAL captured name(s) (`facts.listing.name`) for an app's
 * latest scan — the same value the scan pipeline threads into
 * `gatherFreeSearchVisibility`/`classifyFootprint` so the free brand
 * classifier recognises a subject whose domain label is unusable or wrong
 * (x.com's real brand is "twitter", not "x"). The interactive paid intel
 * routes (`/api/app/intel`, its stream twin, `/api/competitors/select`,
 * plan-generate, content-draft) only have the app's `store_url` in scope, not
 * `facts` — so, like `verify.ts`/`pulse.ts`/`refresh.ts`, they read it back off
 * the scan row's persisted `preliminary_facts` (RC1: this is what lets
 * `gatherKeywordGap`'s `brandNames` match the free classifier's without a
 * second, forked source of the subject's name). Never throws — an app with no
 * scan yet, or a scan with no persisted facts, degrades to `[]` (brandTokensFor's
 * own default), never a fabricated name.
 */
export async function subjectBrandNamesForApp(appId: string): Promise<string[]> {
  const { data, error } = await serverDb()
    .from("scans")
    .select("preliminary_facts")
    .eq("app_id", appId)
    .order("started_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  if (error || !data?.preliminary_facts) return [];
  const facts = data.preliminary_facts as { listing?: { name?: unknown } } | null;
  const name = typeof facts?.listing?.name === "string" ? facts.listing.name.trim() : "";
  return name ? [name] : [];
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
  source: "intel" | "intel-stream" | "select" | "candidates" | "plan-generate" | "content-draft" | "distribute-draft",
  fn: () => Promise<T>,
): Promise<T> {
  const scanId = await latestScanIdForApp(appId);
  if (!scanId) return fn();
  // Full-tier soft cap: intel routes are paid surfaces (invariant #2). Fresh sink
  // per call — the cap bounds THIS gather; cumulative spend is alerted separately.
  // scanId into the sink → LLM spend attributes via currentScanId() too.
  const sink = newCostSink(env.externalScanCapCentsFull / 100, scanId);
  try {
    return await runInCostContext(sink, fn);
  } finally {
    // "post-scan": interactive intel spend lands in the lifetime accumulator only,
    // never in the anchor row's per-run cost (it isn't part of that scan's passes).
    await flushExternalCost(scanId, sink, "post-scan");
    if (sink.dataforseo > 0 || sink.tavily > 0) {
      // Best-effort tag — never fail the gather over telemetry.
      emitScanEvent(scanId, "intel-spend", {
        source,
        dataforseoUsd: sink.dataforseo,
        tavilyUsd: sink.tavily,
      }).catch((e) => console.error("[latest-scan] intel-spend event failed (best-effort)", e));
      // Observe-only cost alerts (all-in + user's 24h total) — fire-and-forget.
      checkAllInCostOverrun(scanId).catch(() => {});
      checkUserDailyCostOverrun(scanId).catch(() => {});
    }
  }
}
