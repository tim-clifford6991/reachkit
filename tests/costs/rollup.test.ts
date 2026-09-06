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
