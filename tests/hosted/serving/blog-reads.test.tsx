/** @vitest-environment jsdom */
// tests/hosted/serving/blog-reads.test.tsx — SPEC §6 (2026-09-20, #908)
// measure (d) · SPEC §7 of the same date, issue #921.
//
// The issue's done-when, through the route a visitor actually reaches: "a
// request with a `ChatGPT-User` agent to a hosted page raises that page's
// count by one and stores nothing that identifies a person."
//
// The page is called directly and rendered to static markup, the same
// convention the suites beside it use. `after()` is stood up as the queue
// it is — the callbacks are collected and settled after the render — so
// what is asserted is both *that* the count happens and that it happens
// **after** the response rather than in front of it.
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

const state: { host: string; headers: Record<string, string>; page: unknown } = {
  host: "content.example.com",
  headers: {},
  page: null,
};

/** Everything `after()` was handed, in order, un-run — so a test can assert
 *  that nothing was counted before the page was rendered. */
const queued: (() => unknown)[] = [];

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ host: state.host, ...state.headers }),
}));

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return {
    ...actual,
    after: (task: () => unknown) => {
      queued.push(task);
    },
  };
});

vi.mock("@/lib/account/billing", () => ({
  hostedServingState: async () => ({ serve: true }),
}));

vi.mock("@/lib/publish/destinations/hosted", async () => {
  const address = await import("@/lib/publish/destinations/hosted/address");
  return {
    liveUrlFor: address.liveUrlFor,
    liveUrlOnHost: address.liveUrlOnHost,
    hostedHostFor: address.hostedHostFor,
    tags: { site: (s: string) => `hosted:site:${s}`, page: (p: string) => `hosted:page:${p}` },
    hostedSiteForDomain: async (domain: string) =>
      domain === "example.com" ? { siteId: "site-1", domain, host: `content.${domain}` } : null,
    hostedSiteForHostname: async () => null,
    livePageBySlug: async () => state.page,
    livePagesForSite: async () => (state.page === null ? [] : [state.page]),
    wasEverLive: async () => false,
  };
});

/** The one call this feature makes on the store, captured with every
 *  argument it was handed. */
const recorded: Record<string, unknown>[] = [];
vi.mock("@/lib/publish/reads/store", () => ({
  recordBlogRead: async (a: Record<string, unknown>) => {
    recorded.push(a);
  },
  utcDay: (at: Date) => at.toISOString().slice(0, 10),
}));

const PageModule = await import("@/app/(hosted)/hosted-page/[[...slug]]/page");
const Page = PageModule.default;

function livePage(over: Record<string, unknown> = {}): unknown {
  return {
    publicationId: "pub-1",
    siteId: "site-1",
    slug: "a-page",
    title: "The best onboarding tools",
    bodyMd: "Teams pick a tool on one question.",
    description: "What teams look for in an onboarding tool.",
    faq: [],
    grounded: null,
    publisher: { name: "example.com", category: null, timeZone: "America/New_York" },
    publishedAt: new Date("2026-09-04T11:00:00.000Z"),
    firstPublishedAt: new Date("2026-09-04T11:00:00.000Z"),
    byline: null,
    liveUrl: "https://content.example.com/a-page",
    record: {
      opportunityId: "opp-1",
      targetQuery: "best onboarding tools",
      measuredOn: new Date("2026-08-28T00:00:00.000Z"),
      mode: "autopilot",
      liveUrl: "https://content.example.com/a-page",
    },
    ...over,
  };
}

/** Renders the page, then settles whatever `after()` was handed. */
async function visit(
  headers: Record<string, string> = {},
  query?: Record<string, string | string[] | undefined>
): Promise<string> {
  state.headers = headers;
  const tree = await Page({
    params: Promise.resolve({ slug: ["a-page"] }),
    ...(query === undefined ? {} : { searchParams: Promise.resolve(query) }),
  });
  const html = renderToStaticMarkup(tree);
  for (const task of queued.splice(0)) await task();
  return html;
}

beforeEach(() => {
  state.host = "content.example.com";
  state.headers = {};
  state.page = livePage();
  queued.length = 0;
  recorded.length = 0;
});

describe("the done-when — a ChatGPT-User request raises that page's count by one", () => {
  it("counts one answer fetch against this page and this site", async () => {
    await visit({ "user-agent": "Mozilla/5.0 (compatible; ChatGPT-User/1.0; +https://openai.com/bot)" });
    expect(recorded).toHaveLength(1);
    expect(recorded[0]).toMatchObject({
      siteId: "site-1",
      publicationId: "pub-1",
      read: { engine: "chatgpt", kind: "answer_fetch" },
    });
  });

  it("the page is still the page — the count changes nothing a reader sees", async () => {
    const withAgent = await visit({ "user-agent": "ChatGPT-User/1.0" });
    const withoutAgent = await visit({});
    expect(withAgent).toBe(withoutAgent);
  });
});

describe("§7 — nothing that identifies a person is stored", () => {
  it("the recorded value carries a site, a page, an instant and two enumerations, and nothing else", async () => {
    await visit({
      "user-agent": "ChatGPT-User/1.0 (+https://openai.com/bot)",
      referer: "https://chatgpt.com/c/9f1c-secret-thread",
      "x-forwarded-for": "203.0.113.9",
      cookie: "session=abc123",
    });
    const call = recorded[0];
    expect(call).toBeDefined();
    expect(Object.keys(call ?? {}).sort()).toEqual(["at", "publicationId", "read", "siteId"]);
    const serialised = JSON.stringify(call);
    expect(serialised).not.toContain("203.0.113.9");
    expect(serialised).not.toContain("abc123");
    expect(serialised).not.toContain("9f1c-secret-thread");
    expect(serialised).not.toContain("Mozilla");
  });
});

describe("it happens after the response, never in front of it", () => {
  it("nothing is written while the page is being rendered", async () => {
    state.headers = { "user-agent": "ChatGPT-User/1.0" };
    const tree = await Page({ params: Promise.resolve({ slug: ["a-page"] }) });
    renderToStaticMarkup(tree);
    // The render is done and the callback is still only queued.
    expect(recorded).toHaveLength(0);
    expect(queued).toHaveLength(1);
    for (const task of queued.splice(0)) await task();
    expect(recorded).toHaveLength(1);
  });

  it("ordinary traffic queues nothing at all", async () => {
    state.headers = { "user-agent": "Mozilla/5.0 (Macintosh) Chrome/140 Safari/537.36" };
    const tree = await Page({ params: Promise.resolve({ slug: ["a-page"] }) });
    renderToStaticMarkup(tree);
    expect(queued).toHaveLength(0);
    expect(recorded).toHaveLength(0);
  });
});

describe("what else is counted, and what is not", () => {
  it("a search indexer is counted as an index fetch", async () => {
    await visit({ "user-agent": "Mozilla/5.0 (compatible; PerplexityBot/1.0)" });
    expect(recorded[0]).toMatchObject({ read: { engine: "perplexity", kind: "index_fetch" } });
  });

  it("a training crawler is not counted", async () => {
    await visit({ "user-agent": "Mozilla/5.0 (compatible; GPTBot/1.2; +https://openai.com/gptbot)" });
    expect(recorded).toHaveLength(0);
  });

  it("a visitor from an AI answer is counted as a referral", async () => {
    await visit({
      "user-agent": "Mozilla/5.0 (Macintosh) Chrome/140 Safari/537.36",
      referer: "https://www.perplexity.ai/search/something",
    });
    expect(recorded[0]).toMatchObject({ read: { engine: "perplexity", kind: "referral" } });
  });

  it("a tagged link counts even with no referrer", async () => {
    await visit(
      { "user-agent": "Mozilla/5.0 (Macintosh) Chrome/140 Safari/537.36" },
      { utm_source: "chatgpt" }
    );
    expect(recorded[0]).toMatchObject({ read: { engine: "chatgpt", kind: "referral" } });
  });

  it("an address that serves no page counts nothing", async () => {
    state.page = null;
    await expect(
      visit({ "user-agent": "ChatGPT-User/1.0" })
    ).rejects.toThrow();
    expect(recorded).toHaveLength(0);
  });
});

describe("the counter depends on the route staying dynamic", () => {
  it("the route declares force-dynamic, so after() runs once per request", () => {
    // `after()` fires once per *render*. On a cached page that is once, at
    // build or revalidation — every engine fetch after it would go
    // uncounted. The issue asks this be confirmed rather than assumed.
    expect(PageModule.dynamic).toBe("force-dynamic");
    expect(PageModule.revalidate).toBe(0);
  });
});
