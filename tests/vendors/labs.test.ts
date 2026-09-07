// tests/vendors/labs.test.ts — BUILD §6.3's three Labs endpoints, their
// BUILD §6.1 prices and their BUILD §6.4 cache windows (issue #23).
//
// Every row here is one of BP-008's stated behaviours (archived at
// `archive/sdlc-factory-2026-09-04/corpus/docs/blueprints/BP-008.md`,
// `## Error & edge behavior` and decision 4), read through the seam
// BUILD §6.5 defines: a call that returns nothing is `unmeasured`, a call
// that returns zero rows is `zero` and is billed, and neither is ever a
// throw.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cappedCostContext,
  envelope,
  fakeCostContext,
  setEnvFixture,
  stubVendorFetch,
} from "./harness.ts";

let labs: typeof import("../../src/lib/vendors/dataforseo/labs.ts");
let constants: typeof import("../../src/lib/config/constants.ts");

beforeAll(async () => {
  setEnvFixture();
  labs = await import("../../src/lib/vendors/dataforseo/labs.ts");
  constants = await import("../../src/lib/config/constants.ts");
});

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** One `ranked_keywords` item in the shape the vendor documents. */
function rankedItem(keyword: string, position: number, volume: number, url: string): unknown {
  return {
    keyword_data: { keyword, keyword_info: { search_volume: volume } },
    ranked_serp_element: { serp_item: { rank_group: position, url } },
  };
}

describe("BUILD §6.3 — rankedKeywords parses the vendor's own shape into RankedRow", () => {
  it("returns the measured rows, and drops an item carrying no keyword or no position", async () => {
    stubVendorFetch(() =>
      envelope({
        items: [
          rankedItem("crm software", 4, 1900, "https://example.com/crm"),
          { keyword_data: { keyword: "no position" } }, // no ranked_serp_element
          { ranked_serp_element: { serp_item: { rank_group: 2 } } }, // no keyword
          rankedItem("best crm", 11, 480, "https://example.com/best"),
        ],
      })
    );
    const { ctx } = fakeCostContext();
    const result = await labs.rankedKeywords(ctx, { domain: "example.com", rows: 50 });

    expect(result.kind).toBe("measured");
    if (result.kind !== "measured") throw new Error("unreachable");
    expect(result.value.rows).toEqual([
      { keyword: "crm software", position: 4, searchVolume: 1900, url: "https://example.com/crm" },
      { keyword: "best crm", position: 11, searchVolume: 480, url: "https://example.com/best" },
    ]);
    // No `total_count` in this envelope: `null`, never the row count in
    // disguise, so the reader can tell "we do not know" from a real total.
    expect(result.value.total).toBeNull();
  });

  // ── issue #117 ──────────────────────────────────────────────────────────
  it("carries the vendor's own `total_count` beside the rows, uncapped by the row limit", async () => {
    stubVendorFetch(() =>
      envelope({
        total_count: 4231,
        items_count: 2,
        items: [rankedItem("crm software", 4, 1900, "https://example.com/crm"), rankedItem("best crm", 11, 480, "https://example.com/best")],
      })
    );
    const { ctx } = fakeCostContext();
    const result = await labs.rankedKeywords(ctx, { domain: "example.com", rows: 50 });

    expect(result.kind).toBe("measured");
    if (result.kind !== "measured") throw new Error("unreachable");
    // The point of the issue: a total far above any row count this product
    // ever buys. Under `rows.length` the `far` band was unreachable.
    expect(result.value.total).toBe(4231);
    expect(result.value.rows).toHaveLength(2);
  });

  it("does not read `items_count` as a total — it is the rows returned under another name", async () => {
    stubVendorFetch(() =>
      envelope({ items_count: 1, items: [rankedItem("crm software", 4, 1900, "https://example.com/crm")] })
    );
    const { ctx } = fakeCostContext();
    const result = await labs.rankedKeywords(ctx, { domain: "example.com", rows: 50 });

    expect(result.kind).toBe("measured");
    if (result.kind !== "measured") throw new Error("unreachable");
    expect(result.value.total).toBeNull();
  });

  it("buys no extra rows for the total — the limit is still the row count asked for", async () => {
    const stub = stubVendorFetch(() =>
      envelope({ total_count: 9000, items: [rankedItem("k", 1, 10, "https://example.com/k")] })
    );
    const { ctx, ledgered } = fakeCostContext();
    await labs.rankedKeywords(ctx, { domain: "example.com", rows: 100 });

    expect(stub.requests).toHaveLength(1);
    expect(stub.tasks[0]).toMatchObject({ limit: 100 });
    expect(ledgered).toEqual([constants.PRICE_BOOK.RANKED_RIVAL_COST_C]);
  });

  it("sends the row count as the vendor's `limit` and the domain as its `target`", async () => {
    const stub = stubVendorFetch(() => envelope({ items: [] }));
    const { ctx } = fakeCostContext();
    await labs.rankedKeywords(ctx, { domain: "example.com", rows: 300 });

    expect(stub.requests[0]?.url).toBe("https://api.dataforseo.com/v3/dataforseo_labs/google/ranked_keywords/live");
    expect(stub.tasks[0]).toMatchObject({ target: "example.com", limit: 300 });
  });
});

describe('BP-008 error behaviour — "Zero rows is a legal, billed result … never `unmeasured`": the cold-start law, BUILD §6.3\'s "0 rows is a legal result"', () => {
  it.each([
    ["an empty items array", { items: [] }],
    ["a null items field", { items: null }],
    ["no items field at all", {}],
  ])("%s yields the `zero` arm, not `unmeasured`", async (_name, result) => {
    stubVendorFetch(() => envelope(result));
    const { ctx, ledgered } = fakeCostContext();
    const measured = await labs.rankedKeywords(ctx, { domain: "cold-start.example", rows: 50 });

    expect(measured.kind).toBe("zero");
    if (measured.kind !== "zero") throw new Error("unreachable");
    // Zero rows and a total of zero: a domain that ranks for nothing is a
    // measurement, not an absence.
    expect(measured.value).toEqual({ rows: [], total: 0 });
    // Billed: the vendor was reached and charged, so the ledger carries the
    // price whether or not the domain ranks for anything.
    expect(ledgered).toEqual([constants.PRICE_BOOK.RANKED_FREE_COST_C]);
  });
});

describe('BP-008 error behaviour — "A vendor error, a timeout or an unparseable payload returns `unmeasured` with its reason"', () => {
  it.each([
    [
      "a rejected fetch",
      () => {
        throw new Error("connect ECONNREFUSED 203.0.113.9:443");
      },
    ],
    ["a non-2xx response", () => ({ status: 502, statusText: "Bad Gateway" })],
    ["a task-level vendor error", () => envelope(undefined, 40501)],
    ["a completed task with no result", () => envelope(undefined, 20000)],
    ["a response carrying no task at all", () => ({})],
    ["a result whose items is not an array", () => envelope({ items: "not an array" })],
  ])("%s yields `unmeasured / undeterminable` and never throws", async (_name, answer) => {
    stubVendorFetch(answer as () => unknown);
    const { ctx } = fakeCostContext();
    const result = await labs.rankedKeywords(ctx, { domain: "example.com", rows: 50 });

    expect(result.kind).toBe("unmeasured");
    if (result.kind !== "unmeasured") throw new Error("unreachable");
    expect(result.reason).toBe("undeterminable");
  });
});

describe("BUILD §6.5 — a cap-skipped call is `not_attempted` and never reaches the vendor", () => {
  it.each(["rankedKeywords", "keywordSuggestions", "competitorsDomain"] as const)(
    "%s under a spent cap returns `unmeasured / not_attempted`",
    async (name) => {
      const stub = stubVendorFetch(() => envelope({ items: [] }));
      const { ctx } = cappedCostContext();
      const result =
        name === "rankedKeywords"
          ? await labs.rankedKeywords(ctx, { domain: "example.com", rows: 50 })
          : name === "keywordSuggestions"
            ? await labs.keywordSuggestions(ctx, { seed: "crm", rows: 50 })
            : await labs.competitorsDomain(ctx, { domain: "example.com" });

      expect(result.kind).toBe("unmeasured");
      if (result.kind !== "unmeasured") throw new Error("unreachable");
      expect(result.reason).toBe("not_attempted");
      expect(stub.requests).toHaveLength(0);
    }
  );
});

describe("BUILD §6.1 price book — each call reserves the pinned price, read from constants.ts", () => {
  it.each([
    [50, "RANKED_FREE_COST_C"],
    [100, "RANKED_RIVAL_COST_C"],
    [300, "RANKED_PAID_COST_C"],
  ] as const)("rankedKeywords @%i rows reserves PRICE_BOOK.%s", async (rows, pin) => {
    stubVendorFetch(() => envelope({ items: [] }));
    const { ctx, calls } = fakeCostContext();
    await labs.rankedKeywords(ctx, { domain: "example.com", rows });
    expect(calls[0]?.costCents).toBe(constants.PRICE_BOOK[pin]);
  });

  it("keywordSuggestions reserves PRICE_BOOK.SUGGESTIONS_COST_C at VENDOR.suggestionsRows", async () => {
    const stub = stubVendorFetch(() => envelope({ items: [] }));
    const { ctx, calls } = fakeCostContext();
    await labs.keywordSuggestions(ctx, { seed: "crm software", rows: 50 });
    expect(calls[0]?.costCents).toBe(constants.PRICE_BOOK.SUGGESTIONS_COST_C);
    expect(stub.tasks[0]).toMatchObject({ keyword: "crm software", limit: constants.VENDOR.suggestionsRows });
  });

  it("competitorsDomain reserves PRICE_BOOK.COMPETITORS_DOMAIN_COST_C at the row count that price is derived from", async () => {
    const stub = stubVendorFetch(() => envelope({ items: [] }));
    const { ctx, calls } = fakeCostContext();
    await labs.competitorsDomain(ctx, { domain: "example.com" });
    expect(calls[0]?.costCents).toBe(constants.PRICE_BOOK.COMPETITORS_DOMAIN_COST_C);
    expect(stub.tasks[0]).toMatchObject({ target: "example.com", limit: constants.VENDOR.competitorsDomainRows });
  });
});

describe('BUILD §6.4 — "Cache windows: own domain 7d · rivals 30d … suggestions 30d"', () => {
  it.each([
    [50, "own"],
    [300, "own"],
    [100, "rival"],
  ] as const)("rankedKeywords @%i rows passes CACHE_WINDOWS_D.%s", async (rows, window) => {
    stubVendorFetch(() => envelope({ items: [] }));
    const { ctx, calls } = fakeCostContext();
    await labs.rankedKeywords(ctx, { domain: "example.com", rows });
    expect(calls[0]?.freshnessDays).toBe(constants.CACHE_WINDOWS_D[window]);
  });

  it("keywordSuggestions passes CACHE_WINDOWS_D.suggestions", async () => {
    stubVendorFetch(() => envelope({ items: [] }));
    const { ctx, calls } = fakeCostContext();
    await labs.keywordSuggestions(ctx, { seed: "crm", rows: 50 });
    expect(calls[0]?.freshnessDays).toBe(constants.CACHE_WINDOWS_D.suggestions);
  });

  it("competitorsDomain passes CACHE_WINDOWS_D.rival — a warm-start supplement keyed on the customer's rankings", async () => {
    stubVendorFetch(() => envelope({ items: [] }));
    const { ctx, calls } = fakeCostContext();
    await labs.competitorsDomain(ctx, { domain: "example.com" });
    expect(calls[0]?.freshnessDays).toBe(constants.CACHE_WINDOWS_D.rival);
  });

  it("the cache key separates row counts, seeds and domains, and carries the pinned locale (BUILD §6.3a)", async () => {
    stubVendorFetch(() => envelope({ items: [] }));
    const { ctx, calls } = fakeCostContext();
    await labs.rankedKeywords(ctx, { domain: "example.com", rows: 50 });
    await labs.rankedKeywords(ctx, { domain: "example.com", rows: 300 });
    await labs.rankedKeywords(ctx, { domain: "other.example", rows: 50 });

    const keys = calls.map((c) => c.cacheKey);
    expect(new Set(keys).size).toBe(3);
    for (const key of keys) {
      expect(key).toContain(constants.SERP_LOCATION.location);
      expect(key).toContain(constants.SERP_LOCATION.language);
    }
  });
});

describe("BUILD §6.3 — keywordSuggestions and competitorsDomain parse into their product rows", () => {
  it("keywordSuggestions returns keyword and volume, defaulting a missing volume to 0", async () => {
    stubVendorFetch(() =>
      envelope({
        items: [
          { keyword: "crm software", keyword_info: { search_volume: 22000 } },
          { keyword: "crm tool" }, // no keyword_info
          { keyword_info: { search_volume: 10 } }, // no keyword — dropped
        ],
      })
    );
    const { ctx } = fakeCostContext();
    const result = await labs.keywordSuggestions(ctx, { seed: "crm", rows: 50 });

    expect(result.kind).toBe("measured");
    if (result.kind !== "measured") throw new Error("unreachable");
    expect(result.value).toEqual([
      { keyword: "crm software", searchVolume: 22000 },
      { keyword: "crm tool", searchVolume: 0 },
    ]);
  });

  it("competitorsDomain drops the target the vendor lists as its own first competitor", async () => {
    stubVendorFetch(() =>
      envelope({
        items: [
          { domain: "Example.com", intersections: 900 },
          { domain: "rival-one.com", intersections: 320 },
          { domain: "rival-two.com" },
        ],
      })
    );
    const { ctx } = fakeCostContext();
    const result = await labs.competitorsDomain(ctx, { domain: "example.com" });

    expect(result.kind).toBe("measured");
    if (result.kind !== "measured") throw new Error("unreachable");
    expect(result.value).toEqual([
      { domain: "rival-one.com", overlapKeywords: 320 },
      { domain: "rival-two.com", overlapKeywords: 0 },
    ]);
  });
});

describe("BUILD §6.4 never-list — Labs is live-only, so no Labs call can reach the standard queue", () => {
  it("every Labs request goes to a `/live` path and never to `task_post`", async () => {
    const stub = stubVendorFetch(() => envelope({ items: [] }));
    const { ctx } = fakeCostContext();
    await labs.rankedKeywords(ctx, { domain: "example.com", rows: 50 });
    await labs.keywordSuggestions(ctx, { seed: "crm", rows: 50 });
    await labs.competitorsDomain(ctx, { domain: "example.com" });

    expect(stub.requests).toHaveLength(3);
    for (const request of stub.requests) {
      expect(request.url.endsWith("/live")).toBe(true);
      expect(request.url).not.toContain("task_post");
      expect(request.method).toBe("POST");
    }
  });
});

// Type-level witnesses (checked by `npm run typecheck`, never executed) —
// the same convention `tests/vendors/never-list.test.ts` uses. Labs is
// live-only at the vendor, so admitting a `mode` would be a real defect.
{
  function _noLabsCallAdmitsAMode(): void {
    // @ts-expect-error — rankedKeywords admits no `mode`.
    void labs.rankedKeywords(null as never, { domain: "x", rows: 50, mode: "std" });
    // @ts-expect-error — keywordSuggestions admits no `mode`.
    void labs.keywordSuggestions(null as never, { seed: "x", rows: 50, mode: "std" });
    // @ts-expect-error — competitorsDomain admits no `mode`.
    void labs.competitorsDomain(null as never, { domain: "x", mode: "std" });
  }
  void _noLabsCallAdmitsAMode;

  function _rankedKeywordsAdmitsOnlyThePricedRowCounts(): void {
    // @ts-expect-error — 200 rows is not a price-book row.
    void labs.rankedKeywords(null as never, { domain: "x", rows: 200 });
  }
  void _rankedKeywordsAdmitsOnlyThePricedRowCounts;
}
