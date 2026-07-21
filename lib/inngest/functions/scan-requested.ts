import { inngest, scanRequestedEvent } from "@/lib/inngest/client";
import { serverDb } from "@/lib/db/client";
import { env } from "@/lib/config/env";
import { ScanBudget } from "@/lib/tools/registry";
import { runCollect } from "@/lib/scan/collect";
import { runFindings } from "@/lib/scan/findings-pipeline";
import { SYNTH_MODEL_FREE } from "@/lib/llm/synth";
import { runFreeReport } from "@/lib/scan/free-report";
import { warmFootprintCache } from "@/lib/scan/search-visibility";
import { runFullScan } from "@/lib/scan/full-scan";
import { emitScanEvent } from "@/lib/scan/progress";
import { scanCostCents } from "@/lib/telemetry/pipeline-runs";
import { handleScanPipelineFailure } from "@/lib/scan/terminal-status";
import { costedStep } from "@/lib/scan/scan-telemetry";
import { externalCapCentsFor, type ScanTier } from "@/lib/scan/scan-caps";
import type { Json } from "@/lib/db/types";

/** Cheap free-track ceiling (collect + findings + the PR B subject-only
 *  ranked_keywords teaser — the market/demand sweep is still paid-tier). The deep
 *  paid pass uses the full `env.scanBudgetCents`. Raised 15→20 (decision
 *  2026-07-10, free ≤ ~$0.18) for headroom on the one ranked_keywords call; the
 *  REAL $ ceiling is the cost-context measure (`scans.dataforseo_cost_cents`), not
 *  this coarse tool-call cent proxy — verify free stays ≤ ~$0.18 live. */
const FREE_SCAN_BUDGET_CENTS = 20;
function budgetCentsForTier(tier: ScanTier): number {
  return tier === "full" ? env.scanBudgetCents : FREE_SCAN_BUDGET_CENTS;
}

export const scanRequested = inngest.createFunction(
  {
    id: "scan-requested",
    retries: 2,
    triggers: [scanRequestedEvent],
    onFailure: async ({ event, error }) => {
      // event.data.event is the original scan/requested event that failed.
      // A prior step (collect/findings/free-report/full-scan) may already have
      // persisted a renderable report_payload — degrade rather than fail
      // outright so that partial result stays reachable (see terminal-status.ts).
      const scanId = event.data.event.data.scanId;
      await handleScanPipelineFailure(scanId, error);
    },
  },
  async ({ event, step }) => {
    const { scanId } = event.data;

    // The sender stamps the tier onto the event (fixed at scan-row insert), so the
    // collect step's external soft cap is the TIER ceiling from the first call — a
    // free scan's collect no longer runs under the 150¢ full cap (that hole let a
    // "free" scan overspend its 25¢ ceiling in collect: competitor discovery +
    // Tavily/DFS + an LLM all run there). Falls back to the full ceiling only for a
    // legacy in-flight event with no tier (degrade-safe during a deploy). The DB row
    // remains the source of truth for the free/full BRANCH below.
    const eventTier: ScanTier = event.data.tier === "free" ? "free" : "full";

    // Step 1: collect — load scan + app, run pipeline, persist facts.
    // Also reads `scans.tier`: the two-track split runs the heavy full-scan step
    // only for 'full' (paid); 'free' stops after findings (the cheap teaser).
    const { facts, tier } = await step.run("collect", () => costedStep(scanId, async () => {
      const db = serverDb();

      // Load the scan row and its app (join)
      const { data: scanRow, error: scanErr } = await db
        .from("scans")
        .select("id, app_id, tier, apps(store_url, platform)")
        .eq("id", scanId)
        .single();

      if (scanErr) throw scanErr;
      if (!scanRow) throw new Error(`scan ${scanId} not found`);

      // apps is joined as an object; coerce after null check
      const appsRaw = scanRow.apps;
      if (!appsRaw) throw new Error(`scan ${scanId} has no linked app`);

      const app = appsRaw as unknown as { store_url: string; platform: "ios" | "android" | "web" };
      const scanTier: ScanTier = scanRow.tier === "full" ? "full" : "free";

      // Mark as collecting
      const { error: updateErr } = await db
        .from("scans")
        .update({ status: "collecting", started_at: new Date().toISOString() })
        .eq("id", scanId);
      if (updateErr) throw updateErr;

      // Build budget and run collect
      const budget = new ScanBudget({
        maxToolCalls: 60,
        budgetCents: budgetCentsForTier(scanTier),
      });

      const collectedFacts = await runCollect({
        scanId,
        appId: scanRow.app_id,
        mode: app.platform,
        storeUrl: app.store_url,
        budget,
        tier: scanTier,
      });

      // Persist facts to scans row
      const { error: factsErr } = await db
        .from("scans")
        .update({ preliminary_facts: collectedFacts as unknown as Json })
        .eq("id", scanId);
      if (factsErr) throw factsErr;

      // Emit the facts scan_event
      await emitScanEvent(scanId, "facts", collectedFacts as unknown as Record<string, unknown>);

      return { facts: collectedFacts, tier: scanTier };
    }, { capCents: externalCapCentsFor("collect", eventTier) }));

    // Step 2: findings — run extract→synth→score, persist findings + score, emit findings event
    await step.run("findings", () => costedStep(scanId, async () => {
      const db = serverDb();

      // Mark as synthesizing so the UI shows progress during the LLM stage
      // (status was "collecting" after the collect step; it's updated to "done" in step 3).
      const { error: synthStatusErr } = await db
        .from("scans")
        .update({ status: "synthesizing" })
        .eq("id", scanId);
      if (synthStatusErr) throw synthStatusErr;

      // Load the scan row and its app to reconstruct context (Inngest re-executes steps
      // on replay, so we cannot rely on closure variables from the collect step body).
      const { data: scanRow, error: scanErr } = await db
        .from("scans")
        .select("id, app_id, apps(store_url, platform)")
        .eq("id", scanId)
        .single();

      if (scanErr) throw scanErr;
      if (!scanRow) throw new Error(`scan ${scanId} not found`);

      const appsRaw = scanRow.apps;
      if (!appsRaw) throw new Error(`scan ${scanId} has no linked app`);

      const app = appsRaw as unknown as { store_url: string; platform: "ios" | "android" | "web" };

      const budget = new ScanBudget({
        maxToolCalls: 60,
        budgetCents: budgetCentsForTier(tier),
      });

      await Promise.all([
        runFindings(
          {
            scanId,
            appId: scanRow.app_id,
            mode: app.platform,
            storeUrl: app.store_url,
            budget,
          },
          facts,
          // The findings step is the FREE teaser for EVERY tier: a lite Haiku synth
          // that generates only the rendered fields (positioning mirror + category
          // seeds) — fast + cheap. The full findings that drive the PAID action plan
          // are regenerated by the deep pass on Sonnet (full-scan.ts). See synth.ts.
          { synthModel: SYNTH_MODEL_FREE, lite: true },
        ),
        // L1 overlap: warm the domain-only footprint DataForSEO cache CONCURRENTLY
        // with synth, so the free-report step (web) reads a cache HIT instead of a
        // serial ~3–13s tail. Web-only (searchVisibility runs only for web) and
        // best-effort (never throws → falls back to a re-fetch). Cost-neutral: same
        // calls, cached — nothing new is fetched. Attributes to this findings step's
        // cost context (same tier cap).
        app.platform === "web" ? warmFootprintCache(app.store_url) : Promise.resolve(),
      ]);
    }, { capCents: externalCapCentsFor("findings", tier) }));

    // Step 2b: free-report — free scans get a lightweight report_payload (score +
    // positioning + findings + signal-derived baseline fixes; deep sections empty)
    // so the single results renderer works for the public lead magnet. Cheap:
    // pure computation over already-fetched HTML, no new API calls.
    if (tier === "free") {
      await step.run("free-report", () => costedStep(scanId, async () => {
        const db = serverDb();
        const { data: scanRow, error: scanErr } = await db
          .from("scans")
          .select("id, app_id, apps(store_url, platform)")
          .eq("id", scanId)
          .single();
        if (scanErr) throw scanErr;
        if (!scanRow) throw new Error(`scan ${scanId} not found`);
        const appsRaw = scanRow.apps;
        if (!appsRaw) throw new Error(`scan ${scanId} has no linked app`);
        const app = appsRaw as unknown as { store_url: string; platform: "ios" | "android" | "web" };
        const budget = new ScanBudget({ maxToolCalls: 60, budgetCents: budgetCentsForTier(tier) });
        await runFreeReport(
          { scanId, appId: scanRow.app_id, mode: app.platform, storeUrl: app.store_url, budget },
          facts,
        );
      }, { capCents: externalCapCentsFor("free-report", tier) }));
    }

    // Step 3: full-scan — heavy collect + actions + Critic + verified score + report.
    // Two-track split: only paid ('full') scans run the deep pass here. Free scans
    // stop after findings (the cheap teaser); the deep pass runs later via
    // `scan/deepen` once the viewer becomes paid.
    // Reconstructs the ScanContext from the DB (Inngest replays steps, so closures
    // from earlier step bodies are not reliable); `facts` is the memoized collect result.
    if (tier === "full") {
      await step.run("full-scan", () => costedStep(scanId, async () => {
        const db = serverDb();

        const { data: scanRow, error: scanErr } = await db
          .from("scans")
          .select("id, app_id, apps(store_url, platform)")
          .eq("id", scanId)
          .single();

        if (scanErr) throw scanErr;
        if (!scanRow) throw new Error(`scan ${scanId} not found`);

        const appsRaw = scanRow.apps;
        if (!appsRaw) throw new Error(`scan ${scanId} has no linked app`);

        const app = appsRaw as unknown as { store_url: string; platform: "ios" | "android" | "web" };

        const budget = new ScanBudget({
          maxToolCalls: 60,
          budgetCents: env.scanBudgetCents,
        });

        await runFullScan(
          {
            scanId,
            appId: scanRow.app_id,
            mode: app.platform,
            storeUrl: app.store_url,
            budget,
          },
          facts,
        );
      }, { capCents: externalCapCentsFor("full-scan", tier) }));
    }

    // NOTE (2026-07-04, W5): the free tier previously ran a "light-market" step
    // here (top-3 cohort profiling + a 2-query demand sweep). Removed: the
    // market/demand sweep is paid-only now — and the light pass's result was
    // discarded anyway (attachMarketAnalysis patches report_payload, which a
    // free scan never has). Paid scans keep their full market pass inside
    // runFullScan (lib/scan/full-scan.ts).

    // Step 4: done — emit done event and mark scan complete.
    await step.run("done", async () => {
      await emitScanEvent(scanId, "done", { scanId });

      const db = serverDb();
      const completedAt = new Date().toISOString();
      const { error } = await db
        .from("scans")
        .update({ status: "done", completed_at: completedAt })
        .eq("id", scanId);
      if (error) throw error;

      // Observability: one log line per completed scan with tier + wall-clock +
      // cost, so latency/cost measurement is one grep away (pipeline_runs holds
      // the per-stage rows; scans.started_at/completed_at the same wall-clock).
      // Best-effort — never fail a finished scan over a telemetry read.
      try {
        const { data: row } = await db
          .from("scans")
          .select("started_at")
          .eq("id", scanId)
          .single();
        const startedMs = row?.started_at ? new Date(row.started_at).getTime() : NaN;
        const seconds = Number.isFinite(startedMs)
          ? Math.round((new Date(completedAt).getTime() - startedMs) / 100) / 10
          : null;
        const costCents = await scanCostCents(scanId);
        console.log(
          `[scan-complete] scan=${scanId} tier=${tier} seconds=${seconds ?? "?"} costCents=${costCents.toFixed(2)}`,
        );
      } catch (e) {
        console.error("[scan-complete] completion log failed (best-effort)", e);
      }
    });

    return { ok: true, factsMode: facts.mode };
  },
);
