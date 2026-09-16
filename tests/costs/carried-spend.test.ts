// tests/costs/carried-spend.test.ts — issue 798
//
// A row can be spent against by more than one context: setup's rival
// suggestion before the onboarding pass, and the opportunity typing after
// its report is stored. What an earlier context spent counts against the
// cap of the next, and the row's `cost_cents` ends as the sum of them.
import "../generate/env";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CAPS } from "@/lib/config/constants";

const { rowCents, updates } = vi.hoisted(() => ({
  rowCents: { value: 0 as unknown },
  updates: [] as Array<{ values: Record<string, unknown>; id: unknown }>,
}));

vi.mock("@/lib/db", () => ({
  dbAdmin: () => ({
    rpc: async () => ({ data: 0, error: null }),
    from: () => ({
      select: () => ({ eq: () => ({ limit: async () => ({ data: [{ cost_cents: rowCents.value }], error: null }) }) }),
      update: (values: Record<string, unknown>) => ({
        eq: async (_column: string, id: unknown) => {
          updates.push({ values, id });
          return { error: null };
        },
      }),
    }),
  }),
}));
vi.mock("../../src/lib/costs/cache", () => ({ readCache: async () => null }));
vi.mock("../../src/lib/costs/ledger", () => ({ writeFetchRow: async () => undefined }));

const { withCostContext } = await import("../../src/lib/costs/index");

function call(costCents: number) {
  return { source: "vendor", cacheKey: `k${costCents}`, freshnessDays: 0, costCents, run: async () => ({}) };
}

beforeEach(() => {
  updates.length = 0;
  rowCents.value = 0;
});

describe("`rollUp: \"add\"` — a context that adds to a row already carrying spend", () => {
  it("counts the row's cost against the cap and writes the total to `cost_cents` alone", async () => {
    rowCents.value = "1.5000"; // numeric(12,4), as PostgREST may answer it
    await withCostContext({ scanId: "scan-1", cap: "DEEP", policyVersion: 1, rollUp: "add" }, async (cost) => {
      expect(cost.spentCents()).toBeCloseTo(1.5, 6);
      await cost.recordFetch(call(0.2));
    });
    expect(updates).toEqual([{ values: { cost_cents: expect.closeTo(1.7, 6) }, id: "scan-1" }]);
  });

  it("a row already at the cap buys nothing more", async () => {
    rowCents.value = CAPS.DEEP_C;
    const run = vi.fn(async () => ({}));
    await withCostContext({ scanId: "scan-1", cap: "DEEP", policyVersion: 1, rollUp: "add" }, async (cost) => {
      expect(await cost.recordFetch({ ...call(0.2), run })).toEqual({ skipped: "cap" });
    });
    expect(run).not.toHaveBeenCalled();
  });
});

describe("`priorCents` — a pass that adopts a row setup already spent against", () => {
  it("is part of the pass's spend, its cap and its roll-up", async () => {
    await withCostContext({ scanId: "scan-1", cap: "DEEP", policyVersion: 1, priorCents: 1.5 }, async (cost) => {
      await cost.recordFetch(call(0.2));
    });
    expect(updates).toEqual([{ values: { cost_cents: expect.closeTo(1.7, 6), status: "done" }, id: "scan-1" }]);
  });
});
