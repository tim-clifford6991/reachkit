import { expect, test } from "vitest";
import { InngestTestEngine } from "@inngest/test";
import { serverDb } from "@/lib/db/client";
import { scanDemo } from "@/lib/inngest/functions/scan-demo";

/**
 * Cycle 0 acceptance gate: proves the Inngest pipeline-to-telemetry path.
 *
 * Uses @inngest/test's InngestTestEngine which executes real step handlers
 * (no dev server required), so the recordPipelineRun side-effect actually
 * writes to Supabase local.
 */
test("scan.demo writes a pipeline_runs row (Cycle 0 acceptance gate)", async () => {
  const db = serverDb();

  // 1. Insert prerequisite rows
  const { data: appRow, error: appErr } = await db
    .from("apps")
    .insert({ store_url: "https://demo.test", platform: "web" })
    .select("id")
    .single();
  expect(appErr).toBeNull();

  const { data: scanRow, error: scanErr } = await db
    .from("scans")
    .insert({ app_id: appRow!.id })
    .select("id")
    .single();
  expect(scanErr).toBeNull();

  const scanId = scanRow!.id as string;

  // 2. Execute the real scanDemo function via InngestTestEngine
  //    (step handlers run for real — no mocks — so recordPipelineRun fires)
  const engine = new InngestTestEngine({ function: scanDemo });
  const { result } = await engine.execute({
    events: [{ name: "scan/demo.requested", data: { scanId } }],
  });

  expect(result).toMatchObject({ ok: true });

  // 3. Assert the pipeline_runs row was written for this scanId
  const { data: rows, error: runsErr } = await db
    .from("pipeline_runs")
    .select("id, stage, cost_cents, duration_ms")
    .eq("scan_id", scanId);

  expect(runsErr).toBeNull();
  expect(rows).not.toBeNull();
  expect(rows!.length).toBeGreaterThan(0);
  expect(rows![0]).toMatchObject({
    stage: "collect",
    cost_cents: 0,
    duration_ms: 1,
  });
}, 30_000);
