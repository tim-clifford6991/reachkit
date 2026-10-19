// tests/costs/vendor-days-rows.test.ts — issue 1571: PostgREST writes the
// union of an upsert's columns, so a row without `read_at` is written with
// null and the NOT NULL column refuses the whole upsert.
import "../generate/env";
import { beforeEach, describe, expect, it, vi } from "vitest";

const upserts: object[][] = [];

vi.mock("@/lib/db", () => {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "in", "update"]) builder[method] = () => builder;
  builder.upsert = (rows: object[]) => {
    upserts.push(rows);
    return builder;
  };
  // Yesterday's opening, so the billed-yesterday row is written too.
  builder.then = (resolve: (r: unknown) => void) => resolve({ data: [{ balance_cents: 5000, deposited_cents: 10100 }], error: null });
  const client = { from: () => builder };
  return { db: () => client, dbAdmin: () => client };
});

vi.mock("@/lib/vendors/dataforseo/account", () => ({
  readAccount: async () => ({ balanceCents: 4900, depositedCents: 10100 }),
}));

vi.mock("@/lib/account/stripe/client", () => ({
  stripe: () => ({ balanceTransactions: { list: async function* () { yield { currency: "eur", fee: 25 }; } } }),
}));

const { readVendorDay } = await import("../../src/lib/costs/vendor-days");

describe("every vendor_days row upserted", () => {
  beforeEach(() => {
    upserts.length = 0;
  });

  it("carries read_at, the billed-yesterday DataForSEO row included", async () => {
    const now = new Date("2026-10-19T00:00:43Z");
    await readVendorDay("usage:2026-10-19", now);
    const rows = upserts.flat();
    expect(rows).toHaveLength(2);
    for (const row of rows) expect(row).toHaveProperty("read_at", now.toISOString());
  });

  it("carries read_at on every fixed vendor's month row, Stripe's included", async () => {
    await readVendorDay("fixed:2026-09-01", new Date("2026-10-19T00:00:43Z"));
    const rows = upserts.flat();
    expect(rows).toHaveLength(5);
    for (const row of rows) expect(row).toHaveProperty("read_at");
  });
});
