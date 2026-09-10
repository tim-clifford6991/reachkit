// tests/costs/rollup.test.ts — `withCostContext`'s close, and the one
// caller that must not write it (BUILD §8).
//
// Every context ledgers its `fetches` rows against a scan, because
// `fetches.scan_id` is `not null`. A *scan's* context then rolls its total
// up onto `scans.cost_cents`/`scans.status` at close. A **draft's** context
// spends against the scan that grounds the day's page, but the draft's cost
// is the draft's (`drafts.cost_cents`, BUILD §10): rolling it onto the scan
// would overstate what the scan cost and would flip a scan that degraded
// back to `done`.
//
// This suite runs under the `node` project and mocks `@/lib/db`, so it
// asserts *which write happens* rather than what a row ends up holding —
// which is precisely the distinction under test.
import "../generate/env";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbAdminMock, readCacheMock, writeFetchRowMock, updates } = vi.hoisted(() => {
  const updates: Array<{ table: string; values: Record<string, unknown> }> = [];
  const dbAdminMock = vi.fn(() => ({
    from(table: string) {
      return {
        update(values: Record<string, unknown>) {
          updates.push({ table, values });
          return { eq: async () => ({ error: null }) };
        },
      };
    },
  }));
  return { dbAdminMock, readCacheMock: vi.fn(), writeFetchRowMock: vi.fn(), updates };
});

vi.mock("@/lib/db", () => ({ dbAdmin: dbAdminMock }));
vi.mock("../../src/lib/costs/cache", () => ({ readCache: readCacheMock }));
vi.mock("../../src/lib/costs/ledger", () => ({ writeFetchRow: writeFetchRowMock }));

let withCostContext: typeof import("../../src/lib/costs/index").withCostContext;

beforeEach(async () => {
  updates.length = 0;
  readCacheMock.mockReset();
  readCacheMock.mockResolvedValue(null);
  writeFetchRowMock.mockReset();
  writeFetchRowMock.mockResolvedValue(undefined);
  ({ withCostContext } = await import("../../src/lib/costs/index"));
});

const CTX = { scanId: "scan-1", policyVersion: 1 };

describe("the close writes the scan's roll-up by default", () => {
  it("a scan's context updates `scans` with what it spent", async () => {
    await withCostContext({ ...CTX, cap: "FREE" }, async (cost) => {
      await cost.recordFetch({
        source: "vendor",
        cacheKey: "k",
        freshnessDays: 0,
        costCents: 2,
        run: async () => ({}),
      });
    });
    expect(updates).toEqual([{ table: "scans", values: { cost_cents: 2, status: "done" } }]);
  });

  it("sub-cent calls roll up to the fraction of a cent they cost (issue #449)", async () => {
    // The production shape of a free pass: twelve standard SERPs at
    // `SERP_STD_C` 0.06¢ each. `fetches.cost_cents` and `scans.cost_cents`
    // are `numeric(12,4)`, so the arithmetic this seam already did in
    // floats is the arithmetic the column stores — no cent is rounded into
    // existence and none is rounded away.
    await withCostContext({ ...CTX, cap: "FREE" }, async (cost) => {
      for (let i = 0; i < 12; i++) {
        await cost.recordFetch({
          source: "serpOrganic",
          cacheKey: `k${i}`,
          freshnessDays: 0,
          costCents: 0.06,
          run: async () => ({}),
        });
      }
    });
    const [update] = updates;
    expect(update?.table).toBe("scans");
    expect(update?.values.status).toBe("done");
    expect(update?.values.cost_cents).toBeCloseTo(0.72, 4);
    // Not zero, which is what the `integer` column recorded for every one
    // of those twelve rows, and not 1¢ either.
    expect(update?.values.cost_cents).not.toBe(0);
  });

  it("a settled figure of a fraction of a cent is ledgered at that fraction, never rounded to the reservation", async () => {
    // `settleCents` is the LLM shape — a charge computed from the response,
    // landing on figures like 1.12928, which is the literal string the
    // `integer` column rejected on production.
    await withCostContext({ ...CTX, cap: "DEEP" }, async (cost) => {
      await cost.recordFetch({
        source: "llm.haiku",
        cacheKey: "k",
        freshnessDays: 0,
        costCents: 4,
        settleCents: () => 1.12928,
        run: async () => ({}),
      });
    });
    expect(writeFetchRowMock.mock.calls[0]?.[0]).toMatchObject({
      reservedCents: 4,
      costCents: 1.12928,
    });
    expect(updates[0]?.values.cost_cents).toBe(1.12928);
  });

  it("omitting the argument behaves exactly as it did before the argument existed", async () => {
    await withCostContext({ ...CTX, cap: "DEEP" }, async () => undefined);
    expect(updates).toHaveLength(1);
  });
});

describe("a draft's context writes no roll-up", () => {
  it("`rollUp: \"none\"` leaves `scans` untouched — the draft's spend is not the scan's", async () => {
    await withCostContext({ ...CTX, cap: "DRAFT", rollUp: "none" }, async (cost) => {
      await cost.recordFetch({
        source: "generate.brief",
        cacheKey: "k",
        freshnessDays: 0,
        costCents: 3,
        run: async () => ({}),
      });
    });
    expect(updates).toEqual([]);
  });

  it("the ledger row is still written: `fetches` is the source of truth, the roll-up only a summary", async () => {
    await withCostContext({ ...CTX, cap: "DRAFT", rollUp: "none" }, async (cost) => {
      await cost.recordFetch({
        source: "generate.brief",
        cacheKey: "k",
        freshnessDays: 0,
        costCents: 3,
        run: async () => ({}),
      });
    });
    expect(writeFetchRowMock).toHaveBeenCalledTimes(1);
    expect(writeFetchRowMock.mock.calls[0]?.[0]).toMatchObject({ scanId: "scan-1", costCents: 3 });
  });

  it("a degraded draft context does not flip the grounding scan's status", async () => {
    await withCostContext({ ...CTX, cap: "DRAFT", rollUp: "none" }, async (cost) => {
      // Reserving more than `CAP_DRAFT` degrades the context.
      await cost.recordFetch({
        source: "generate.draft",
        cacheKey: "k",
        freshnessDays: 0,
        costCents: 10_000,
        run: async () => ({}),
      });
      expect(cost.degraded()).toBe(true);
    });
    expect(updates).toEqual([]);
  });
});
