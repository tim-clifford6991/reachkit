/**
 * scan/deepen (M1) — run the heavy full-scan pass for an existing free scan.
 *
 * The cheap free track (collect + findings) already persisted `preliminary_facts`
 * and `findings_payload`. Deepen reuses those facts (no re-collect) and runs the
 * deep pipeline (`runFullScan`) to produce `report_payload`, then marks the scan
 * done. Triggered by `ensureDeepScan` on checkout / paid access.
 */

import { inngest, scanDeepenEvent } from "@/lib/inngest/client";
import { serverDb } from "@/lib/db/client";
import { env } from "@/lib/config/env";
import { ScanBudget } from "@/lib/tools/registry";
import { runFullScan } from "@/lib/scan/full-scan";
import { emitScanEvent } from "@/lib/scan/progress";
import type { PreliminaryFacts } from "@/lib/scan/types";

export const scanDeepen = inngest.createFunction(
  {
    id: "scan-deepen",
    retries: 2,
    triggers: [scanDeepenEvent],
    onFailure: async ({ event, error }) => {
      const scanId = event.data.event.data.scanId;
      const message = error instanceof Error ? error.message : String(error);
      await emitScanEvent(scanId, "error", { message });
    },
  },
  async ({ event, step }) => {
    const { scanId } = event.data;

    await step.run("deepen", async () => {
      const db = serverDb();

      const { data: scanRow, error: scanErr } = await db
        .from("scans")
        .select("id, app_id, report_payload, preliminary_facts, apps(store_url, platform)")
        .eq("id", scanId)
        .single();

      if (scanErr) throw scanErr;
      if (!scanRow) throw new Error(`scan ${scanId} not found`);

      // Idempotent: if the deep pass already produced a report, stop.
      if (scanRow.report_payload) return;

      const facts = scanRow.preliminary_facts as unknown as PreliminaryFacts | null;
      if (!facts) throw new Error(`scan ${scanId} has no preliminary_facts to deepen from`);

      const appsRaw = scanRow.apps;
      if (!appsRaw) throw new Error(`scan ${scanId} has no linked app`);
      const app = appsRaw as unknown as { store_url: string; platform: "ios" | "android" | "web" };

      await db.from("scans").update({ status: "synthesizing" }).eq("id", scanId);

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

    await step.run("done", async () => {
      await emitScanEvent(scanId, "done", { scanId });
      const db = serverDb();
      const { error } = await db
        .from("scans")
        .update({ status: "done", completed_at: new Date().toISOString() })
        .eq("id", scanId);
      if (error) throw error;
    });

    return { ok: true };
  },
);
