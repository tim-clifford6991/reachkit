// tests/costs/vendor-failure-row.test.ts — issue #504
//
// "A failed or unparseable DataForSEO call ledgers a null payload." The
// vendor path had #479's hole: `run()` answered `null` for a 5xx, a timeout
// or a result the parser did not know, `fetches.payload` is `not null`, and
// the insert's throw became the stage's reason. This suite drives every
// failure kind `src/lib/vendors/dataforseo/envelope.ts` names through the
// real vendor client, the real `withCostContext().recordFetch` and the real
// `writeFetchRow`, against the memory store (`fakeDb`), and asserts the row
// the insert was handed: the failure's own shape, never a null, at the cost
// the envelope's header states — 0 cents where DataForSEO refused the call
// (it does not bill a failed task), the reservation where the call may have
// run. The live column constraint itself is `fetches-schema.test.ts`'s.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb } from "../scan/run/harness";
import { envelope, setEnvFixture, stubVendorFetch, taskCreated, taskInQueue } from "../vendors/harness";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));
// The product-wide day ledger is `daily.test.ts`'s; here it is open and
// empty, so nothing but the failure decides what the row carries.
vi.mock("@/lib/costs/daily", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/lib/costs/daily")>()),
  openDayLedger: async () => ({ spentCents: () => 0, ceilingReached: () => false, add: () => {} }),
}));

setEnvFixture();
const { withCostContext, isVendorFailure } = await import("../../src/lib/costs");
const { isEmptyPayload, readCache } = await import("../../src/lib/costs/cache");
const { rankedKeywords } = await import("../../src/lib/vendors/dataforseo/labs");
const { serpOrganic } = await import("../../src/lib/vendors/dataforseo/serp");
const { callEndpoint, ledgered } = await import("../../src/lib/vendors/dataforseo/envelope");
const { VENDOR } = await import("../../src/lib/config/constants");

const RANKED = "dataforseo_labs/google/ranked_keywords";
const SERP = "serp/google/organic";

function fetchInserts(): Record<string, unknown>[] {
  return db.queries.filter((q) => q.table === "fetches" && q.verb === "insert").map((q) => q.values ?? {});
}

async function inContext<T>(body: Parameters<typeof withCostContext<T>>[1]): Promise<T> {
  return withCostContext({ scanId: "scan-504", cap: "DEEP", policyVersion: 1, rollUp: "none" }, body);
}

/** A `fetch` that answers 200 with a body that is not JSON. */
function stubNonJsonBody(): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => {
        throw new SyntaxError("Unexpected token < in JSON at position 0");
      },
    }))
  );
}

beforeEach(() => {
  db.reset();
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("issue #504 — a failed vendor call is a row, never a null payload", () => {
  it.each([
    ["an HTTP 502", () => ({ status: 502, statusText: "Bad Gateway" }), "http_502", false],
    ["a task-level error code", () => envelope(undefined, 40501), "task_40501", false],
    [
      "a timeout",
      () => {
        throw Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError" });
      },
      "timeout",
      true,
    ],
    [
      "a dropped connection",
      () => {
        throw new Error("connect ECONNREFUSED 203.0.113.9:443");
      },
      "transport",
      true,
    ],
    ["a response carrying no task", () => ({}), "unparseable", true],
    ["a completed task with no result", () => envelope(undefined, 20000), "unparseable", true],
    ["a result whose shape the parser does not know", () => envelope({ items: "not an array" }), "unparseable", true],
  ] as const)("%s is ledgered as `%s`, billed: %s", async (_name, answer, kind, billed) => {
    stubVendorFetch(answer as () => unknown);
    const heard: unknown[] = [];
    const result = await inContext((c) =>
      rankedKeywords(c, { domain: "example.com", rows: 50, onFailure: (f) => heard.push(f) })
    );

    expect(result).toMatchObject({ kind: "unmeasured", reason: "undeterminable" });
    const rows = fetchInserts();
    expect(rows).toHaveLength(1);
    const row = rows[0]!;
    expect(row.payload).not.toBeNull();
    expect(row.payload).toEqual({ vendorFailure: kind, endpoint: RANKED, billed });
    expect(isVendorFailure(row.payload)).toBe(true);
    expect(row).toMatchObject({ scan_id: "scan-504", source: RANKED });
    // DataForSEO does not bill a call it refused; one that may have run is
    // ledgered at what was reserved for it.
    expect(Number(row.reserved_cents)).toBeGreaterThan(0);
    expect(row.cost_cents).toBe(billed ? row.reserved_cents : 0);
    // The stage that asked is told the same failure the row carries.
    expect(heard).toEqual([row.payload]);
  });

  it("a 2xx body that is not JSON is `unparseable`, billed at the reservation", async () => {
    stubNonJsonBody();
    await inContext((c) => rankedKeywords(c, { domain: "example.com", rows: 50 }));
    const row = fetchInserts()[0]!;
    expect(row.payload).toEqual({ vendorFailure: "unparseable", endpoint: RANKED, billed: true });
    expect(row.cost_cents).toBe(row.reserved_cents);
  });

  it("a standard-queue task still in the queue at the pinned deadline is `deadline`, billed — the post was charged", async () => {
    stubVendorFetch((_request, index) => (index === 0 ? taskCreated() : taskInQueue()));
    vi.useFakeTimers();
    const pending = inContext((c) =>
      serpOrganic(c, {
        query: "best crm",
        mode: "std",
        loadAsyncAiOverview: false,
        scope: { site: "site-1" },
        freshnessDays: 30,
      })
    );
    await vi.advanceTimersByTimeAsync((VENDOR.stdQueueDeadlineMin + 1) * 60 * 1000);
    const result = await pending;

    expect(result).toMatchObject({ kind: "unmeasured", reason: "undeterminable" });
    const row = fetchInserts()[0]!;
    expect(row.payload).toEqual({ vendorFailure: "deadline", endpoint: SERP, billed: true });
    expect(row.cost_cents).toBe(row.reserved_cents);
  });

  it("a `task_post` the standard queue did not accept is its task code, unbilled", async () => {
    stubVendorFetch(() => envelope(undefined, 40501));
    await inContext((c) =>
      serpOrganic(c, {
        query: "best crm",
        mode: "std",
        loadAsyncAiOverview: false,
        scope: { site: "site-1" },
        freshnessDays: 30,
      })
    );
    const row = fetchInserts()[0]!;
    expect(row.payload).toEqual({ vendorFailure: "task_40501", endpoint: SERP, billed: false });
    expect(row.cost_cents).toBe(0);
  });

  it("a failed task on a flagged SERP is not settled by the surcharge rule: unbilled is 0", async () => {
    stubVendorFetch(() => ({ status: 500, statusText: "Internal Server Error" }));
    await inContext((c) =>
      serpOrganic(c, {
        query: "best crm",
        mode: "live",
        loadAsyncAiOverview: true,
        scope: { site: "site-1" },
        freshnessDays: 30,
      })
    );
    const row = fetchInserts()[0]!;
    expect(row.payload).toEqual({ vendorFailure: "http_500", endpoint: SERP, billed: false });
    expect(row.cost_cents).toBe(0);
  });

  it("a mode the endpoint has no surface for is `no_surface`, never sent and unbilled", async () => {
    const stub = stubVendorFetch(() => envelope({ items: [] }));
    await inContext((c) =>
      ledgered(c, {
        source: "fixture/endpoint",
        cacheKey: "k",
        freshnessDays: 7,
        costCents: 1.2,
        fetch: () => callEndpoint({}, "live", {}),
        parse: () => [],
      })
    );
    expect(stub.requests).toHaveLength(0);
    const row = fetchInserts()[0]!;
    expect(row.payload).toEqual({ vendorFailure: "no_surface", endpoint: "fixture/endpoint", billed: false });
    expect(row.cost_cents).toBe(0);
  });

  it("the vendor_call log line names the failure and its bill, never the request", async () => {
    const lines: Record<string, unknown>[] = [];
    vi.spyOn(console, "log").mockImplementation((line: unknown) => {
      if (typeof line === "string") lines.push(JSON.parse(line) as Record<string, unknown>);
    });
    stubVendorFetch(() => ({ status: 503, statusText: "Service Unavailable" }));
    await inContext((c) => rankedKeywords(c, { domain: "example.com", rows: 50 }));
    expect(lines.filter((l) => l.event === "vendor_call")).toEqual([
      expect.objectContaining({ source: RANKED, outcome: "failed", failure: "http_503", billed: false, costCents: 0 }),
    ]);
  });
});

describe('BUILD §6.4, "no negative cache" — a ledgered vendor failure is never served back', () => {
  const failure = { vendorFailure: "http_502", endpoint: RANKED, billed: false };

  it("the failure shape is the zero-result shape to the cache", () => {
    expect(isEmptyPayload(failure)).toBe(true);
    expect(isEmptyPayload({ ...failure, vendorFailure: "unparseable", billed: true })).toBe(true);
  });

  it("a window holding only a failure is a miss, so the next scan buys the call again", async () => {
    db.rows.set("fetches", [{ payload: failure }]);
    const hit = await readCache({ source: RANKED, cacheKey: "k", policyVersion: 1, freshnessDays: 7 });
    expect(hit).toBeNull();
  });

  it("an answer bought before the failure is found past it", async () => {
    const answer = { rows: [{ keyword: "crm", position: 3, volume: 100, url: "https://example.com/" }], total: 1 };
    db.rows.set("fetches", [{ payload: failure }, { payload: answer }]);
    const hit = await readCache({ source: RANKED, cacheKey: "k", policyVersion: 1, freshnessDays: 7 });
    expect(hit).toEqual({ payload: answer });
  });
});
