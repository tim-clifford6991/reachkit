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
