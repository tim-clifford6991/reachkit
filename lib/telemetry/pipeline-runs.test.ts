import { afterEach, describe, expect, test, vi } from "vitest";
import { anthropicCostCents, checkScanCostOverrun, MODEL_PRICES } from "./pipeline-runs";

// Mockable surface for the db-backed helpers below. checkScanCostOverrun (via
// scanCostCents) issues db.from("pipeline_runs").select("cost_cents").eq("scan_id", id),
// which resolves to { data }. Each test sets the rows it wants returned.
// vi.mock is hoisted above the static import, so the pure-cost tests are unaffected.
let nextRows: Array<{ cost_cents: number }> | null = [];
const eqMock = vi.fn(async () => ({ data: nextRows }));
const selectMock = vi.fn(() => ({ eq: eqMock }));
const fromMock = vi.fn(() => ({ select: selectMock }));
vi.mock("@/lib/db/client", () => ({ serverDb: () => ({ from: fromMock }) }));

test("cost = tokens × published rate", () => {
  const c = anthropicCostCents("claude-sonnet-4-6", 1000, 500);
  const expected = (1000 / 1e6) * MODEL_PRICES["claude-sonnet-4-6"].inPerMTokUsd * 100
                 + (500 / 1e6) * MODEL_PRICES["claude-sonnet-4-6"].outPerMTokUsd * 100;
  expect(c).toBeCloseTo(expected, 6);
});
test("Haiku is cheaper than Sonnet for identical tokens", () => {
  expect(anthropicCostCents("claude-haiku-4-5-20251001", 1000, 1000))
    .toBeLessThan(anthropicCostCents("claude-sonnet-4-6", 1000, 1000));
});

// ---------------------------------------------------------------------------
// §13 cost-overrun alert
// ---------------------------------------------------------------------------
describe("checkScanCostOverrun", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    nextRows = [];
  });

  test("logs a [cost-alert] and returns the total when over the threshold", async () => {
    nextRows = [{ cost_cents: 100 }, { cost_cents: 75 }]; // 175¢ total
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const total = await checkScanCostOverrun("scan-hot");

    expect(total).toBe(175);
    expect(errSpy).toHaveBeenCalledTimes(1);
    const msg = String(errSpy.mock.calls[0]?.[0] ?? "");
    expect(msg).toContain("[cost-alert]");
    expect(msg).toContain("scan-hot");
    expect(msg).toContain("175¢");
    expect(msg).toContain("150¢"); // default threshold
  });

  test("does NOT log and returns the total when under the threshold", async () => {
    nextRows = [{ cost_cents: 40 }, { cost_cents: 30 }]; // 70¢ total
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const total = await checkScanCostOverrun("scan-cool");

    expect(total).toBe(70);
    expect(errSpy).not.toHaveBeenCalled();
  });

  test("does NOT log when total equals the threshold exactly (strict >)", async () => {
    nextRows = [{ cost_cents: 150 }];
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const total = await checkScanCostOverrun("scan-edge");

    expect(total).toBe(150);
    expect(errSpy).not.toHaveBeenCalled();
  });

  test("honours a custom threshold", async () => {
    nextRows = [{ cost_cents: 60 }];
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const total = await checkScanCostOverrun("scan-custom", 50);

    expect(total).toBe(60);
    expect(errSpy).toHaveBeenCalledTimes(1);
    expect(String(errSpy.mock.calls[0]?.[0] ?? "")).toContain("50¢");
  });

  test("treats a null/empty result set as 0¢ (no log)", async () => {
    nextRows = null;
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const total = await checkScanCostOverrun("scan-empty");

    expect(total).toBe(0);
    expect(errSpy).not.toHaveBeenCalled();
  });
});
