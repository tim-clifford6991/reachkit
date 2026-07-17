/**
 * scan-telemetry.test.ts — cost rollup (launch-readiness B3).
 *
 * Regression for live trustmrr.com `scans.cost_cents=0`: the per-scan cost must
 * be summed from pipeline_runs onto the scan row (rounded), and the rollup must
 * be best-effort — a failure never breaks a completed scan.
 */

import { expect, test, vi, beforeEach } from "vitest";

function makeDb(runs: Array<{ cost_cents: number }>, opts: { throwOnFrom?: boolean } = {}) {
  const updateEq = vi.fn().mockResolvedValue({ error: null });
  const update = vi.fn().mockReturnValue({ eq: updateEq });
  const pipelineEq = vi.fn().mockResolvedValue({ data: runs, error: null });
  const pipelineSelect = vi.fn().mockReturnValue({ eq: pipelineEq });
  const from = vi.fn((table: string) => {
    if (opts.throwOnFrom) throw new Error("db down");
    if (table === "pipeline_runs") return { select: pipelineSelect };
    return { update };
  });
  return { serverDb: vi.fn().mockReturnValue({ from }), spies: { update, updateEq } };
}

beforeEach(() => vi.resetModules());

async function load(db: ReturnType<typeof makeDb>) {
  vi.doMock("@/lib/db/client", () => ({ serverDb: db.serverDb }));
  return (await import("./scan-telemetry")).rollupScanCost;
}

test("sums pipeline_runs cost and writes the rounded total to scans.cost_cents", async () => {
  const db = makeDb([{ cost_cents: 4.94 }, { cost_cents: 6.1 }, { cost_cents: 0.02 }]);
  const rollupScanCost = await load(db);
  const cents = await rollupScanCost("scan-1");
  expect(cents).toBe(11); // 11.06 → 11
  expect(db.spies.update).toHaveBeenCalledWith({ cost_cents: 11 });
  expect(db.spies.updateEq).toHaveBeenCalledWith("id", "scan-1");
});

test("is best-effort — returns 0 and does not throw when the db fails", async () => {
  const db = makeDb([], { throwOnFrom: true });
  const rollupScanCost = await load(db);
  await expect(rollupScanCost("scan-x")).resolves.toBe(0);
});

// ---------------------------------------------------------------------------
// Per-run vs post-scan cost split (C-COST / R2) + the cap stamp (G8).
//
// A `scans` row's dataforseo/tavily_cost_cents are a LIFETIME accumulator — every
// flush (the scan's own passes AND post-scan intel/refresh) lands there. The new
// run_* columns accumulate ONLY the scan's own pipeline passes, so "what did this
// scan cost" and "what has this app cost since" are distinct questions.
// ---------------------------------------------------------------------------

/** Mock the `scans` read-modify-write flushExternalCost/costedStep perform; capture the update payload. */
function makeScanDb(current: Record<string, unknown>) {
  const captured: Array<Record<string, unknown>> = [];
  const selectMaybe = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: current }) }) });
  const updateEq = vi.fn().mockResolvedValue({ error: null });
  const update = vi.fn((payload: Record<string, unknown>) => { captured.push(payload); return { eq: updateEq }; });
  const from = vi.fn(() => ({ select: selectMaybe, update }));
  return { serverDb: vi.fn().mockReturnValue({ from }), captured };
}

async function loadTelemetry(db: ReturnType<typeof makeScanDb>) {
  vi.doMock("@/lib/db/client", () => ({ serverDb: db.serverDb }));
  const tele = await import("./scan-telemetry");
  const ctx = await import("./cost-context");
  return { flushExternalCost: tele.flushExternalCost, costedStep: tele.costedStep, ...ctx };
}

test("phase 'run' flush writes BOTH the lifetime AND the per-run columns", async () => {
  const db = makeScanDb({ dataforseo_cost_cents: 10, tavily_cost_cents: 5, run_dataforseo_cost_cents: 3, run_tavily_cost_cents: 1, external_cap_hit_at: null });
  const { flushExternalCost, newCostSink } = await loadTelemetry(db);
  const sink = newCostSink(undefined, "scan-1");
  sink.dataforseo = 0.02; // $0.02 → 2¢
  sink.tavily = 0.01; // → 1¢
  await flushExternalCost("scan-1", sink, "run");
  expect(db.captured[0]).toMatchObject({
    dataforseo_cost_cents: 12, tavily_cost_cents: 6, // lifetime += delta
    run_dataforseo_cost_cents: 5, run_tavily_cost_cents: 2, // per-run += delta
  });
});

test("phase 'post-scan' flush writes the lifetime columns ONLY — per-run untouched", async () => {
  const db = makeScanDb({ dataforseo_cost_cents: 10, tavily_cost_cents: 5, run_dataforseo_cost_cents: 3, run_tavily_cost_cents: 1, external_cap_hit_at: null });
  const { flushExternalCost, newCostSink } = await loadTelemetry(db);
  const sink = newCostSink(undefined, "scan-1");
  sink.dataforseo = 0.02;
  sink.tavily = 0.01;
  await flushExternalCost("scan-1", sink, "post-scan");
  expect(db.captured[0]).toMatchObject({ dataforseo_cost_cents: 12, tavily_cost_cents: 6 });
  expect(db.captured[0]).not.toHaveProperty("run_dataforseo_cost_cents");
  expect(db.captured[0]).not.toHaveProperty("run_tavily_cost_cents");
});

test("G8: a single RUN driven past the free cap stamps external_cap_hit_at and breaches", async () => {
  // Fresh row (lifetime 0) so the cap headroom is the run's own spend — the
  // single-run overspend R2 wants proven, NOT an accumulated total.
  const db = makeScanDb({ dataforseo_cost_cents: 0, tavily_cost_cents: 0, run_dataforseo_cost_cents: 0, run_tavily_cost_cents: 0, external_cap_hit_at: null });
  const { costedStep, externalCapBreached, recordExternalCost } = await loadTelemetry(db);
  let breachedMidRun = false;
  await costedStep("scan-fresh", async () => {
    recordExternalCost("dataforseo", 0.25); // 25¢ — past the 20¢ free cap
    breachedMidRun = externalCapBreached(); // enrichment checkpoints would now degrade
  }, { capCents: 20, phase: "run" });
  expect(breachedMidRun).toBe(true); // the cap fired mid-run → remaining enrichment halts
  expect(db.captured[0]).toHaveProperty("external_cap_hit_at"); // stamped on flush
  expect(db.captured[0]!.external_cap_hit_at).toBeTruthy();
  expect(db.captured[0]).toMatchObject({ run_dataforseo_cost_cents: 25 }); // and counted as run spend
});

test("G8: the cap stamp is first-breach-wins — an already-stamped row is not re-stamped", async () => {
  const db = makeScanDb({ dataforseo_cost_cents: 0, tavily_cost_cents: 0, run_dataforseo_cost_cents: 0, run_tavily_cost_cents: 0, external_cap_hit_at: "2026-07-17T00:00:00Z" });
  const { flushExternalCost, newCostSink } = await loadTelemetry(db);
  const sink = newCostSink(0.2, "scan-1");
  sink.dataforseo = 0.25;
  sink.breached = true;
  await flushExternalCost("scan-1", sink, "run");
  expect(db.captured[0]).not.toHaveProperty("external_cap_hit_at"); // pre-existing stamp preserved
});
