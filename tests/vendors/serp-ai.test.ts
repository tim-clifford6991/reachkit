// tests/vendors/serp-ai.test.ts — serpOrganic, aiMode and llmScraper:
// BUILD §6.2's AI-visibility ruling, BUILD §6.3's closed list, BUILD §6.4's
// never-list and standard-queue rule, BUILD §6.5's seam (issue #23).
//
// The rows that matter for money are here: the AI Overview rides inside the
// organic SERP at 0¢ extra, `load_async_ai_overview` reaches the wire on
// exactly one function and only as the caller decided it (DECISIONS
// 2026-09-03 / ADR-094), a flagged call reserves the surcharge and settles
// the vendor's documented charge from the response, and the free path makes
// zero AI-Optimization calls.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cappedCostContext,
  envelope,
  fakeCostContext,
  setEnvFixture,
  stubVendorFetch,
  taskCreated,
  taskInQueue,
} from "./harness.ts";

let serp: typeof import("../../src/lib/vendors/dataforseo/serp.ts");
let ai: typeof import("../../src/lib/vendors/dataforseo/ai.ts");
let constants: typeof import("../../src/lib/config/constants.ts");

beforeAll(async () => {
  setEnvFixture();
  serp = await import("../../src/lib/vendors/dataforseo/serp.ts");
  ai = await import("../../src/lib/vendors/dataforseo/ai.ts");
  constants = await import("../../src/lib/config/constants.ts");
});

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function organic(position: number, domain: string): unknown {
  return { type: "organic", rank_group: position, domain, url: `https://${domain}/p`, title: `${domain} page` };
}

/** The `ai_overview` item as the vendor documents it: `references` live on
 *  the element children, and `asynchronous_ai_overview` says which surface
 *  the overview came from. */
function aiOverviewItem(opts: { async: boolean; domains: string[] }): unknown {
  return {
    type: "ai_overview",
    asynchronous_ai_overview: opts.async,
    markdown: "The best options are …",
    items: [
      {
        type: "ai_overview_element",
        references: opts.domains.map((domain) => ({ domain, url: `https://${domain}/cited`, title: domain })),
      },
    ],
  };
}

/** Whose purchase these calls are (#75). A site rather than a domain: the
 *  paid battery is the call site the per-site key exists for, and the free
 *  path's own shape is asserted in `cache-scope.test.ts`. */
const SCOPE = { site: "site-1" } as const;

/** §6.4's SERP window, as the caller now passes it — read from the pin and
 *  never written down. A function because `constants` is imported inside
 *  `beforeAll`, after the environment fixture is in place. The weekly
 *  re-check's own window is asserted where the exception lives. */
const WINDOW = (): number => constants.CACHE_WINDOWS_D.serp;

describe('BUILD §6.2 — "the free AI matrix rides here at 0¢ extra": one call, one ledger row, both halves', () => {
  it("a SERP carrying organic results and an ai_overview yields both in one SerpResult, billed once at the SERP price", async () => {
    const stub = stubVendorFetch(() =>
      envelope({ items: [organic(1, "rival-one.com"), organic(2, "rival-two.com"), aiOverviewItem({ async: false, domains: ["rival-one.com", "wikipedia.org"] })] })
    );
    const { ctx, ledgered } = fakeCostContext();
    const result = await serp.serpOrganic(ctx, { query: "best crm", mode: "live", loadAsyncAiOverview: false, scope: SCOPE, freshnessDays: WINDOW() });

    expect(stub.requests).toHaveLength(1);
    expect(ledgered).toEqual([constants.PRICE_BOOK.SERP_LIVE_C]);
    expect(result.kind).toBe("measured");
    if (result.kind !== "measured") throw new Error("unreachable");
    expect(result.value.organic).toEqual([
      { position: 1, domain: "rival-one.com", url: "https://rival-one.com/p", title: "rival-one.com page" },
      { position: 2, domain: "rival-two.com", url: "https://rival-two.com/p", title: "rival-two.com page" },
    ]);
    expect(result.value.aiOverview).toEqual({
      present: true,
      asynchronousAiOverview: false,
      referenceDomains: ["rival-one.com", "wikipedia.org"],
    });
  });

  it('a SERP Google served no AI answer on is `present: false` — a muted cell, never a miss', async () => {
    stubVendorFetch(() => envelope({ items: [organic(1, "rival-one.com")] }));
    const { ctx } = fakeCostContext();
    const result = await serp.serpOrganic(ctx, { query: "best crm", mode: "live", loadAsyncAiOverview: true, scope: SCOPE, freshnessDays: WINDOW() });

    expect(result.kind).toBe("measured");
    if (result.kind !== "measured") throw new Error("unreachable");
    expect(result.value.aiOverview).toEqual({ present: false, asynchronousAiOverview: false, referenceDomains: [] });
  });

  it("an empty SERP — no organic rows and no AI answer — is the `zero` arm, never `unmeasured`", async () => {
    stubVendorFetch(() => envelope({ items: [] }));
    const { ctx } = fakeCostContext();
    const result = await serp.serpOrganic(ctx, { query: "a search nobody serves", mode: "live", loadAsyncAiOverview: false, scope: SCOPE, freshnessDays: WINDOW() });

    expect(result.kind).toBe("zero");
    if (result.kind !== "zero") throw new Error("unreachable");
    expect(result.value).toEqual(serp.EMPTY_SERP);
  });
});

describe("DECISIONS 2026-09-03 (ADR-094) — `load_async_ai_overview` is the BUILD §6.4 never-list's one admitted exception", () => {
  it.each([true, false])("serpOrganic sends the caller's own decision (%s) explicitly, never omitting the field", async (flag) => {
    const stub = stubVendorFetch(() => envelope({ items: [] }));
    const { ctx } = fakeCostContext();
    await serp.serpOrganic(ctx, { query: "best crm", mode: "live", loadAsyncAiOverview: flag, scope: SCOPE, freshnessDays: WINDOW() });

    expect(stub.tasks[0]).toHaveProperty("load_async_ai_overview", flag);
  });

  it("no other endpoint's request body carries the field, under either mode", async () => {
    const stub = stubVendorFetch((request) => (request.url.includes("task_post") ? taskCreated() : envelope({ items: [] })));
    const { ctx } = fakeCostContext();
    await ai.aiMode(ctx, { query: "best crm", mode: "live", scope: SCOPE });

    expect(stub.tasks).not.toHaveLength(0);
    for (const task of stub.tasks) {
      expect(task).not.toHaveProperty("load_async_ai_overview");
    }
  });

  it("a flagged call is never served an unflagged SERP from cache — the flag is in the cache key", async () => {
    stubVendorFetch(() => envelope({ items: [] }));
    const { ctx, calls } = fakeCostContext();
    await serp.serpOrganic(ctx, { query: "best crm", mode: "live", loadAsyncAiOverview: true, scope: SCOPE, freshnessDays: WINDOW() });
    await serp.serpOrganic(ctx, { query: "best crm", mode: "live", loadAsyncAiOverview: false, scope: SCOPE, freshnessDays: WINDOW() });

    expect(calls[0]?.cacheKey).not.toBe(calls[1]?.cacheKey);
  });

  it("mode is not in the cache key — live and standard return the same SERP", async () => {
    stubVendorFetch((request) => (request.url.includes("task_post") ? taskCreated() : envelope({ items: [] })));
    const { ctx, calls } = fakeCostContext();
    vi.useFakeTimers();
    const pending = serp.serpOrganic(ctx, { query: "best crm", mode: "std", loadAsyncAiOverview: false, scope: SCOPE, freshnessDays: WINDOW() });
    await vi.advanceTimersByTimeAsync(constants.VENDOR.stdQueuePollIntervalS * 1000 * 2);
    await pending;
    vi.useRealTimers();
    await serp.serpOrganic(ctx, { query: "best crm", mode: "live", loadAsyncAiOverview: false, scope: SCOPE, freshnessDays: WINDOW() });

    expect(calls[0]?.cacheKey).toBe(calls[1]?.cacheKey);
  });
});

describe("ADR-094 decision 3a — a flagged call reserves the surcharge and settles the vendor's documented charge", () => {
  const base = () => constants.PRICE_BOOK.SERP_LIVE_C;
  const surcharged = () => base() * constants.ASYNC_AIO_SURCHARGE_MULTIPLIER;

  it("reserves the surcharge-inclusive price before the call", async () => {
    stubVendorFetch(() => envelope({ items: [] }));
    const { ctx, calls } = fakeCostContext();
    await serp.serpOrganic(ctx, { query: "best crm", mode: "live", loadAsyncAiOverview: true, scope: SCOPE, freshnessDays: WINDOW() });

    expect(calls[0]?.costCents).toBe(surcharged());
    expect(calls[0]?.settleCents).toBeTypeOf("function");
  });

  it("settles the surcharge when the response carries an asynchronous AI Overview", async () => {
    stubVendorFetch(() => envelope({ items: [organic(1, "a.com"), aiOverviewItem({ async: true, domains: ["a.com"] })] }));
    const { ctx, ledgered } = fakeCostContext();
    await serp.serpOrganic(ctx, { query: "best crm", mode: "live", loadAsyncAiOverview: true, scope: SCOPE, freshnessDays: WINDOW() });

    expect(ledgered).toEqual([surcharged()]);
  });

  it.each([
    ["the ai_overview element is absent", [organic(1, "a.com")]],
    ["the ai_overview element carries asynchronous_ai_overview: false", [organic(1, "a.com"), aiOverviewItem({ async: false, domains: ["a.com"] })]],
  ])("settles the base price when %s — the vendor refunds the extra charge", async (_name, items) => {
    stubVendorFetch(() => envelope({ items }));
    const { ctx, ledgered } = fakeCostContext();
    await serp.serpOrganic(ctx, { query: "best crm", mode: "live", loadAsyncAiOverview: true, scope: SCOPE, freshnessDays: WINDOW() });

    expect(ledgered).toEqual([base()]);
  });

  it("an unflagged call reserves the base price and supplies no settlement closure", async () => {
    stubVendorFetch(() => envelope({ items: [organic(1, "a.com"), aiOverviewItem({ async: true, domains: ["a.com"] })] }));
    const { ctx, calls, ledgered } = fakeCostContext();
    await serp.serpOrganic(ctx, { query: "best crm", mode: "live", loadAsyncAiOverview: false, scope: SCOPE, freshnessDays: WINDOW() });

    expect(calls[0]?.costCents).toBe(base());
    expect(calls[0]?.settleCents).toBeUndefined();
    expect(ledgered).toEqual([base()]);
  });

  it("the standard queue's base price is the pinned standard rate, not the live one", async () => {
    stubVendorFetch((request) => (request.url.includes("task_post") ? taskCreated() : envelope({ items: [] })));
    const { ctx, calls } = fakeCostContext();
    vi.useFakeTimers();
    const pending = serp.serpOrganic(ctx, { query: "best crm", mode: "std", loadAsyncAiOverview: false, scope: SCOPE, freshnessDays: WINDOW() });
    await vi.advanceTimersByTimeAsync(constants.VENDOR.stdQueuePollIntervalS * 1000 * 2);
    await pending;

    expect(calls[0]?.costCents).toBe(constants.PRICE_BOOK.SERP_STD_C);
  });
});

describe('BUILD §6.4 — "Everything scheduled = standard queue": task_post, then poll task_get', () => {
  it("posts the task, polls until the queue completes it, and returns the completed result", async () => {
    const stub = stubVendorFetch((request, index) => {
      if (index === 0) return taskCreated("queued-task-7");
      if (index === 1) return taskInQueue("queued-task-7");
      return envelope({ items: [organic(1, "rival-one.com")] });
    });
    const { ctx } = fakeCostContext();
    vi.useFakeTimers();
    const pending = serp.serpOrganic(ctx, { query: "best crm", mode: "std", loadAsyncAiOverview: false, scope: SCOPE, freshnessDays: WINDOW() });
    await vi.advanceTimersByTimeAsync(constants.VENDOR.stdQueuePollIntervalS * 1000 * 3);
    const result = await pending;

    expect(stub.requests[0]?.url).toContain("/v3/serp/google/organic/task_post");
    expect(stub.requests[1]?.url).toContain("/v3/serp/google/organic/task_get/advanced/queued-task-7");
    expect(stub.requests[1]?.method).toBe("GET");
    expect(result.kind).toBe("measured");
  });

  it("gives up at the pinned deadline with `unmeasured / undeterminable`, never a hang and never a throw", async () => {
    stubVendorFetch((request, index) => (index === 0 ? taskCreated() : taskInQueue()));
    const { ctx } = fakeCostContext();
    vi.useFakeTimers();
    const pending = serp.serpOrganic(ctx, { query: "best crm", mode: "std", loadAsyncAiOverview: false, scope: SCOPE, freshnessDays: WINDOW() });
    await vi.advanceTimersByTimeAsync((constants.VENDOR.stdQueueDeadlineMin + 1) * 60 * 1000);
    const result = await pending;

    expect(result.kind).toBe("unmeasured");
    if (result.kind !== "unmeasured") throw new Error("unreachable");
    expect(result.reason).toBe("undeterminable");
  });

  it("a task_post the vendor did not accept is `unmeasured`, and no poll is issued", async () => {
    const stub = stubVendorFetch(() => envelope(undefined, 40501));
    const { ctx } = fakeCostContext();
    const result = await serp.serpOrganic(ctx, { query: "best crm", mode: "std", loadAsyncAiOverview: false, scope: SCOPE, freshnessDays: WINDOW() });

    expect(result.kind).toBe("unmeasured");
    expect(stub.requests).toHaveLength(1);
  });
});

describe('BUILD §6.2/§6.3 — "The free path makes zero AI Optimization API calls"', () => {
  it.each(["aiMode", "llmScraper"] as const)("%s under a FREE context refuses without reaching the vendor", async (name) => {
    const stub = stubVendorFetch(() => envelope({ items: [] }));
    const { ctx, calls } = fakeCostContext("FREE");
    const result = name === "aiMode" ? await ai.aiMode(ctx, { query: "x", mode: "live", scope: SCOPE }) : await ai.llmScraper(ctx, { query: "x", mode: "std", scope: SCOPE });

    expect(result.kind).toBe("unmeasured");
    if (result.kind !== "unmeasured") throw new Error("unreachable");
    expect(result.reason).toBe("not_attempted");
    // Not a throw (BUILD §6.5: caps degrade, never throw), and not a call:
    // neither the vendor nor the ledger is touched.
    expect(stub.requests).toHaveLength(0);
    expect(calls).toHaveLength(0);
  });

  it.each(["DEEP", "WEEKLY"] as const)("aiMode runs under a %s context", async (cap) => {
    const stub = stubVendorFetch(() => envelope({ items: [aiOverviewItem({ async: false, domains: ["rival-one.com"] })] }));
    const { ctx } = fakeCostContext(cap);
    const result = await ai.aiMode(ctx, { query: "best crm", mode: "live", scope: SCOPE });

    expect(stub.requests).toHaveLength(1);
    expect(result.kind).toBe("measured");
    if (result.kind !== "measured") throw new Error("unreachable");
    expect(result.value).toEqual({ answered: true, text: "The best options are …", citedDomains: ["rival-one.com"] });
  });
});

describe("BUILD §6.2 — the paid battery's two engines and their pinned prices", () => {
  it.each([
    ["live", "AI_MODE_LIVE_C"],
    ["std", "AI_MODE_STD_C"],
  ] as const)("aiMode in %s mode reserves PRICE_BOOK.%s", async (mode, pin) => {
    stubVendorFetch((request) => (request.url.includes("task_post") ? taskCreated() : envelope({ items: [] })));
    const { ctx, calls } = fakeCostContext();
    vi.useFakeTimers();
    const pending = ai.aiMode(ctx, { query: "best crm", mode, scope: SCOPE });
    await vi.advanceTimersByTimeAsync(constants.VENDOR.stdQueuePollIntervalS * 1000 * 2);
    await pending;

    expect(calls[0]?.costCents).toBe(constants.PRICE_BOOK[pin]);
  });

  it("llmScraper reserves PRICE_BOOK.CHATGPT_SCRAPE_STD_C and reads `sources`, not `search_results`", async () => {
    const stub = stubVendorFetch((request, index) =>
      index === 0
        ? taskCreated()
        : envelope({
            items: [
              {
                markdown: "ChatGPT's answer …",
                search_results: [{ domain: "retrieved-not-cited.com" }],
                sources: [{ domain: "cited-one.com" }, { url: "https://cited-two.com/page" }],
              },
            ],
          })
    );
    const { ctx, calls } = fakeCostContext();
    vi.useFakeTimers();
    const pending = ai.llmScraper(ctx, { query: "best crm", mode: "std", scope: SCOPE });
    await vi.advanceTimersByTimeAsync(constants.VENDOR.stdQueuePollIntervalS * 1000 * 2);
    const result = await pending;

    expect(calls[0]?.costCents).toBe(constants.PRICE_BOOK.CHATGPT_SCRAPE_STD_C);
    expect(stub.requests[0]?.url).toContain("/v3/ai_optimization/chat_gpt/llm_scraper/task_post");
    expect(result.kind).toBe("measured");
    if (result.kind !== "measured") throw new Error("unreachable");
    expect(result.value.citedDomains).toEqual(["cited-one.com", "cited-two.com"]);
    expect(result.value.citedDomains).not.toContain("retrieved-not-cited.com");
  });

  it("an engine that gave no answer is the `zero` arm carrying `answered: false`", async () => {
    stubVendorFetch(() => envelope({ items: [] }));
    const { ctx } = fakeCostContext();
    const result = await ai.aiMode(ctx, { query: "best crm", mode: "live", scope: SCOPE });

    expect(result.kind).toBe("zero");
    if (result.kind !== "zero") throw new Error("unreachable");
    expect(result.value).toEqual({ answered: false, text: "", citedDomains: [] });
  });

  it("llmScraper has no live surface: it is standard-queue only, at the vendor and in the type", async () => {
    const stub = stubVendorFetch((request, index) => (index === 0 ? taskCreated() : envelope({ items: [] })));
    const { ctx } = fakeCostContext();
    vi.useFakeTimers();
    const pending = ai.llmScraper(ctx, { query: "best crm", mode: "std", scope: SCOPE });
    await vi.advanceTimersByTimeAsync(constants.VENDOR.stdQueuePollIntervalS * 1000 * 2);
    await pending;

    for (const request of stub.requests) expect(request.url).not.toContain("/live");
  });
});

describe("BUILD §6.5 — a cap-skipped SERP or AI call is `not_attempted`", () => {
  it("serpOrganic under a spent cap never reaches the vendor", async () => {
    const stub = stubVendorFetch(() => envelope({ items: [] }));
    const { ctx } = cappedCostContext();
    const result = await serp.serpOrganic(ctx, { query: "best crm", mode: "live", loadAsyncAiOverview: true, scope: SCOPE, freshnessDays: WINDOW() });

    expect(result.kind).toBe("unmeasured");
    if (result.kind !== "unmeasured") throw new Error("unreachable");
    expect(result.reason).toBe("not_attempted");
    expect(stub.requests).toHaveLength(0);
  });
});

describe("BUILD §6.3a — every SERP and AI call is fixed to the pinned locale and depth 10", () => {
  it("the organic SERP task carries SERP_LOCATION and depth 10, and the AI surfaces carry the locale without a depth", async () => {
    const stub = stubVendorFetch((request) => (request.url.includes("task_post") ? taskCreated() : envelope({ items: [] })));
    const { ctx } = fakeCostContext();
    await serp.serpOrganic(ctx, { query: "best crm", mode: "live", loadAsyncAiOverview: false, scope: SCOPE, freshnessDays: WINDOW() });
    await ai.aiMode(ctx, { query: "best crm", mode: "live", scope: SCOPE });

    const [serpTask, aiTask] = stub.tasks;
    expect(serpTask).toMatchObject({
      location_name: constants.SERP_LOCATION.location,
      language_code: constants.SERP_LOCATION.language,
      depth: 10,
    });
    expect(aiTask).toMatchObject({
      location_name: constants.SERP_LOCATION.location,
      language_code: constants.SERP_LOCATION.language,
    });
    // The vendor rejects unknown fields on the AI surfaces, which have no
    // `depth` parameter — so the key is stripped there, not set to 10.
    expect(aiTask).not.toHaveProperty("depth");
  });
});
