// tests/market/rivals/tracked.test.ts — BUILD §6.6 (issue #140)
//
// The rivals the customer chose, read back. §6.6's sizing is "one entry
// per rival the customer chose", so the order is the customer's and every
// entry survives — the mutation this suite exists to kill is a read that
// sorts, truncates or tops the list up from somewhere else.
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

import { beforeEach, describe, expect, it, vi } from "vitest";

interface Query {
  table: string;
  filters: [string, unknown][];
}

const state: { rows: unknown[]; error: { message: string } | null; queries: Query[] } = {
  rows: [],
  error: null,
  queries: [],
};

vi.mock("@/lib/db", () => ({
  dbAdmin: () => ({
    from(table: string) {
      const query: Query = { table, filters: [] };
      state.queries.push(query);
      const self = {
        select: () => self,
        eq(column: string, value: unknown) {
          query.filters.push([column, value]);
          return self;
        },
        limit: () => self,
        then: (resolve: (r: unknown) => unknown) =>
          Promise.resolve(resolve({ data: state.error ? null : state.rows, error: state.error })),
      };
      return self;
    },
  }),
  db: () => {
    throw new Error("trackedRivals reads through dbAdmin()");
  },
}));

const { trackedRivals } = await import("../../../src/lib/market/rivals/tracked");

const SITE = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  state.rows = [];
  state.error = null;
  state.queries.length = 0;
});

describe("REQ-096 — one entry per rival the customer chose, in their order", () => {
  it("keeps the order the customer handed in, and reduces each to the one canonical key", async () => {
    state.rows = [{ competitors: ["https://Zoho.com/pricing", "www.hubspot.com", "pipedrive.com"] }];
    expect(await trackedRivals(SITE)).toEqual(["zoho.com", "hubspot.com", "pipedrive.com"]);
  });

  it("reads the site it was asked about and no other", async () => {
    state.rows = [{ competitors: [] }];
    await trackedRivals(SITE);
    expect(state.queries).toHaveLength(1);
    expect(state.queries[0]!.table).toBe("sites");
    expect(state.queries[0]!.filters).toEqual([["id", SITE]]);
  });

  it("drops nothing it can parse — five rivals in, five out", async () => {
    state.rows = [{ competitors: ["a.com", "b.com", "c.com", "d.com", "e.com"] }];
    expect(await trackedRivals(SITE)).toHaveLength(5);
  });

  it("caps nothing of its own: the schema's check constraint is the only bound", async () => {
    // A row that somehow carries six is read as six rather than silently
    // truncated here — a second bound would be the one that eventually
    // disagrees with `sites_competitors_max_5`.
    state.rows = [{ competitors: ["a.com", "b.com", "c.com", "d.com", "e.com", "f.com"] }];
    expect(await trackedRivals(SITE)).toHaveLength(6);
  });
});

describe("what cannot be a target is not sent to a vendor as one", () => {
  it("drops an entry no parser can turn into a domain", async () => {
    state.rows = [{ competitors: ["a.com", "not a hostname", "", "10.0.0.1", "b.com"] }];
    expect(await trackedRivals(SITE)).toEqual(["a.com", "b.com"]);
  });

  it("drops a duplicate rather than buying the same rival twice", async () => {
    state.rows = [{ competitors: ["a.com", "https://www.a.com/pricing", "b.com"] }];
    expect(await trackedRivals(SITE)).toEqual(["a.com", "b.com"]);
  });

  it("drops a non-string without taking the rest of the list with it", async () => {
    state.rows = [{ competitors: ["a.com", 7, null, "b.com"] }];
    expect(await trackedRivals(SITE)).toEqual(["a.com", "b.com"]);
  });
});

describe("no rivals, no site and no answer are three different things", () => {
  it("a customer who tracks none reads as an empty list — a measured zero", async () => {
    state.rows = [{ competitors: [] }];
    expect(await trackedRivals(SITE)).toEqual([]);
  });

  it("a site that is not there reads as null, never as 'tracks none'", async () => {
    state.rows = [];
    expect(await trackedRivals(SITE)).toBeNull();
  });

  it("a query that failed throws rather than answering an empty list", async () => {
    state.error = { message: "connection reset" };
    await expect(trackedRivals(SITE)).rejects.toThrow(/trackedRivals/);
  });

  it("a column holding something the schema does not admit reads as empty, never as a guess", async () => {
    state.rows = [{ competitors: "hubspot.com" }];
    expect(await trackedRivals(SITE)).toEqual([]);
  });
});
