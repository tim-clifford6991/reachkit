// tests/costs/spend-guard.test.ts — the product-wide daily ceiling inside
// the cost seam (issue #329, BUILD §6.5).
//
// `daily.test.ts` is the arithmetic; this file is what `withCostContext`
// does with it: which calls are refused, what `capHit()` says afterwards,
// what the pass is marked as, and that a ledger nobody can read refuses
// nothing.
//
// The `node` project with `@/lib/db`, the cache and the ledger write all
// mocked, the idiom `rollup.test.ts` establishes — so what is asserted is
// which vendor call was made and which row was written, which is exactly
// what a ceiling changes.
import "../generate/env";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CAPS, SPEND_ALERT_AT } from "@/lib/config/constants";

const { rpcMock, readCacheMock, writeFetchRowMock, updates } = vi.hoisted(() => {
  const updates: Array<{ table: string; values: Record<string, unknown> }> = [];
  const rpcMock = vi.fn();
  return { rpcMock, readCacheMock: vi.fn(), writeFetchRowMock: vi.fn(), updates };
});

vi.mock("@/lib/db", () => ({
  dbAdmin: () => ({
    rpc: rpcMock,
    from(table: string) {
      return {
        update(values: Record<string, unknown>) {
          updates.push({ table, values });
          return { eq: async () => ({ error: null }) };
        },
      };
    },
  }),
}));
vi.mock("../../src/lib/costs/cache", () => ({ readCache: readCacheMock }));
vi.mock("../../src/lib/costs/ledger", () => ({ writeFetchRow: writeFetchRowMock }));

let withCostContext: typeof import("../../src/lib/costs/index").withCostContext;
let registerSpendAlertSink: typeof import("../../src/lib/costs/daily").registerSpendAlertSink;

const CEILING = CAPS.DAILY_PRODUCT_C;
const WARN = CAPS.DAILY_PRODUCT_C * SPEND_ALERT_AT.warn;
const CTX = { scanId: "scan-1", policyVersion: 1 };

/** What the day's ledger already held when the pass opened; `null` makes
 *  the read fail. */
function ledgerHolds(cents: number | null): void {
  rpcMock.mockReset();
  rpcMock.mockResolvedValue(
    cents === null
      ? { data: null, error: { message: "stubbed read failure" } }
      : { data: cents, error: null }
  );
}

beforeEach(async () => {
  updates.length = 0;
  readCacheMock.mockReset();
  readCacheMock.mockResolvedValue(null);
  writeFetchRowMock.mockReset();
  writeFetchRowMock.mockResolvedValue(undefined);
  ledgerHolds(0);
  withCostContext = (await import("../../src/lib/costs/index")).withCostContext;
  registerSpendAlertSink = (await import("../../src/lib/costs/daily")).registerSpendAlertSink;
  registerSpendAlertSink(null);
});

/** One `recordFetch` whose vendor call is counted, so "no call was made"
 *  is asserted against the vendor rather than against the return value. */
function call(cost: import("../../src/lib/costs/index").CostContext, costCents: number, ran: string[]) {
  return cost.recordFetch({
    source: "vendor",
    cacheKey: "k",
    freshnessDays: 0,
    costCents,
    run: async () => {
      ran.push("vendor");
      return {};
    },
  });
}

describe("a day that has reached its ceiling refuses new work, and holds the pass", () => {
  it("a paid pass with all of its own budget still spends nothing", async () => {
    ledgerHolds(CEILING);
    const ran: string[] = [];
    let refused: unknown;
    let hitAfter = false;

    await withCostContext({ ...CTX, cap: "DEEP" }, async (cost) => {
      refused = await call(cost, 1, ran);
      hitAfter = cost.capHit();
    });

    // The pass's own cap is 150¢ and it has spent nothing, so this refusal
    // is the day's and could be nothing else.
    expect(refused).toEqual({ skipped: "cap" });
    expect(ran).toEqual([]);
    expect(writeFetchRowMock).not.toHaveBeenCalled();
    // It holds: `capHit()` is true, so a multi-call step stops asking, and
    // the pass ends `degraded` with its report rather than failing.
    expect(hitAfter).toBe(true);
    expect(updates).toEqual([{ table: "scans", values: { cost_cents: 0, status: "degraded" } }]);
  });

  it("it degrades and never throws — §6.5's rule, under the day's ceiling as under a pass's own", async () => {
    ledgerHolds(CEILING);
    await expect(
      withCostContext({ ...CTX, cap: "FREE" }, async (cost) => {
        await call(cost, 1, []);
      })
    ).resolves.toBeUndefined();
  });

  it("a cache hit is still served: it reaches no vendor, so there is nothing for a ceiling to protect", async () => {
    ledgerHolds(CEILING);
    readCacheMock.mockResolvedValue({ payload: { cached: true } });
    let result: unknown;
    await withCostContext({ ...CTX, cap: "DEEP" }, async (cost) => {
      result = await call(cost, 1, []);
    });
    expect(result).toEqual({ payload: { cached: true }, fresh: false, costCents: 0 });
  });
});

describe("a day with headroom spends normally, until this pass takes the last of it", () => {
  it("the call under the ceiling runs and is ledgered", async () => {
    ledgerHolds(0);
    const ran: string[] = [];
    let result: unknown;
    await withCostContext({ ...CTX, cap: "DEEP" }, async (cost) => {
      result = await call(cost, 2, ran);
    });
    expect(ran).toEqual(["vendor"]);
    expect(result).toEqual({ payload: {}, fresh: true, costCents: 2 });
    expect(updates).toEqual([{ table: "scans", values: { cost_cents: 2, status: "done" } }]);
  });

  it("one pass can reach the ceiling on its own: the call that takes it lands, the next is refused", async () => {
    ledgerHolds(CEILING - 2);
    const ran: string[] = [];
    const outcomes: unknown[] = [];
    await withCostContext({ ...CTX, cap: "DEEP" }, async (cost) => {
      outcomes.push(await call(cost, 2, ran));
      outcomes.push(await call(cost, 2, ran));
    });
    expect(outcomes[0]).toEqual({ payload: {}, fresh: true, costCents: 2 });
    expect(outcomes[1]).toEqual({ skipped: "cap" });
    // Exactly one vendor call: money already spent is ledgered, and the
    // ceiling is never exceeded to finish outstanding work.
    expect(ran).toEqual(["vendor"]);
    expect(writeFetchRowMock).toHaveBeenCalledTimes(1);
  });

  it("the crossing is published once, with the figures the alert needs", async () => {
    const seen: Array<{ crossed: string; spentCents: number; ceilingCents: number }> = [];
    registerSpendAlertSink((a) => seen.push({ ...a }));
    ledgerHolds(WARN - 1);
    await withCostContext({ ...CTX, cap: "DEEP" }, async (cost) => {
      await call(cost, 1, []);
      await call(cost, 1, []);
    });
    expect(seen).toEqual([{ crossed: "warn", spentCents: WARN, ceilingCents: CEILING }]);
  });
});

describe("the day's ceiling outranks the pass's own cap, and is recorded as its own reason", () => {
  it("`cap_hit` names `daily_ceiling` when the day refused, and `scan_cap` when the pass did", async () => {
    const warned = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      ledgerHolds(CEILING);
      await withCostContext({ ...CTX, cap: "DEEP" }, async (cost) => {
        await call(cost, 1, []);
      });
      const dayLine = warned.mock.calls.map((c) => String(c[0])).find((l) => l.includes("cap_hit"));
      expect(dayLine).toBeDefined();
      expect(JSON.parse(dayLine as string)).toMatchObject({
        event: "cap_hit",
        reason: "daily_ceiling",
        cap: "DEEP",
        ceilingCents: CEILING,
      });

      warned.mockClear();
      ledgerHolds(0);
      await withCostContext({ ...CTX, cap: "FREE" }, async (cost) => {
        // 13¢ against a 12¢ free cap, on a day that has spent nothing.
        await call(cost, CAPS.FREE_C + 1, []);
      });
      const capLine = warned.mock.calls.map((c) => String(c[0])).find((l) => l.includes("cap_hit"));
      expect(JSON.parse(capLine as string)).toMatchObject({
        event: "cap_hit",
        reason: "scan_cap",
        cap: "FREE",
        ceilingCents: CAPS.FREE_C,
      });
    } finally {
      warned.mockRestore();
    }
  });

  it("one line per context, not one per skipped call — a twelve-call stage does not bury it", async () => {
    const warned = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      ledgerHolds(CEILING);
      await withCostContext({ ...CTX, cap: "DEEP" }, async (cost) => {
        for (let i = 0; i < 12; i += 1) await call(cost, 1, []);
      });
      const lines = warned.mock.calls.map((c) => String(c[0])).filter((l) => l.includes("cap_hit"));
      expect(lines).toHaveLength(1);
    } finally {
      warned.mockRestore();
    }
  });
});

describe("a ledger nobody can read refuses nothing", () => {
  it("the pass spends exactly as it did before this guard existed", async () => {
    ledgerHolds(null);
    const ran: string[] = [];
    let result: unknown;
    await withCostContext({ ...CTX, cap: "DEEP" }, async (cost) => {
      result = await call(cost, 3, ran);
    });
    expect(ran).toEqual(["vendor"]);
    expect(result).toEqual({ payload: {}, fresh: true, costCents: 3 });
    expect(updates).toEqual([{ table: "scans", values: { cost_cents: 3, status: "done" } }]);
  });
});
