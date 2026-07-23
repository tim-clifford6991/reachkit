/**
 * C2 (launch-readiness Workstream C) — the direct paid-fresh-scan branch.
 *
 * lib/inngest/functions/scan-requested.ts forks on `scans.tier`:
 *   - tier='free'  -> runs the "free-report" step, SKIPS "full-scan"
 *   - tier='full'  -> SKIPS "free-report", runs the "full-scan" step directly
 *     (runFullScan), in the SAME scan-requested execution — not via a
 *     separate `scan/deepen` event. This is the branch an already-paid
 *     viewer takes when scanning a brand-new domain (app/api/scan/route.ts
 *     sets tier='full' at creation for a paid viewer — see
 *     app/api/scan/route.test.ts for that half of the fork).
 *
 * This is a pure unit test: `serverDb` and every pipeline stage
 * (runCollect / runFindings / runFreeReport / runFullScan / emitScanEvent /
 * scanCostCents) are mocked, and the REAL `scanRequested` Inngest function is
 * driven through `InngestTestEngine` (in-process, no Inngest dev server, no
 * DB/network) — same harness tests/integration/scan-requested-e2e.test.ts
 * uses, but with the DB layer faked instead of a real local Supabase, so it
 * runs under the default `npx vitest run`.
 */
import { beforeEach, expect, test, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
});

const SCAN_ID = "scan-fork-1";
const APP_ID = "app-fork-1";

/**
 * A `serverDb()` stand-in that answers every `.select(...).eq(...).single()`
 * scan-row lookup with the same row (tier fixed for the test), and treats any
 * other awaited chain (`.update(...).eq(...)`, no `.single()`) as a bare
 * `{ error: null }` — matching exactly how scan-requested.ts calls it at
 * each of its four steps.
 */
function makeDbMock(tier: "free" | "full") {
  const scanRow = {
    id: SCAN_ID,
    app_id: APP_ID,
    tier,
    apps: { store_url: "https://example.com/", platform: "web" as const },
  };
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn(() => chain);
  chain.update = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.single = vi.fn(async () => ({ data: scanRow, error: null }));
  // Bare `await db.from(...).update(...).eq(...)` (no `.single()`) resolves
  // via `.then` — Supabase query builders are themselves thenable.
  chain.then = (resolve: (v: { error: null }) => void) => resolve({ error: null });
  return { from: vi.fn(() => chain) };
}

function mockCommonCollaborators() {
  vi.doMock("@/lib/config/env", () => ({ env: { scanBudgetCents: 500 } }));
  vi.doMock("@/lib/scan/progress", () => ({ emitScanEvent: vi.fn(async () => {}) }));
  vi.doMock("@/lib/telemetry/pipeline-runs", () => ({ scanCostCents: vi.fn(async () => 3.5) }));
}

async function runScanRequested(tier: "free" | "full") {
  mockCommonCollaborators();
  vi.doMock("@/lib/db/client", () => ({ serverDb: () => makeDbMock(tier) }));

  const runCollect = vi.fn(async () => ({ mode: "web" }));
  const runFindings = vi.fn(async () => {});
  const runFreeReport = vi.fn(async () => {});
  const runFullScan = vi.fn(
    async (_ctx: Record<string, unknown>, _facts: Record<string, unknown>) => {},
  );
  vi.doMock("@/lib/scan/collect", () => ({ runCollect }));
  vi.doMock("@/lib/scan/findings-pipeline", () => ({ runFindings }));
  vi.doMock("@/lib/scan/free-report", () => ({ runFreeReport }));
  vi.doMock("@/lib/scan/full-scan", () => ({ runFullScan }));

  const { InngestTestEngine } = await import("@inngest/test");
  const { scanRequested } = await import("@/lib/inngest/functions/scan-requested");

  const engine = new InngestTestEngine({ function: scanRequested });
  const { result } = await engine.execute({
    events: [{ name: "scan/requested", data: { scanId: SCAN_ID } }],
  });

  return { result, runCollect, runFindings, runFreeReport, runFullScan };
}

test("scan-requested: tier='full' runs the full-scan step (runFullScan) and skips free-report", async () => {
  const { result, runFindings, runFreeReport, runFullScan } = await runScanRequested("full");

  expect(result).toMatchObject({ ok: true, factsMode: "web" });
  expect(runFindings).toHaveBeenCalledOnce();
  expect(runFullScan).toHaveBeenCalledOnce();
  expect(runFreeReport).not.toHaveBeenCalled();

  // runFullScan gets the reconstructed ScanContext + the memoized facts from collect.
  const [ctxArg, factsArg] = runFullScan.mock.calls[0]!;
  expect(ctxArg).toMatchObject({ scanId: SCAN_ID, appId: APP_ID, mode: "web" });
  expect(factsArg).toMatchObject({ mode: "web" });
});

test("scan-requested: tier='free' runs the free-report step and skips full-scan", async () => {
  const { result, runFindings, runFreeReport, runFullScan } = await runScanRequested("free");

  expect(result).toMatchObject({ ok: true, factsMode: "web" });
  expect(runFindings).toHaveBeenCalledOnce();
  expect(runFreeReport).toHaveBeenCalledOnce();
  expect(runFullScan).not.toHaveBeenCalled();
});
