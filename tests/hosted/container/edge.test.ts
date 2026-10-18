// tests/hosted/container/edge.test.ts — BUILD §9, issue #49
//
// The hosted edge's rewrite: which destination an address on a `content.`
// host reaches, and — the property the rewrite exists for — that no path on
// a customer's own domain can reach a ReachKit screen.
import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import "../../scan/run/harness";

vi.mock("@/lib/scan/removal", () => ({ isDomainRemoved: async () => false }));

const sites = new Map<string, string>();
const live = new Map<string, string[]>();
const everLive = new Map<string, string[]>();
/** Issue 1487: a slug that moved, by site, to the slug it lives at now. */
const moved = new Map<string, Map<string, string>>();
const serving = new Map<string, { serve: boolean; because?: string }>();
/** How long the address read takes — nothing, unless a test says otherwise. */
const addressRead = { wait: async (): Promise<void> => {} };

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
    // SPEC §5 (2026-09-12): a Host is matched whole against the row's host
    // first. These suites describe a row that predates the choice, so that
    // lookup finds nothing and the default-label one beside it serves them.
    hostedSiteForHostname: async () => null,
    livePagesForSite: async () => [],
    hostedIdentity: async (a: { domain: string }) => ({ name: a.domain, logoType: null, line: null }),
    livePageBySlug: async (siteId: string, slug: string) =>
      (live.get(siteId) ?? []).includes(slug) ? { slug } : null,
    // Live first, as the store answers it: a re-published slug is live.
    hostedAddress: async (siteId: string, slug: string) => {
      await addressRead.wait();
      if ((live.get(siteId) ?? []).includes(slug)) {
        return { state: "live", publicationId: `pub-${slug}` };
      }
      const to = moved.get(siteId)?.get(slug);
      if (to !== undefined) return { state: "moved", publicationId: `pub-${to}`, slug: to };
      const state = (everLive.get(siteId) ?? []).includes(slug) ? "retired" : "none";
      return { state, publicationId: null };
    },
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
  moved.clear();
  serving.clear();
  addressRead.wait = async () => {};
  sites.set("example.com", "site-1");
  live.set("site-1", ["a-page"]);
  everLive.set("site-1", ["taken-down"]);
});

describe("issue 1487 — a retargeted page's old address", () => {
  it("answers 301 to the page's new address, on the host it was asked on", async () => {
    moved.set("site-1", new Map([["old-topic", "a-page"]]));
    const response = await middleware(requestTo("/old-topic", "content.example.com"));
    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe("https://content.example.com/a-page");
  });
});

describe("every path on a customer's own domain lands in the hosted group", () => {
  it("a live page is rewritten to the cached article, not redirected", async () => {
    const response = await middleware(requestTo("/a-page", "content.example.com"));
    expect(response.status).toBeLessThan(300);
    expect(rewrittenTo(response)).toBe("/hosted-live/content.example.com/a-page");
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
    // The deployment's own address, from the binding this harness sets.
    // Since §5's ruling the label is the customer's, so the rewrite is
    // decided by subtracting our own hosts rather than by a `content.`
    // prefix — and this row holds the app's own screens out of the group.
    const response = await middleware(requestTo("/pricing", "app.example.com"));
    expect(rewrittenTo(response)).toBeNull();
  });

  it("a loopback host with a port stays local — a bracketed IPv6 one included (issue 608)", async () => {
    // `[::1]:3000` is what a local build answers on over IPv6. Its port once
    // survived normalisation, the name matched none of ours, and every
    // screen of the app was rewritten into the hosted group.
    for (const host of ["[::1]:3000", "[::1]", "localhost:3000", "127.0.0.1:3000"]) {
      const response = await middleware(requestTo("/pricing", host));
      expect(rewrittenTo(response), host).toBeNull();
    }
  });

  it("a customer's own host reaches the hosted group whatever label they chose", async () => {
    // SPEC §5 (2026-09-12). The row a prefix test fails: the same customer,
    // the same record, served under `content.` and 404 under `blog.`.
    for (const host of ["blog.example.com", "news.example.com", "learn.acme.test"]) {
      const response = await middleware(requestTo("/a-page", host));
      // No row carries these hosts in this suite, so none of them is a site
      // and none is sent to the cached article.
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
    expect(rewrittenTo(response)).toBe("/hosted-live/content.example.com/taken-down");
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

describe("a cold function's slow read (issue 1194)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("a taken-down address still answers 410 when the read takes over a second", async () => {
    // The first request to a cold function: the read was correct and late,
    // and the address answered 404 — "never existed" — to a crawler.
    vi.useFakeTimers();
    addressRead.wait = () => new Promise((resolve) => setTimeout(resolve, 1500));
    const response = middleware(requestTo("/taken-down", "content.example.com"));
    await vi.advanceTimersByTimeAsync(1500);
    expect(rewrittenTo(await response)).toBe("/hosted-gone");
  });

  it("a read that never answers renders — it is never a 410 on a guess", async () => {
    vi.useFakeTimers();
    addressRead.wait = () => new Promise(() => {});
    const response = middleware(requestTo("/taken-down", "content.example.com"));
    await vi.advanceTimersByTimeAsync(10_000);
    expect(rewrittenTo(await response)).toBe("/hosted-page/taken-down");
  });
});

describe("the cached article is reached only by a page found live on this request (issue 1242)", () => {
  const CACHED = "/hosted-live/content.example.com/a-page";

  it("a live page is sent to the address its host and slug name", async () => {
    // Whatever spelling the client sent, the path carries the host the site
    // is served at, so one page has one cached copy.
    for (const host of ["content.example.com", "CONTENT.Example.com:443", "content.example.com."]) {
      expect(rewrittenTo(await middleware(requestTo("/a-page", host))), host).toBe(CACHED);
    }
  });

  it("a page taken down is not: the very next request is the 410", async () => {
    expect(rewrittenTo(await middleware(requestTo("/a-page", "content.example.com")))).toBe(CACHED);
    live.set("site-1", []);
    everLive.set("site-1", ["a-page"]);
    expect(rewrittenTo(await middleware(requestTo("/a-page", "content.example.com")))).toBe(
      "/hosted-gone"
    );
  });

  it("a site whose access ended is not: the very next request is the 410", async () => {
    expect(rewrittenTo(await middleware(requestTo("/a-page", "content.example.com")))).toBe(CACHED);
    serving.set("site-1", { serve: false, because: "retention_elapsed" });
    expect(rewrittenTo(await middleware(requestTo("/a-page", "content.example.com")))).toBe(
      "/hosted-gone"
    );
  });

  it("a host that moved is not: the old host goes to the uncached route, which resolves it and 404s", async () => {
    expect(rewrittenTo(await middleware(requestTo("/a-page", "content.example.com")))).toBe(CACHED);
    // The site is served at another host now; no row claims the old one.
    sites.delete("example.com");
    expect(rewrittenTo(await middleware(requestTo("/a-page", "content.example.com")))).toBe(
      "/hosted-page/a-page"
    );
  });

  it("a read that never answers is not: the uncached route decides for itself", async () => {
    vi.useFakeTimers();
    try {
      addressRead.wait = () => new Promise(() => {});
      const response = middleware(requestTo("/a-page", "content.example.com"));
      await vi.advanceTimersByTimeAsync(10_000);
      expect(rewrittenTo(await response)).toBe("/hosted-page/a-page");
    } finally {
      vi.useRealTimers();
    }
  });

  it("the cached address cannot be asked for by path on a ReachKit host, signed in or not", async () => {
    const response = await middleware(requestTo(CACHED, "localhost"));
    expect(response.status).toBe(404);
    expect(rewrittenTo(response)).toBeNull();
  });

  it("nor on a customer's host, where it is one more path under the uncached route", async () => {
    expect(rewrittenTo(await middleware(requestTo(CACHED, "content.example.com")))).toBe(
      `/hosted-page${CACHED}`
    );
  });

  it("it is answered under a policy that runs no script, and the render is handed no nonce", async () => {
    const cached = await middleware(requestTo("/a-page", "content.example.com"));
    const policy = cached.headers.get("content-security-policy") ?? "";
    expect(policy).toContain("script-src 'none'");
    expect(policy).not.toContain("nonce-");
    // What the render is handed: Next lists the forwarded request headers
    // here, and the policy is not among them.
    expect(cached.headers.get("x-middleware-override-headers") ?? "").not.toContain(
      "content-security-policy"
    );
    // The uncached route still gets this request's nonce.
    const uncached = await middleware(requestTo("/", "content.example.com"));
    expect(uncached.headers.get("content-security-policy") ?? "").toMatch(/'nonce-[^']+'/);
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
    const spy = vi.spyOn(hosted, "hostedAddress").mockRejectedValue(new Error("unreachable"));
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
