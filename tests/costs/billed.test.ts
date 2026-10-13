// tests/costs/billed.test.ts — issue 1408 (SPEC §6, owner 2026-10-11).
//
// Every DataForSEO call stores the vendor's own charge beside the price
// book's estimate. Driven through the real vendor client, the real
// `withCostContext().recordFetch` and the real `writeFetchRow`, against the
// memory store, on a response DataForSEO gave on 2026-10-11
// (`fixtures/dataforseo-serp-live.json`, its result list cut to three).
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb } from "../scan/run/harness";
import { setEnvFixture, stubVendorFetch } from "../vendors/harness";

const db = fakeDb();
/** The deploy before the migration: PostgREST refuses the unknown column. */
let columnMissing = false;
const client = {
  ...db.client,
  from: (table: string) => {
    const builder = db.client.from(table) as { insert: (values: Record<string, unknown>) => unknown };
    const insert = builder.insert;
    builder.insert = (values) =>
      columnMissing && table === "fetches" && "billed_cents" in values
        ? Promise.resolve({ data: null, error: { code: "PGRST204", message: "Could not find the 'billed_cents' column of 'fetches' in the schema cache" } })
        : insert(values);
    return builder;
  },
};
vi.mock("@/lib/db", () => ({ dbAdmin: () => client, db: () => client }));
vi.mock("@/lib/costs/daily", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/lib/costs/daily")>()),
  openDayLedger: async () => ({ spentCents: () => 0, refresh: async () => {}, ceilingReached: () => false, add: () => {} }),
}));

setEnvFixture();
const { withCostContext } = await import("../../src/lib/costs");
const { serpOrganic } = await import("../../src/lib/vendors/dataforseo/serp");
const { PRICE_BOOK } = await import("../../src/lib/config/constants");

type Stored = { tasks: Record<string, unknown>[] } & Record<string, unknown>;
const STORED = JSON.parse(readFileSync(path.join(import.meta.dirname, "fixtures/dataforseo-serp-live.json"), "utf8")) as Stored;
/** The stored answer with the task's `cost` replaced, or removed. */
function withCost(cost: number | undefined): Stored {
  const task = Object.fromEntries(Object.entries(STORED.tasks[0]!).filter(([key]) => key !== "cost"));
  return { ...STORED, tasks: [cost === undefined ? task : { ...task, cost }] };
}

async function buy(answer: Stored): Promise<Record<string, unknown>[]> {
  stubVendorFetch(() => answer);
  await withCostContext({ scanId: "scan-1408", cap: "DEEP", policyVersion: 1, rollUp: "none" }, (c) =>
    serpOrganic(c, { query: "ai search visibility tool", mode: "live", loadAsyncAiOverview: false, locale: { country: "US", language: "en" }, scope: { domain: "reachkit.app" }, freshnessDays: 1 })
  );
  return db.queries.filter((q) => q.table === "fetches" && q.verb === "insert").map((q) => q.values ?? {});
}

beforeEach(() => {
  db.reset();
  columnMissing = false;
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("issue 1408 — the row keeps what the vendor billed beside what we estimated", () => {
  it("stores the vendor's charge from the response, and the price book's figure unchanged", async () => {
    // $0.002 on the stored answer; the same call at $0.0012 shows the two
    // columns are not one number written twice.
    expect(await buy(STORED)).toMatchObject([{ cost_cents: PRICE_BOOK.SERP_LIVE_C, reserved_cents: PRICE_BOOK.SERP_LIVE_C, billed_cents: 0.2 }]);
    db.reset();
    const [row] = await buy(withCost(0.0012));
    expect(row!.cost_cents).toBe(PRICE_BOOK.SERP_LIVE_C);
    expect(row!.billed_cents).toBeCloseTo(0.12);
  });

  it("stores no charge where the response carries none: the column is left null, never filled from the estimate", async () => {
    const [row] = await buy(withCost(undefined));
    expect(row!.cost_cents).toBe(PRICE_BOOK.SERP_LIVE_C);
    expect(row).not.toHaveProperty("billed_cents");
  });

  it("still writes the row when the database does not have the column yet", async () => {
    columnMissing = true;
    const rows = await buy(STORED);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ source: "serp/google/organic", cost_cents: PRICE_BOOK.SERP_LIVE_C });
    expect(rows[0]).not.toHaveProperty("billed_cents");
  });
});
