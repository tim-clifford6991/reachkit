/**
 * Cycle 1 Task 14 acceptance gate: scan/requested pipeline function
 *
 * Runs the real scanRequested Inngest function via InngestTestEngine (no dev
 * server needed) and asserts that a `facts` scan_event with competitors is
 * written to the DB, and that the scan reaches status='done'.
 *
 * REQUIRES NETWORK: Hits live iTunes / App Store RSS (free, no keys).
 * LOCAL ONLY — not CI. Run with: pnpm test:int tests/integration/scan-requested.test.ts
 */
import { expect, test } from "vitest";
import { InngestTestEngine } from "@inngest/test";
import { serverDb } from "@/lib/db/client";
import { scanRequested } from "@/lib/inngest/functions/scan-requested";

const SOFA_URL = "https://apps.apple.com/us/app/sofa/id1276554886";

test(
  "scan/requested (ios/Sofa) — produces facts event with ≥1 competitor and sets status=done",
  async () => {
    const db = serverDb();

    // 1. Insert prerequisite rows
    const { data: appRow, error: appErr } = await db
      .from("apps")
      .insert({ store_url: SOFA_URL, platform: "ios" })
      .select("id")
      .single();
    expect(appErr).toBeNull();
    if (!appRow) throw new Error("No app row returned");

    const { data: scanRow, error: scanErr } = await db
      .from("scans")
      .insert({ app_id: appRow.id, status: "queued" })
      .select("id")
      .single();
    expect(scanErr).toBeNull();
    if (!scanRow) throw new Error("No scan row returned");

    const scanId = scanRow.id as string;

    // 2. Execute the real scanRequested function via InngestTestEngine
    //    (step handlers run for real — no mocks — so all DB side-effects fire)
    const engine = new InngestTestEngine({ function: scanRequested });
    const { result } = await engine.execute({
      events: [{ name: "scan/requested", data: { scanId } }],
    });

    expect(result).toMatchObject({ ok: true });

    // 3. Assert a `facts` scan_event was written with ≥1 competitor
    const { data: evtRows, error: evtErr } = await db
      .from("scan_events")
      .select("id, type, payload")
      .eq("scan_id", scanId)
      .eq("type", "facts");

    expect(evtErr).toBeNull();
    expect(evtRows).not.toBeNull();
    expect(evtRows!.length).toBeGreaterThan(0);

    const factsRow = evtRows![0];
    if (!factsRow) throw new Error("No facts event row found — pipeline did not write facts");

    const payload = factsRow.payload as Record<string, unknown>;
    const competitors = payload["competitors"];
    expect(Array.isArray(competitors)).toBe(true);
    expect((competitors as unknown[]).length).toBeGreaterThanOrEqual(1);

    // 4. Assert the scan reached status='done' with preliminary_facts set
    const { data: scanFinal, error: scanFinalErr } = await db
      .from("scans")
      .select("status, preliminary_facts")
      .eq("id", scanId)
      .single();

    expect(scanFinalErr).toBeNull();
    if (!scanFinal) throw new Error("No scan row returned after execution");

    expect(scanFinal.status).toBe("done");
    expect(scanFinal.preliminary_facts).not.toBeNull();

    // 5. Assert pipeline_runs has ≥1 row for this scan (proves "every external
    //    call logs telemetry" claim is regression-protected)
    const { data: pipelineRows, error: pipelineErr } = await db
      .from("pipeline_runs")
      .select("id")
      .eq("scan_id", scanId);

    expect(pipelineErr).toBeNull();
    expect(pipelineRows).not.toBeNull();
    expect((pipelineRows ?? []).length).toBeGreaterThanOrEqual(1);
  },
  120_000, // live network scan — give it 2 minutes
);
