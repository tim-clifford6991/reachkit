// tests/hosted/serving/blog-reads.test.ts — SPEC §6 (2026-09-20, #908)
// measure (d) · SPEC §7 of the same date, issue #921 · issue 1242.
//
// #921's done-when, through the door a visitor actually comes in by: "a
// request with a `ChatGPT-User` agent to a hosted page raises that page's
// count by one and stores nothing that identifies a person."
//
// The count is made in `src/middleware.ts` since issue 1242, because the
// article is cached and a cached page is rendered once. So the middleware
// is what is called here, once per request, and what is asserted is that
// every request to a live page is counted — the first and the ones after
// it — and that the write is handed to `waitUntil` rather than awaited in
// front of the response.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import "../../scan/run/harness";

vi.mock("@/lib/scan/removal", () => ({ isDomainRemoved: async () => false }));

const state: { live: boolean; retired: boolean } = { live: true, retired: false };

vi.mock("@/lib/account/billing", () => ({
  hostedServingState: async () => ({ serve: true }),
}));

vi.mock("@/lib/publish/destinations/hosted", () => ({
  tags: { site: (s: string) => `hosted:site:${s}`, page: (p: string) => `hosted:page:${p}` },
  retiredSlugsForSite: async () => new Set<string>(),
  hostedSiteForDomain: async (domain: string) =>
    domain === "example.com" ? { siteId: "site-1", domain, host: `content.${domain}` } : null,
  hostedSiteForHostname: async () => null,
  hostedAddress: async () => {
    if (state.live) return { state: "live", publicationId: "pub-1" };
    return { state: state.retired ? "retired" : "none", publicationId: null };
  },
}));

/** The one call this feature makes on the store, captured with every
 *  argument it was handed. */
const recorded: Record<string, unknown>[] = [];
vi.mock("@/lib/publish/reads/store", () => ({
  recordBlogRead: async (a: Record<string, unknown>) => {
    recorded.push(a);
  },
}));

const { middleware } = await import("@/middleware");

/** One request to the live page, as Next hands it to the middleware: the
 *  request and the event whose `waitUntil` keeps the write alive. Returns
 *  where it was rewritten to and what was left to settle. */
async function visit(
  headers: Record<string, string> = {},
  path = "/a-page"
): Promise<{ rewrittenTo: string | null; waiting: Promise<unknown>[] }> {
  const waiting: Promise<unknown>[] = [];
  const response = await middleware(
    new NextRequest(new URL(path, "http://localhost"), {
      headers: { host: "content.example.com", ...headers },
    }),
    { waitUntil: (work: Promise<unknown>) => void waiting.push(work) }
  );
  const destination = response.headers.get("x-middleware-rewrite");
  return {
    rewrittenTo: destination === null ? null : new URL(destination).pathname,
    waiting,
  };
}

/** A visit, with its write settled. */
async function counted(headers: Record<string, string> = {}, path = "/a-page"): Promise<void> {
  await Promise.all((await visit(headers, path)).waiting);
}

beforeEach(() => {
  state.live = true;
  state.retired = false;
  recorded.length = 0;
});

describe("the done-when — a ChatGPT-User request raises that page's count by one", () => {
  it("counts one answer fetch against this page and this site", async () => {
    await counted({ "user-agent": "Mozilla/5.0 (compatible; ChatGPT-User/1.0; +https://openai.com/bot)" });
    expect(recorded).toHaveLength(1);
    expect(recorded[0]).toMatchObject({
      siteId: "site-1",
      publicationId: "pub-1",
      read: { engine: "chatgpt", kind: "answer_fetch" },
    });
  });

  it("a fetch of the cached page is counted too — every request, not every render", async () => {
    // Issue 1242. All three are sent to the same cached address, which is
    // rendered once; each is counted before the cache answers it.
    for (let request = 0; request < 3; request += 1) {
      const { rewrittenTo, waiting } = await visit({ "user-agent": "ChatGPT-User/1.0" });
      expect(rewrittenTo).toBe("/hosted-live/content.example.com/a-page");
      await Promise.all(waiting);
    }
    expect(recorded).toHaveLength(3);
  });
});

describe("§7 — nothing that identifies a person is stored", () => {
  it("the recorded value carries a site, a page, an instant and two enumerations, and nothing else", async () => {
    await counted({
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
  it("the write is handed to waitUntil, and nothing is written before the response", async () => {
    const { waiting } = await visit({ "user-agent": "ChatGPT-User/1.0" });
    // The response is back and the write is still only waited on.
    expect(recorded).toHaveLength(0);
    expect(waiting).toHaveLength(1);
    await Promise.all(waiting);
    expect(recorded).toHaveLength(1);
  });

  it("ordinary traffic schedules nothing at all", async () => {
    const { waiting } = await visit({
      "user-agent": "Mozilla/5.0 (Macintosh) Chrome/140 Safari/537.36",
    });
    expect(waiting).toHaveLength(0);
    expect(recorded).toHaveLength(0);
  });
});

describe("what else is counted, and what is not", () => {
  it("a search indexer is counted as an index fetch", async () => {
    await counted({ "user-agent": "Mozilla/5.0 (compatible; PerplexityBot/1.0)" });
    expect(recorded[0]).toMatchObject({ read: { engine: "perplexity", kind: "index_fetch" } });
  });

  it("a training crawler is not counted", async () => {
    await counted({ "user-agent": "Mozilla/5.0 (compatible; GPTBot/1.2; +https://openai.com/gptbot)" });
    expect(recorded).toHaveLength(0);
  });

  it("a visitor from an AI answer is counted as a referral", async () => {
    await counted({
      "user-agent": "Mozilla/5.0 (Macintosh) Chrome/140 Safari/537.36",
      referer: "https://www.perplexity.ai/search/something",
    });
    expect(recorded[0]).toMatchObject({ read: { engine: "perplexity", kind: "referral" } });
  });

  it("a tagged link counts even with no referrer", async () => {
    await counted(
      { "user-agent": "Mozilla/5.0 (Macintosh) Chrome/140 Safari/537.36" },
      "/a-page?utm_source=chatgpt"
    );
    expect(recorded[0]).toMatchObject({ read: { engine: "chatgpt", kind: "referral" } });
  });

  it("an address that serves no page counts nothing", async () => {
    state.live = false;
    await counted({ "user-agent": "ChatGPT-User/1.0" });
    expect(recorded).toHaveLength(0);
  });

  it("a page that was taken down counts nothing", async () => {
    state.live = false;
    state.retired = true;
    const { rewrittenTo, waiting } = await visit({ "user-agent": "ChatGPT-User/1.0" });
    expect(rewrittenTo).toBe("/hosted-gone");
    expect(waiting).toHaveLength(0);
  });
});
