// SPEC §6 (2026-09-22, #1004) — the LLM Mentions request, read through the
// seam BUILD §6.5 defines.
//
// Every row here is a behaviour a customer can be shown the consequence of:
// the request the pilot proved is the request that goes out (a wrong one
// buys nothing and the two cards are blank for everybody), a zero-row week
// costs the weekly cap 10c rather than 20c (which is what decides whether
// the rest of the Monday pass has money left), and a week nobody could buy
// is `unmeasured` rather than a zero (which is the difference between "the
// engines named nobody" and "we did not look").
//
// Nothing here reaches DataForSEO: `tests/setup.ts` refuses the real
// `fetch` process-wide and `stubVendorFetch` answers in its place.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cappedCostContext,
  envelope,
  fakeCostContext,
  setEnvFixture,
  stubVendorFetch,
} from "../vendors/harness.ts";

let mentions: typeof import("../../src/lib/vendors/dataforseo/mentions.ts");
let constants: typeof import("../../src/lib/config/constants.ts");

beforeAll(async () => {
  setEnvFixture();
  mentions = await import("../../src/lib/vendors/dataforseo/mentions.ts");
  constants = await import("../../src/lib/config/constants.ts");
});

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** One `search_mentions` item in the shape the pilot's own reading of the
 *  response describes (#920 comment, 2026-09-22): the question, the engine,
 *  the sources cited, and the vendor's demand and date fields. */
function item(a: {
  question: string;
  platform?: string;
  model?: string;
  sources?: { url: string }[];
  volume?: number;
  monthly?: number;
  first?: string;
  last?: string;
}): unknown {
  return {
    question: a.question,
    platform: a.platform ?? "google_ai_overview",
    model_name: a.model ?? null,
    sources: a.sources ?? [],
    ai_search_volume: a.volume ?? null,
    monthly_searches: a.monthly ?? null,
    first_response_at: a.first ?? null,
    last_response_at: a.last ?? null,
  };
}

describe("the request is the one the pilot proved (#920, #1003)", () => {
  it("sends one target with an array search_scope, the sources filter, subdomains on and the 100-row cap", async () => {
    const stub = stubVendorFetch(() => envelope({ total_count: 0, items: [] }));
    const { ctx } = fakeCostContext();
    await mentions.llmMentions(ctx, { domain: "example.com", mode: "live", scope: { site: "site-1" } });

    expect(stub.tasks).toHaveLength(1);
    const task = stub.tasks[0] as Record<string, unknown>;
    expect(task.target).toEqual([
      {
        domain: "example.com",
        search_filter: "include",
        // The array. A bare string is `40501 … must be a non-empty array`
        // and returns nothing at $0.00, which is what the first pilot run
        // spent its whole batch discovering.
        search_scope: ["sources"],
        include_subdomains: true,
      },
    ]);
    expect(task.limit).toBe(constants.PRICE_BOOK.LLM_MENTIONS_ROWS);
  });

  it("carries no location_name and no language_code — the endpoint declares neither, and an undeclared field is 40501", async () => {
    const stub = stubVendorFetch(() => envelope({ items: [] }));
    const { ctx } = fakeCostContext();
    await mentions.llmMentions(ctx, { domain: "example.com", mode: "live", scope: { site: "site-1" } });

    const task = stub.tasks[0] as Record<string, unknown>;
    expect(task).not.toHaveProperty("location_name");
    expect(task).not.toHaveProperty("language_code");
  });

  it("goes to the live surface — the vendor publishes no standard queue for search_mentions", async () => {
    const stub = stubVendorFetch(() => envelope({ items: [] }));
    const { ctx } = fakeCostContext();
    await mentions.llmMentions(ctx, { domain: "example.com", mode: "live", scope: { site: "site-1" } });

    expect(stub.requests[0]?.url).toBe(
      "https://api.dataforseo.com/v3/ai_optimization/llm_mentions/search_mentions/live"
    );
  });

  it("keys the cache on the site, not the domain alone — one customer's purchase is not another's (BP-008 decision 5)", async () => {
    stubVendorFetch(() => envelope({ items: [] }));
    const { ctx, calls } = fakeCostContext();
    await mentions.llmMentions(ctx, { domain: "example.com", mode: "live", scope: { site: "site-1" } });

    expect(calls[0]?.cacheKey).toBe("example.com|site:site-1");
    // Six days, so a Monday trigger landing an hour early is not served
    // last week's rows wearing this week's date.
    expect(calls[0]?.freshnessDays).toBe(constants.CACHE_WINDOWS_D.llmMentions);
  });
});

describe("the rows the two cards are drawn from", () => {
  it("reads the question, engine, demand and dates, and keeps the vendor's own total beside them", async () => {
    stubVendorFetch(() =>
      envelope({
        total_count: 933,
        items: [
          item({
            question: "pex versus copper pipes",
            platform: "google_ai_overview",
            model: "gemini",
            sources: [{ url: "https://example.com/guides/pex-vs-copper" }],
            volume: 2400,
            monthly: 8100,
            first: "2026-08-03T00:00:00Z",
            last: "2026-09-21T00:00:00Z",
          }),
        ],
      })
    );
    const { ctx } = fakeCostContext();
    const result = await mentions.llmMentions(ctx, {
      domain: "example.com",
      mode: "live",
      scope: { site: "site-1" },
    });

    expect(result.kind).toBe("measured");
    if (result.kind !== "measured") throw new Error("unreachable");
    expect(result.value.rows).toEqual([
      {
        question: "pex versus copper pipes",
        engine: "google_ai_overview",
        model: "gemini",
        citedUrls: ["https://example.com/guides/pex-vs-copper"],
        aiSearchVolume: 2400,
        monthlySearches: 8100,
        firstSeenAt: "2026-08-03T00:00:00Z",
        lastSeenAt: "2026-09-21T00:00:00Z",
      },
    ]);
    // The breadth the 100-row cap deliberately does not buy.
    expect(result.value.total).toBe(933);
  });

  it("keeps a question whose demand the vendor did not give, as null and never 0", async () => {
    stubVendorFetch(() => envelope({ items: [item({ question: "replace wax seal toilet" })] }));
    const { ctx } = fakeCostContext();
    const result = await mentions.llmMentions(ctx, {
      domain: "example.com",
      mode: "live",
      scope: { site: "site-1" },
    });

    if (result.kind !== "measured") throw new Error("unreachable");
    // A 0 here would sort a question the vendor could not size to the
    // bottom of a list ordered by volume, as though nobody asked it.
    expect(result.value.rows[0]?.aiSearchVolume).toBeNull();
    expect(result.value.rows[0]?.monthlySearches).toBeNull();
    expect(result.value.rows[0]?.question).toBe("replace wax seal toilet");
  });

  it("drops an item with no question at all — there is nothing left of it to show", async () => {
    stubVendorFetch(() =>
      envelope({ items: [item({ question: "a real question" }), { platform: "chatgpt", sources: [] }] })
    );
    const { ctx } = fakeCostContext();
    const result = await mentions.llmMentions(ctx, {
      domain: "example.com",
      mode: "live",
      scope: { site: "site-1" },
    });

    if (result.kind !== "measured") throw new Error("unreachable");
    expect(result.value.rows.map((row) => row.question)).toEqual(["a real question"]);
  });
});

describe("cited pages are the site's own, and a subdomain is still the site's", () => {
  it("keeps this domain's pages and drops every other domain the answer cited", () => {
    const urls = mentions.ownCitedUrls(
      [
        { url: "https://example.com/guides/pex" },
        { url: "https://www.example.com/pricing" },
        { url: "https://blog.example.com/post" },
        { url: "https://rival.example.net/pex" },
        // The brand-token trap (#1004 reads sources, not text): a rival
        // whose host merely *contains* the domain is not this site.
        { url: "https://notexample.com/pex" },
        { url: "not a url" },
      ],
      "example.com"
    );

    expect(urls).toEqual([
      "https://example.com/guides/pex",
      "https://www.example.com/pricing",
      "https://blog.example.com/post",
    ]);
  });

  it("matches a site stored with a www. prefix against its own pages", () => {
    expect(mentions.ownCitedUrls([{ url: "https://example.com/a" }], "www.example.com")).toEqual([
      "https://example.com/a",
    ]);
  });
});

describe("what a week costs the 40c weekly cap", () => {
  it("reserves the worst case — the flat request charge plus the whole row cap", async () => {
    stubVendorFetch(() => envelope({ items: [] }));
    const { ctx, calls } = fakeCostContext();
    await mentions.llmMentions(ctx, { domain: "example.com", mode: "live", scope: { site: "site-1" } });

    expect(calls[0]?.costCents).toBe(constants.LLM_MENTIONS_WORST_CASE_C);
    expect(constants.LLM_MENTIONS_WORST_CASE_C).toBe(20);
  });

  it("settles a zero-row week at the request charge alone — 10c, not the 20c it reserved", async () => {
    stubVendorFetch(() => envelope({ total_count: 0, items: [] }));
    const { ctx, ledgered } = fakeCostContext();
    const result = await mentions.llmMentions(ctx, {
      domain: "example.com",
      mode: "live",
      scope: { site: "site-1" },
    });

    // The vendor answered, with nothing. A measurement, and a billed one.
    expect(result.kind).toBe("zero");
    expect(ledgered[0]).toBe(constants.PRICE_BOOK.LLM_MENTIONS_REQUEST_C);
    // And the half it did not spend is the half the rest of the Monday
    // pass still has.
    expect(ledgered[0]).toBeLessThan(constants.LLM_MENTIONS_WORST_CASE_C);
  });

  it("settles a part-full week at the request charge plus a tenth of a cent a row", async () => {
    stubVendorFetch(() =>
      envelope({
        total_count: 52,
        items: Array.from({ length: 12 }, (_, i) => item({ question: `question ${String(i)}` })),
      })
    );
    const { ctx, ledgered } = fakeCostContext();
    await mentions.llmMentions(ctx, { domain: "example.com", mode: "live", scope: { site: "site-1" } });

    expect(ledgered[0]).toBeCloseTo(
      constants.PRICE_BOOK.LLM_MENTIONS_REQUEST_C + 12 * constants.PRICE_BOOK.LLM_MENTIONS_ROW_C,
      6
    );
  });
});

describe("a week that could not be bought is never a zero", () => {
  it("a cap with no room refuses before a byte leaves, and reads back not_attempted", async () => {
    const stub = stubVendorFetch(() => envelope({ items: [] }));
    const { ctx } = cappedCostContext("WEEKLY");
    const result = await mentions.llmMentions(ctx, {
      domain: "example.com",
      mode: "live",
      scope: { site: "site-1" },
    });

    expect(stub.requests).toHaveLength(0);
    expect(result).toMatchObject({ kind: "unmeasured", reason: "not_attempted" });
  });

  it("a vendor that answered a task error reads back undeterminable, not an empty week", async () => {
    stubVendorFetch(() => envelope(null, 40501));
    const { ctx } = fakeCostContext("WEEKLY");
    const result = await mentions.llmMentions(ctx, {
      domain: "example.com",
      mode: "live",
      scope: { site: "site-1" },
    });

    expect(result).toMatchObject({ kind: "unmeasured", reason: "undeterminable" });
  });

  it("the free path never reaches this endpoint at all (§6.2: zero AI Optimization calls)", async () => {
    const stub = stubVendorFetch(() => envelope({ items: [] }));
    const { ctx, calls } = fakeCostContext("FREE");
    const result = await mentions.llmMentions(ctx, {
      domain: "example.com",
      mode: "live",
      scope: { domain: "example.com" },
    });

    expect(stub.requests).toHaveLength(0);
    // Not even a ledger row: the refusal is before the seam, so no free
    // scan can be charged a cent of it.
    expect(calls).toHaveLength(0);
    expect(result).toMatchObject({ kind: "unmeasured", reason: "not_attempted" });
  });
});
