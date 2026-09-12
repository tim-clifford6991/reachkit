// tests/hosted/container/edge.test.ts — BUILD §9, issue #49
//
// The hosted edge's rewrite: which destination an address on a `content.`
// host reaches, and — the property the rewrite exists for — that no path on
// a customer's own domain can reach a ReachKit screen.
import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import "../../scan/run/harness";

vi.mock("@/lib/scan/removal", () => ({ isDomainRemoved: async () => false }));

const sites = new Map<string, string>();
const live = new Map<string, string[]>();
const everLive = new Map<string, string[]>();
const serving = new Map<string, { serve: boolean; because?: string }>();

vi.mock("@/lib/publish/destinations/hosted", async () => {
  const address = await import("@/lib/publish/destinations/hosted/address");
  return {
    hostedHostFor: address.hostedHostFor,
    liveUrlFor: address.liveUrlFor,
    liveUrlOnHost: address.liveUrlOnHost,
    tags: { site: (s: string) => `hosted:site:${s}`, page: (p: string) => `hosted:page:${p}` },
    hostedSiteForDomain: async (domain: string) => {
      const id = sites.get(domain);
      return id === undefined ? null : { siteId: id, domain, host: `content.${domain}` };
    },
    // SPEC §5 (2026-09-12): a Host is matched whole against the host on
    // the destination row first. These suites describe a site whose row
    // predates the label being a choice, so that lookup finds nothing and
    // the default-label lookup beside it is what serves them.
    hostedSiteForHostname: async () => null,
    livePagesForSite: async () => [],
    livePageBySlug: async (siteId: string, slug: string) =>
      (live.get(siteId) ?? []).includes(slug) ? { slug } : null,
    wasEverLive: async (siteId: string, slug: string) =>
      (everLive.get(siteId) ?? []).includes(slug),
  };
});

vi.mock("@/lib/account/billing", () => ({
  hostedServingState: async (siteId: string) => serving.get(siteId) ?? { serve: true },
}));

const { middleware } = await import("@/middleware");
const { hostedAnswer, pageSlug } = await import("@/app/(hosted)/edge");

function requestTo(pathname: string, host: string): NextRequest {
  return new NextRequest(new URL(pathname, "http://localhost"), { headers: { host } });
}

function rewrittenTo(response: Response): string | null {
  const destination = response.headers.get("x-middleware-rewrite");
  return destination === null ? null : new URL(destination).pathname;
}

beforeEach(() => {
  sites.clear();
  live.clear();
  everLive.clear();
  serving.clear();
  sites.set("example.com", "site-1");
  live.set("site-1", ["a-page"]);
  everLive.set("site-1", ["taken-down"]);
});

describe("every path on a customer's own domain lands in the hosted group", () => {
  it("a live page is rewritten to the hosted catch-all, not redirected", async () => {
    const response = await middleware(requestTo("/a-page", "content.example.com"));
    expect(response.status).toBeLessThan(300);
    expect(rewrittenTo(response)).toBe("/hosted-page/a-page");
    expect(response.headers.get("Location")).toBeNull();
  });

  it("a path under (account) cannot be reached on a customer's domain", async () => {
    // The property the rewrite exists for. Next routes by path alone, so
    // without it `/setup` on a customer's own domain would render the
    // account container's setup screen.
    const response = await middleware(requestTo("/setup", "content.example.com"));
    expect(rewrittenTo(response)).toBe("/hosted-page/setup");
  });

  it("a public ReachKit screen cannot be reached there either", async () => {
    for (const path of ["/pricing", "/signin", "/scan/example.com"]) {
      const response = await middleware(requestTo(path, "content.example.com"));
      expect(rewrittenTo(response), path).toBe(`/hosted-page${path}`);
    }
    // The site root is one of them: `/hosted-page` matches no route (the
    // catch-all needs a segment), so a customer's own domain answers 404
    // at its root rather than the ReachKit landing page.
    expect(rewrittenTo(await middleware(requestTo("/", "content.example.com")))).toBe(
      "/hosted-page"
    );
  });

  it("the two documents resolve the Host themselves and are not rewritten", async () => {
    for (const path of ["/robots.txt", "/sitemap.xml"]) {
      const response = await middleware(requestTo(path, "content.example.com"));
      expect(rewrittenTo(response), path).toBeNull();
      expect(response.status, path).toBeLessThan(300);
    }
  });

  it("a ReachKit host is untouched by any of this", async () => {
    // **The deployment's own address, from the binding this harness sets**
    // — not an arbitrary name. Since SPEC §5's ruling of 2026-09-12 the
    // label is the customer's, so the rewrite is decided by subtraction
    // rather than by a `content.` prefix: a Host that is not one of ours
    // arrived because somebody pointed a record at us. That makes "one of
    // ours" a fact to read rather than a stand-in to pick, and this row is
    // what holds the app's own screens out of the hosted group.
    const response = await middleware(requestTo("/pricing", "app.example.com"));
    expect(rewrittenTo(response)).toBeNull();
  });

  it("a customer's own host reaches the hosted group whatever label they chose", async () => {
    // SPEC §5 (2026-09-12). The row a prefix test fails: the same customer,
    // the same record, served under `content.` and 404 under `blog.`.
    for (const host of ["blog.example.com", "news.example.com", "learn.acme.test"]) {
      const response = await middleware(requestTo("/a-page", host));
      expect(rewrittenTo(response), host).toBe("/hosted-page/a-page");
    }
  });
});

describe("410 rather than 404, and only where a page was actually taken down", () => {
  it("an address that served a page and no longer does is rewritten to the 410", async () => {
    const response = await middleware(requestTo("/taken-down", "content.example.com"));
    expect(rewrittenTo(response)).toBe("/hosted-gone");
  });

  it("an address that never served one is not gone — it goes to the page, which 404s", async () => {
    const response = await middleware(requestTo("/never-published", "content.example.com"));
    expect(rewrittenTo(response)).toBe("/hosted-page/never-published");
  });

  it("a re-published page is not gone: the live check comes first", async () => {
    live.set("site-1", ["taken-down"]);
    const response = await middleware(requestTo("/taken-down", "content.example.com"));
    expect(rewrittenTo(response)).toBe("/hosted-page/taken-down");
  });

  it("a site whose access ended is gone at every address on it", async () => {
    serving.set("site-1", { serve: false, because: "retention_elapsed" });
    for (const path of ["/a-page", "/anything"]) {
      expect(rewrittenTo(await middleware(requestTo(path, "content.example.com")))).toBe(
        "/hosted-gone"
      );
    }
  });

  it("a deleted account is gone the same way", async () => {
    serving.set("site-1", { serve: false, because: "account_deleted" });
    expect(rewrittenTo(await middleware(requestTo("/a-page", "content.example.com")))).toBe(
      "/hosted-gone"
    );
  });
});

describe("the runtime this file is built for", () => {
  it("middleware runs on Node.js, because the hosted edge asks a question the Edge runtime cannot carry", async () => {
    // `hostedServingState` is reached through `@/lib/account/billing` —
    // the only way past that module's import fence — and the barrel's
    // graph carries the mail vendor's `node:https`/`node:crypto`. On Edge
    // the build reports both as unsupported. Next 16's successor
    // convention (`proxy.ts`) already defaults to Node and refuses this
    // option; setting it keeps this file where that convention is.
    const { config } = await import("@/middleware");
    expect((config as { runtime?: string }).runtime).toBe("nodejs");
  });
});

describe("the decision itself", () => {
  it("only a single segment names a page", () => {
    expect(pageSlug("/a-page")).toBe("a-page");
    expect(pageSlug("/a/b")).toBeNull();
    expect(pageSlug("/")).toBeNull();
  });

  it("it fails towards rendering, never towards a 410", async () => {
    const hosted = await import("@/lib/publish/destinations/hosted");
    const spy = vi.spyOn(hosted, "livePageBySlug").mockRejectedValue(new Error("unreachable"));
    try {
      await expect(hostedAnswer("content.example.com", "/taken-down")).resolves.toBe("page");
    } finally {
      spy.mockRestore();
    }
  });

  it("an unknown host is answered by the page route, which 404s — never by the 410", async () => {
    await expect(hostedAnswer("content.stranger.example", "/a-page")).resolves.toBe("page");
  });
});
