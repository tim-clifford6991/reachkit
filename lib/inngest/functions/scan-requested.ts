import { inngest, scanRequestedEvent } from "@/lib/inngest/client";
import { serverDb } from "@/lib/db/client";
import { env } from "@/lib/config/env";
import { ScanBudget } from "@/lib/tools/registry";
import { runCollect } from "@/lib/scan/pipeline";
import { runFindings } from "@/lib/scan/findings-pipeline";
import { runFullScan } from "@/lib/scan/full-scan";
import { emitScanEvent } from "@/lib/scan/progress";
import type { Json } from "@/lib/db/types";

/** Cheap free-track ceiling (collect + findings only). The deep pass uses the
 *  full `env.scanBudgetCents`. */
const FREE_SCAN_BUDGET_CENTS = 40;
type ScanTier = "free" | "full";
function budgetCentsForTier(tier: ScanTier): number {
  return tier === "full" ? env.scanBudgetCents : FREE_SCAN_BUDGET_CENTS;
}

export const scanRequested = inngest.createFunction(
  {
    id: "scan-requested",
    retries: 2,
    triggers: [scanRequestedEvent],
    onFailure: async ({ event, error }) => {
      // event.data.event is the original scan/requested event that failed
      const scanId = event.data.event.data.scanId;
      const message = error instanceof Error ? error.message : String(error);
      const db = serverDb();
      await emitScanEvent(scanId, "error", { message });
      await db
        .from("scans")
        .update({ status: "failed" })
        .eq("id", scanId);
    },
  },
  async ({ event, step }) => {
    const { scanId } = event.data;

    // Step 1: collect — load scan + app, run pipeline, persist facts.
    // Also reads `scans.tier`: the two-track split runs the heavy full-scan step
    // only for 'full' (paid); 'free' stops after findings (the cheap teaser).
    const { facts, tier } = await step.run("collect", async () => {
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
    });

    // Step 2: findings — run extract→synth→score, persist findings + score, emit findings event
    await step.run("findings", async () => {
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

      await runFindings(
        {
          scanId,
          appId: scanRow.app_id,
          mode: app.platform,
          storeUrl: app.store_url,
          budget,
        },
        facts,
      );
    });

    // Step 3: full-scan — heavy collect + actions + Critic + verified score + report.
    // Two-track split: only paid ('full') scans run the deep pass here. Free scans
    // stop after findings (the cheap teaser); the deep pass runs later via
    // `scan/deepen` once the viewer becomes paid.
    // Reconstructs the ScanContext from the DB (Inngest replays steps, so closures
    // from earlier step bodies are not reliable); `facts` is the memoized collect result.
    if (tier === "full") {
      await step.run("full-scan", async () => {
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
      });
    }

    // Step 4: done — emit done event and mark scan complete
    await step.run("done", async () => {
      await emitScanEvent(scanId, "done", { scanId });

      const db = serverDb();
      const { error } = await db
        .from("scans")
        .update({ status: "done", completed_at: new Date().toISOString() })
        .eq("id", scanId);
      if (error) throw error;
    });

    return { ok: true, factsMode: facts.mode };
  },
);
