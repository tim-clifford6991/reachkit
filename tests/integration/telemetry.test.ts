import { expect, test } from "vitest";
import { serverDb } from "@/lib/db/client";
import { recordPipelineRun, scanCostCents, anthropicCostCents } from "@/lib/telemetry/pipeline-runs";

test("recordPipelineRun persists and scanCostCents aggregates", async () => {
  const db = serverDb();
  const app = await db.from("apps").insert({ store_url: "x", platform: "web" }).select("id").single();
  const scan = await db.from("scans").insert({ app_id: app.data!.id }).select("id").single();
  const cents = anthropicCostCents("claude-haiku-4-5-20251001", 2000, 1000);
  await recordPipelineRun({ scanId: scan.data!.id, stage: "extract", model: "claude-haiku-4-5-20251001", tokensIn: 2000, tokensOut: 1000, costCents: cents, durationMs: 42 });
  const total = await scanCostCents(scan.data!.id);
  expect(total).toBeCloseTo(cents, 3);
});

test("recordPipelineRun accepts a null scanId (fleet-wide job telemetry)", async () => {
  await recordPipelineRun({ scanId: null, stage: "tool", costCents: 0.06, durationMs: 10 });
  // no throw == pass
});
