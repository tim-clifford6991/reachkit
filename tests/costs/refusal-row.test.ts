// tests/costs/refusal-row.test.ts — issue #479
//
// "A refused fetch is ledgered with a null payload." `fetches.payload` is
// `not null`; the own-site read handed a refusal over as `null`, the insert
// threw, and the throw — not the refusal — became the stage's reason
// (cal.com, M3 run 5). This suite drives every refusal kind the egress seam
// can answer through the real `withCostContext().recordFetch` and the real
// `writeFetchRow`, against the memory store (`fakeDb`, the pipeline
// suites' PostgREST double), and asserts the row the insert was handed:
// the refusal's own shape, at 0 cents, never a null. The live column
// constraint itself is `tests/costs/fetches-schema.test.ts`'s.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb } from "../scan/run/harness";
import type { FetchOutcome } from "../../src/lib/egress/types";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));
// The product-wide day ledger is `daily.test.ts`'s; here it is open and
// empty, so nothing but the refusal decides what the row carries.
vi.mock("@/lib/costs/daily", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/lib/costs/daily")>()),
  openDayLedger: async () => ({ spentCents: () => 0, ceilingReached: () => false, add: () => {} }),
}));

const { withCostContext, refusalOf, isFetchRefusal } = await import("../../src/lib/costs");
const { isEmptyPayload, readCache } = await import("../../src/lib/costs/cache");
const { measureDomain } = await import("../../src/lib/measure");
const { OWN_FETCH_SOURCE } = await import("../../src/lib/measure/own-fetch");

type Reason = Extract<FetchOutcome, { ok: false }>["reason"];

/** Every `ok: false` reason `FetchOutcome` declares — the five the issue
 *  names plus the two a server's own answer produces. */
const REASONS: readonly Reason[] = [
  "dns",
  "refused",
  "timeout",
  "too_large",
  "blocked_by_policy",
  "robots_disallowed",
  "status",
];

const HOME = "https://cal.com/";
const READ_AT = new Date("2026-09-10T19:03:00.000Z");

function refused(reason: Reason): Extract<FetchOutcome, { ok: false }> {
  return reason === "status"
    ? { ok: false, reason, status: 503, url: HOME, readAt: READ_AT }
    : { ok: false, reason, url: HOME, readAt: READ_AT };
}

function fetchInserts(): Record<string, unknown>[] {
  return db.queries
    .filter((q) => q.table === "fetches" && q.verb === "insert")
    .map((q) => q.values ?? {});
}

async function inContext<T>(body: Parameters<typeof withCostContext<T>>[1]): Promise<T> {
  return withCostContext({ scanId: "scan-479", cap: "FREE", policyVersion: 1, rollUp: "none" }, body);
}

beforeEach(() => {
  db.reset();
  vi.spyOn(console, "log").mockImplementation(() => {});
});

describe("issue #479 — a refusal is a row, never a null payload", () => {
  it.each(REASONS)("a `%s` refusal is ledgered with its reason, status, bytes and host, at 0 cents", async (reason) => {
    await inContext(async (c) =>
      c.recordFetch({
        source: OWN_FETCH_SOURCE,
        cacheKey: HOME,
        freshnessDays: 7,
        costCents: 0,
        run: async () => refusalOf(refused(reason)),
      })
    );

    const rows = fetchInserts();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.payload).not.toBeNull();
    expect(rows[0]).toMatchObject({
      scan_id: "scan-479",
      source: OWN_FETCH_SOURCE,
      cache_key: HOME,
      cost_cents: 0,
      payload: { refusal: reason, status: reason === "status" ? 503 : null, bytes: 0, host: "cal.com" },
    });
    expect(isFetchRefusal(rows[0]!.payload)).toBe(true);
  });

  it("a refusal settles at 0 cents whatever was reserved for it — a refused fetch bought nothing", async () => {
    const answer = await inContext(async (c) =>
      c.recordFetch({
        source: "vendor.fixture",
        cacheKey: "k",
        freshnessDays: 7,
        costCents: 1.8,
        run: async () => refusalOf(refused("timeout")),
      })
    );
    expect(answer).toMatchObject({ fresh: true, costCents: 0 });
    expect(fetchInserts()[0]).toMatchObject({ reserved_cents: 1.8, cost_cents: 0 });
  });

  it.each(REASONS)(
    "the own-site read itself (`measureDomain`) ledgers a `%s` home refusal as that row, not a null",
    async (reason) => {
      const ranked = vi.fn();
      const robots = vi.fn();
      const result = await inContext(async (c) =>
        measureDomain(
          c,
          { domain: "cal.com", tier: "free" },
          {
            fetchDocument: async () => refused(reason),
            readRobots: robots,
            rankedKeywords: ranked,
          }
        )
      );

      const rows = fetchInserts();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        source: OWN_FETCH_SOURCE,
        cache_key: HOME,
        cost_cents: 0,
        payload: { refusal: reason, bytes: 0, host: "cal.com" },
      });
      expect(result.homeRefusal).toBe(reason);
      expect(result.onPage).toEqual({ kind: "unmeasured", reason: "undeterminable", at: READ_AT });
      // Nothing else is read or bought for a site whose home was refused.
      expect(robots).not.toHaveBeenCalled();
      expect(ranked).not.toHaveBeenCalled();
    }
  );
});

describe('BUILD §6.4, "no negative cache" — a ledgered refusal is never served back', () => {
  it("the refusal shape is the zero-result shape to the cache", () => {
    for (const reason of REASONS) expect(isEmptyPayload(refusalOf(refused(reason)))).toBe(true);
  });

  it("a window holding only a refusal is a miss, so the next scan reads the site again", async () => {
    db.rows.set("fetches", [{ payload: refusalOf(refused("too_large")) }]);
    const hit = await readCache({ source: OWN_FETCH_SOURCE, cacheKey: HOME, policyVersion: 1, freshnessDays: 7 });
    expect(hit).toBeNull();
  });

  it("a document read after the refusal is found past it", async () => {
    const document = { url: HOME, status: 200, html: "<h1>x</h1>", bytes: 10, readAt: READ_AT.toISOString() };
    db.rows.set("fetches", [{ payload: refusalOf(refused("timeout")) }, { payload: document }]);
    const hit = await readCache({ source: OWN_FETCH_SOURCE, cacheKey: HOME, policyVersion: 1, freshnessDays: 7 });
    expect(hit).toEqual({ payload: document });
  });
});
