// tests/costs/site-cap.test.ts — the per-site daily cap inside the cost
// seam (issue 885, SPEC §6 2026-09-18).
//
// `spend-guard.test.ts` beside this one is the product-wide ceiling. This
// file is the thing that ceiling cannot do: refuse *one* site and leave
// every other site's call untouched. Before this cap existed a single site
// in a retry loop could spend the whole day, after which every other
// customer's pass, draft and publish was refused until midnight UTC — so
// the case the suite opens with is the one that failed then and passes
// now.
//
// The `node` project with `@/lib/db`, the cache and the ledger write all
// mocked, the idiom `spend-guard.test.ts` and `rollup.test.ts` share: what
// is asserted is which vendor call was made, which row was written and
// which line was logged, which is exactly what a cap changes.
import "../generate/env";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CAPS } from "@/lib/config/constants";

const { rpcMock, readCacheMock, writeFetchRowMock, scanRows, updates } = vi.hoisted(() => {
  const updates: Array<{ table: string; values: Record<string, unknown> }> = [];
  /** What each scan row carries: the site whose cap its spend is charged
   *  to, or `null` for a free scan, which has no customer to charge. */
  const scanRows = new Map<string, { cost_cents: number; site_id: string | null }>();
  return { rpcMock: vi.fn(), readCacheMock: vi.fn(), writeFetchRowMock: vi.fn(), scanRows, updates };
});

vi.mock("@/lib/db", () => ({
  dbAdmin: () => ({
    rpc: rpcMock,
    from(table: string) {
      let scanId = "";
      const builder = {
        select() {
          return builder;
        },
        eq(_column: string, value: string) {
          scanId = value;
          return builder;
        },
        limit: async () => ({ data: [scanRows.get(scanId) ?? { cost_cents: 0, site_id: null }], error: null }),
        update(values: Record<string, unknown>) {
          updates.push({ table, values });
          return { eq: async () => ({ error: null }) };
        },
      };
      return builder;
    },
  }),
}));
vi.mock("../../src/lib/costs/cache", () => ({ readCache: readCacheMock }));
vi.mock("../../src/lib/costs/ledger", () => ({ writeFetchRow: writeFetchRowMock }));

let withCostContext: typeof import("../../src/lib/costs/index").withCostContext;
let registerSpendAlertSink: typeof import("../../src/lib/costs/daily").registerSpendAlertSink;

const SITE_CAP = CAPS.DAILY_SITE_C;
const SITE_A = "11111111-1111-4111-8111-111111111111";
const SITE_B = "22222222-2222-4222-8222-222222222222";

/** What each site's day already held, and what the product's day held.
 *  `null` for a site makes its own read fail, which is issue 792's rule:
 *  nothing is spent on a number nobody has. */
let productSpend = 0;
const siteSpend = new Map<string, number | null>();

function scanFor(siteId: string | null, scanId: string): string {
  scanRows.set(scanId, { cost_cents: 0, site_id: siteId });
  return scanId;
}

beforeEach(async () => {
  updates.length = 0;
  scanRows.clear();
  siteSpend.clear();
  productSpend = 0;
  readCacheMock.mockReset();
  readCacheMock.mockResolvedValue(null);
  writeFetchRowMock.mockReset();
  writeFetchRowMock.mockResolvedValue(undefined);
  rpcMock.mockReset();
  rpcMock.mockImplementation(async (fn: string, args: Record<string, unknown>) => {
    if (fn === "fetches_site_spend_since") {
      const key = String(args.p_site_id);
      const held = siteSpend.has(key) ? siteSpend.get(key)! : 0;
      return held === null
        ? { data: null, error: { message: "fetches_site_spend_since: stubbed read failure" } }
        : { data: held, error: null };
    }
    return { data: productSpend, error: null };
  });
  withCostContext = (await import("../../src/lib/costs/index")).withCostContext;
  registerSpendAlertSink = (await import("../../src/lib/costs/daily")).registerSpendAlertSink;
  registerSpendAlertSink(null);
});

/** One `recordFetch` whose vendor call is counted, so "no call was made" is
 *  asserted against the vendor rather than against the return value. */
function call(
  cost: import("../../src/lib/costs/index").CostContext,
  costCents: number,
  ran: string[]
) {
  return cost.recordFetch({
    source: "vendor",
    cacheKey: `k${ran.length}`,
    freshnessDays: 0,
    costCents,
    run: async () => {
      ran.push("vendor");
      return {};
    },
  });
}

describe("one site's cap is one site's — the property the product-wide ceiling cannot give", () => {
  it("a site at its own cap is refused, and another site's call is untouched", async () => {
    siteSpend.set(SITE_A, SITE_CAP);
    siteSpend.set(SITE_B, 0);
    const ranA: string[] = [];
    const ranB: string[] = [];
    let refusedA: unknown;
    let servedB: unknown;

    await withCostContext(
      { scanId: scanFor(SITE_A, "scan-a"), cap: "DEEP", policyVersion: 1 },
      async (cost) => {
        refusedA = await call(cost, 1, ranA);
      }
    );
    await withCostContext(
      { scanId: scanFor(SITE_B, "scan-b"), cap: "DEEP", policyVersion: 1 },
      async (cost) => {
        servedB = await call(cost, 1, ranB);
      }
    );

    // The day's product ledger is at 0¢ and each pass's own cap is 150¢, so
    // the only thing that could have refused site A is its own.
    expect(refusedA).toEqual({ skipped: "cap" });
    expect(ranA).toEqual([]);
    // And site B — a different customer, the same day, the same product —
    // is served.
    expect(servedB).toMatchObject({ fresh: true, costCents: 1 });
    expect(ranB).toEqual(["vendor"]);
  });

  it("the refused site's pass holds with its report: it degrades, it never throws", async () => {
    siteSpend.set(SITE_A, SITE_CAP);
    await expect(
      withCostContext(
        { scanId: scanFor(SITE_A, "scan-a"), cap: "DEEP", policyVersion: 1 },
        async (cost) => {
          await call(cost, 1, []);
          expect(cost.capHit()).toBe(true);
        }
      )
    ).resolves.toBeUndefined();
    expect(updates).toEqual([{ table: "scans", values: { cost_cents: 0, status: "degraded" } }]);
  });

  it("the log names which site, and says it was the site's cap and not the day's", async () => {
    siteSpend.set(SITE_A, SITE_CAP);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    let lines: Record<string, unknown>[] = [];
    try {
      await withCostContext(
        { scanId: scanFor(SITE_A, "scan-a"), cap: "DEEP", policyVersion: 1 },
        async (cost) => {
          await call(cost, 1, []);
        }
      );
      // Read before restoring: `mockRestore` clears the recorded calls as
      // well as putting the real `console.warn` back.
      lines = warn.mock.calls
        .map(([line]) => JSON.parse(String(line)) as Record<string, unknown>)
        .filter((line) => line.event === "cap_hit");
    } finally {
      warn.mockRestore();
    }
    expect(lines).toEqual([
      {
        event: "cap_hit",
        reason: "site_cap",
        source: "vendor",
        cap: "DEEP",
        spentCents: SITE_CAP,
        ceilingCents: SITE_CAP,
        siteId: SITE_A,
      },
    ]);
  });

  it("a free scan carries no site, so no per-site cap applies and no site read is made", async () => {
    const ran: string[] = [];
    await withCostContext(
      { scanId: scanFor(null, "scan-free"), cap: "FREE", policyVersion: 1 },
      async (cost) => {
        await call(cost, 1, ran);
      }
    );
    expect(ran).toEqual(["vendor"]);
    expect(rpcMock.mock.calls.map(([fn]) => fn)).not.toContain("fetches_site_spend_since");
  });

  it("a site total that cannot be read holds the call — a figure nobody has is not room to spend (issue 792)", async () => {
    siteSpend.set(SITE_A, null);
    const ran: string[] = [];
    let refused: unknown;
    await withCostContext(
      { scanId: scanFor(SITE_A, "scan-a"), cap: "DEEP", policyVersion: 1 },
      async (cost) => {
        refused = await call(cost, 1, ran);
      }
    );
    expect(refused).toEqual({ skipped: "cap" });
    expect(ran).toEqual([]);
    expect(writeFetchRowMock).not.toHaveBeenCalled();
  });
});

describe("the owner is told once, by the call that carried the site over its cap", () => {
  it("one alert, naming the site — and nothing again for the calls refused after it", async () => {
    siteSpend.set(SITE_A, SITE_CAP - 1);
    const seen: unknown[] = [];
    registerSpendAlertSink((alert) => seen.push({ ...alert }));
    const ran: string[] = [];
    let second: unknown;
    let third: unknown;

    await withCostContext(
      { scanId: scanFor(SITE_A, "scan-a"), cap: "DEEP", policyVersion: 1 },
      async (cost) => {
        // Lands: the site is 1¢ under its cap, so this call is authorised
        // and it is the one that takes the site over.
        await call(cost, 2, ran);
        second = await call(cost, 2, ran);
        third = await call(cost, 2, ran);
      }
    );
    registerSpendAlertSink(null);

    expect(ran).toEqual(["vendor"]);
    expect(second).toEqual({ skipped: "cap" });
    expect(third).toEqual({ skipped: "cap" });
    expect(seen).toEqual([
      {
        crossed: "ceiling",
        spentCents: SITE_CAP + 1,
        ceilingCents: SITE_CAP,
        subject: { kind: "site", siteId: SITE_A },
      },
    ]);
  });

  it("a site that opens the day already over its cap alerts nobody: the crossing was somebody else's call", async () => {
    siteSpend.set(SITE_A, SITE_CAP + 50);
    const seen: unknown[] = [];
    registerSpendAlertSink((alert) => seen.push(alert));
    await withCostContext(
      { scanId: scanFor(SITE_A, "scan-a"), cap: "DEEP", policyVersion: 1 },
      async (cost) => {
        await call(cost, 1, []);
      }
    );
    registerSpendAlertSink(null);
    expect(seen).toEqual([]);
  });
});
