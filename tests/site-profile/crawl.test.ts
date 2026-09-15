// tests/site-profile/crawl.test.ts — issue #577
//
// What a customer gets from this module: an inventory of their own site —
// read from the sitemap where they have one and from their own links where
// they have not — bounded at a hundred pages and at its own slice of the
// pass, carrying exactly the pages that were read and no invented row
// (SPEC.md §2, §12 ruling 8).
//
// The module imports the product's SSRF-safe fetcher for its default port,
// and `src/lib/config/env.ts` validates every binding at module load — so
// a valid-shaped fixture is in place before the static imports run (the
// same use as `tests/measure/domain/measure-domain.test.ts`). Every port
// here is doubled; `tests/setup.ts` refuses a real network call anyway.
vi.hoisted(() => {
  const ENV_FIXTURE: Record<string, string> = {
    DATABASE_URL: "postgresql://reachkit:reachkit@127.0.0.1:5432/reachkit_scratch",
    SUPABASE_URL: "http://127.0.0.1:3001",
    SUPABASE_ANON_KEY: "anon-key-fixture",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-key-fixture",
    STRIPE_SECRET_KEY: "sk_test_fixture",
    STRIPE_WEBHOOK_SECRET: "whsec_fixture",
    STRIPE_PRICE_ID: "price_fixture",
    RESEND_API_KEY: "re_fixture",
    MAIL_FROM: "hello@reachkit.example",
    DATAFORSEO_LOGIN: "dfs-login-fixture-do-not-leak",
    DATAFORSEO_PASSWORD: "dfs-password-fixture-do-not-leak",
    ANTHROPIC_API_KEY: "sk-ant-fixture",
    NANO_API_KEY: "nano-fixture",
    IP_HASH_SALT: "salt-fixture",
    KILL_SWITCH: "false",
    OWNER_EMAILS: "owner@example.com",
    NEXT_PUBLIC_APP_URL: "https://app.example.com",
    HOSTED_EDGE_CNAME_TARGET: "content.example.com",
  };
  for (const [key, value] of Object.entries(ENV_FIXTURE)) process.env[key] = value;
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { SITE_PROFILE } from "@/lib/config/constants";
import { isFetchRefusal, type CostContext } from "@/lib/costs";
import { parseRobotsTxt } from "@/lib/egress/robots";
import type { SafeFetchOpts } from "@/lib/egress/safe-fetch";
import type { FetchOutcome } from "@/lib/egress/types";
import { OWN_FETCH_SOURCE } from "@/lib/measure/own-fetch";
import { crawlSite, type CrawlPorts } from "@/lib/site-profile/crawl";

const DOMAIN = "example.com";
const HOME = "https://example.com/";
const READ_AT = new Date("2026-09-12T08:00:00.000Z");

function ok(url: string, html: string): FetchOutcome {
  return { ok: true, status: 200, url, html, bytes: html.length, readAt: READ_AT, headers: {} };
}

/** A document whose body the fetcher counted at `bytes`, whatever the
 *  fixture's markup weighs. */
function sized(url: string, html: string, bytes: number): FetchOutcome {
  return { ok: true, status: 200, url, html, bytes, readAt: READ_AT, headers: {} };
}

const NOT_FOUND = (url: string): FetchOutcome => ({ ok: false, reason: "status", status: 404, url, readAt: READ_AT });

interface Ledgered {
  source: string;
  cacheKey: string;
  costCents: number;
  payload: unknown;
}

/** A `CostContext` double that records every ledgered call, runs each
 *  `run()` once, and **fails the test if two `recordFetch` calls overlap**
 *  — `src/lib/costs/index.ts` tracks one in-flight reservation at a time,
 *  and a crawl that fanned them out concurrently would race that slot. */
function fakeCost(opts: { capped?: boolean } = {}): CostContext & { ledgered: Ledgered[] } {
  const ledgered: Ledgered[] = [];
  let inFlight = 0;
  const context = {
    ledgered,
    cap: "FREE",
    async recordFetch<P>(call: { source: string; cacheKey: string; costCents: number; run: () => Promise<P> }) {
      if (inFlight > 0) throw new Error("recordFetch was called concurrently");
      inFlight++;
      try {
        if (opts.capped === true) return { skipped: "cap" as const };
        const payload = await call.run();
        ledgered.push({ source: call.source, cacheKey: call.cacheKey, costCents: call.costCents, payload });
        return { payload, fresh: true, costCents: call.costCents };
      } finally {
        inFlight--;
      }
    },
    capHit: () => opts.capped === true,
    spentCents: () => 0,
    degraded: () => false,
  };
  return context as unknown as CostContext & { ledgered: Ledgered[] };
}

function fakePorts(
  documents: Readonly<Record<string, FetchOutcome>>,
  onFetch?: () => void,
  robotsTxt?: string
): CrawlPorts & { fetched: string[] } {
  const fetched: string[] = [];
  return {
    fetched,
    async fetchDocument(url: string) {
      fetched.push(url);
      onFetch?.();
      return documents[url] ?? NOT_FOUND(url);
    },
    // No robots.txt unless a row gives one: a read with nothing in it.
    async readRobots(origin: string) {
      return { ok: true, origin, readAt: READ_AT, absent: robotsTxt === undefined, ...parseRobotsTxt(robotsTxt ?? "") };
    },
  };
}

const page = (title: string, body = "") => `<html><head><title>${title}</title></head><body><h1>${title}</h1>${body}</body></html>`;

afterEach(() => {
  vi.useRealTimers();
});

describe("crawlSite", () => {
  it("writes a page that would not load as a refusal row, so next week's measurement is never served a negative cache", async () => {
    // BUILD §6.4, "no negative cache". The crawl ledgers under the
    // measurement pass's own `(source, cacheKey)`, so a 404 stored in any
    // shape `costs/cache.ts` does not read as empty would be served back
    // to `readDocument` for the rest of the window — and a healthy site
    // would come out `site_unreadable` on the next free scan.
    const home = page("Home", `<a href="/pricing">Pricing</a>`);
    const cost = fakeCost();

    const out = await crawlSite(
      cost,
      { domain: DOMAIN, homeUrl: HOME, homeHtml: home, sitemaps: [] },
      fakePorts({})
    );

    // The page that would not load is ledgered, and claimed by nothing.
    expect(out.pages.map((p) => p.url)).toEqual([HOME]);
    const refused = cost.ledgered.find((l) => l.cacheKey === "https://example.com/pricing");
    expect(refused?.source).toBe(OWN_FETCH_SOURCE);
    expect(refused?.costCents).toBe(0);
    // `isFetchRefusal` is the whole of what `isEmptyPayload` asks of this
    // payload, and it carries the reason rather than a bare marker.
    expect(isFetchRefusal(refused?.payload)).toBe(true);
    expect(refused?.payload).toEqual({ refusal: "status", status: 404, bytes: 0, host: DOMAIN });
  });

  it("reads the pages the site's own sitemap declares, and never re-reads the home document", async () => {
    const sitemap = `<urlset><url><loc>https://example.com/pricing</loc></url><url><loc>https://example.com/about</loc></url></urlset>`;
    const ports = fakePorts({
      "https://example.com/sitemap.xml": ok("https://example.com/sitemap.xml", sitemap),
      "https://example.com/pricing": ok("https://example.com/pricing", page("Pricing")),
      "https://example.com/about": ok("https://example.com/about", page("About us")),
    });

    const out = await crawlSite(fakeCost(), { domain: DOMAIN, homeUrl: HOME, homeHtml: page("Example Payments"), sitemaps: [] }, ports);

    expect(out.pages.map((p) => p.url)).toEqual([HOME, "https://example.com/pricing", "https://example.com/about"]);
    expect(out.pages[0]?.title).toBe("Example Payments");
    expect(ports.fetched).not.toContain(HOME);
    expect(out.stoppedBy).toBe("complete");
  });

  it("follows a sitemap index one level down", async () => {
    const index = `<sitemapindex><sitemap><loc>https://example.com/sitemap-posts.xml</loc></sitemap></sitemapindex>`;
    const child = `<urlset><url><loc>https://example.com/blog/one</loc></url></urlset>`;
    const ports = fakePorts({
      "https://example.com/robots-sitemap.xml": ok("https://example.com/robots-sitemap.xml", index),
      "https://example.com/sitemap-posts.xml": ok("https://example.com/sitemap-posts.xml", child),
      "https://example.com/blog/one": ok("https://example.com/blog/one", page("One")),
    });

    const out = await crawlSite(
      fakeCost(),
      { domain: DOMAIN, homeUrl: HOME, homeHtml: page("Home"), sitemaps: ["https://example.com/robots-sitemap.xml"] },
      ports
    );

    expect(out.pages.map((p) => p.url)).toContain("https://example.com/blog/one");
  });

  it("still yields an inventory from internal links when the site has no sitemap", async () => {
    const home = page("Home", `<a href="/pricing">Pricing</a><a href="/about">About</a><a href="https://rival.example.net/x">Rival</a><a href="/brochure.pdf">PDF</a>`);
    const ports = fakePorts({
      "https://example.com/pricing": ok("https://example.com/pricing", page("Pricing", `<a href="/contact">Contact</a>`)),
      "https://example.com/about": ok("https://example.com/about", page("About us")),
      "https://example.com/contact": ok("https://example.com/contact", page("Contact us")),
    });

    const out = await crawlSite(fakeCost(), { domain: DOMAIN, homeUrl: HOME, homeHtml: home, sitemaps: [] }, ports);

    // Every own page, reached by link alone — and a second-hop link
    // (`/contact`, found on the pricing page) with it.
    expect(out.pages.map((p) => p.url).sort()).toEqual([
      HOME,
      "https://example.com/about",
      "https://example.com/contact",
      "https://example.com/pricing",
    ]);
    // A rival's domain and a PDF are never fetched.
    expect(ports.fetched).not.toContain("https://rival.example.net/x");
    expect(ports.fetched).not.toContain("https://example.com/brochure.pdf");
  });

  it("reads the home document itself when the caller holds no markup", async () => {
    // The production path: `run.ts` carries the home page's rendered text,
    // not its HTML, so the crawl is handed `null` and reads the document
    // under the key the measurement pass already ledgered it with. A
    // sitemap-less site must still yield an inventory from its own links
    // (issue #577, done-when 8).
    const home = page("Example Payments", `<a href="/pricing">Pricing</a><a href="/about">About</a>`);
    const ports = fakePorts({
      [HOME]: ok(HOME, home),
      "https://example.com/pricing": ok("https://example.com/pricing", page("Pricing")),
      "https://example.com/about": ok("https://example.com/about", page("About us")),
    });

    const out = await crawlSite(fakeCost(), { domain: DOMAIN, homeUrl: HOME, homeHtml: null, sitemaps: [] }, ports);

    expect(out.pages.map((p) => p.url)).toEqual([HOME, "https://example.com/pricing", "https://example.com/about"]);
    expect(out.pages[0]?.title).toBe("Example Payments");
    expect(ports.fetched).toContain(HOME);
  });

  it("returns no pages, and does not throw, when the home document cannot be read", async () => {
    const out = await crawlSite(
      fakeCost(),
      { domain: DOMAIN, homeUrl: HOME, homeHtml: null, sitemaps: [] },
      fakePorts({})
    );

    expect(out.pages).toEqual([]);
    expect(out.discovered).toBe(0);
  });

  it("reads one page once, however many ways the site links to it", async () => {
    const home = page("Home", `<a href="/pricing">a</a><a href="/pricing/">b</a><a href="/pricing?utm=x">c</a><a href="/pricing#plans">d</a>`);
    const ports = fakePorts({ "https://example.com/pricing": ok("https://example.com/pricing", page("Pricing")) });

    const out = await crawlSite(fakeCost(), { domain: DOMAIN, homeUrl: HOME, homeHtml: home, sitemaps: [] }, ports);

    expect(out.pages).toHaveLength(2);
    expect(ports.fetched.filter((u) => u.includes("/pricing"))).toHaveLength(1);
  });

  it("stops at a hundred pages and says so", async () => {
    const links = Array.from({ length: 150 }, (_v, i) => `<a href="/p/${i}">p</a>`).join("");
    const documents: Record<string, FetchOutcome> = {};
    for (let i = 0; i < 150; i++) {
      documents[`https://example.com/p/${i}`] = ok(`https://example.com/p/${i}`, page(`Page ${i}`));
    }
    const ports = fakePorts(documents);

    const out = await crawlSite(fakeCost(), { domain: DOMAIN, homeUrl: HOME, homeHtml: page("Home", links), sitemaps: [] }, ports);

    expect(out.pages).toHaveLength(SITE_PROFILE.MAX_PAGES);
    expect(out.stoppedBy).toBe("page_cap");
    expect(out.discovered).toBeGreaterThan(SITE_PROFILE.MAX_PAGES);
  });

  it("stops when its time budget is spent, recording what it read and nothing more", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-12T08:00:00.000Z"));

    const links = Array.from({ length: 60 }, (_v, i) => `<a href="/p/${i}">p</a>`).join("");
    const documents: Record<string, FetchOutcome> = {};
    for (let i = 0; i < 60; i++) {
      documents[`https://example.com/p/${i}`] = ok(`https://example.com/p/${i}`, page(`Page ${i}`));
    }
    // Every read costs a second of the crawl's own budget.
    const ports = fakePorts(documents, () => vi.advanceTimersByTime(1_000));

    const out = await crawlSite(fakeCost(), { domain: DOMAIN, homeUrl: HOME, homeHtml: page("Home", links), sitemaps: [] }, ports);

    expect(out.stoppedBy).toBe("time_budget");
    expect(out.pages.length).toBeLessThan(61);
    // Exactly what was read: every row is the home page or a document the
    // port answered, and nothing is invented to fill the bound. The read in
    // flight when the budget ran out was aborted (issue 610), so it — and
    // any batch-mate started after it — is not a row.
    const answered = ports.fetched.filter((u) => documents[u] !== undefined);
    for (const p of out.pages.slice(1)) expect(answered).toContain(p.url);
    expect(out.pages.length).toBeLessThanOrEqual(answered.length);
    expect(out.pages.length).toBeGreaterThan(answered.length - SITE_PROFILE.CONCURRENCY);
  });

  it("ledgers every read at zero cents under the own-document source", async () => {
    const cost = fakeCost();
    const ports = fakePorts({ "https://example.com/pricing": ok("https://example.com/pricing", page("Pricing")) });

    await crawlSite(cost, { domain: DOMAIN, homeUrl: HOME, homeHtml: page("Home", `<a href="/pricing">p</a>`), sitemaps: [] }, ports);

    expect(cost.ledgered.length).toBeGreaterThan(0);
    for (const call of cost.ledgered) {
      expect(call.source).toBe(OWN_FETCH_SOURCE);
      expect(call.costCents).toBe(0);
    }
    expect(cost.ledgered.map((c) => c.cacheKey)).toContain("https://example.com/pricing");
  });

  it("claims no page it could not read, and no page at all once the cap is spent", async () => {
    const home = page("Home", `<a href="/gone">gone</a><a href="/pricing">p</a>`);
    const documents = { "https://example.com/pricing": ok("https://example.com/pricing", page("Pricing")) };

    const read = await crawlSite(fakeCost(), { domain: DOMAIN, homeUrl: HOME, homeHtml: home, sitemaps: [] }, fakePorts(documents));
    expect(read.pages.map((p) => p.url)).toEqual([HOME, "https://example.com/pricing"]);

    const capped = await crawlSite(fakeCost({ capped: true }), { domain: DOMAIN, homeUrl: HOME, homeHtml: home, sitemaps: [] }, fakePorts(documents));
    expect(capped.pages.map((p) => p.url)).toEqual([HOME]);
  });
});

describe("what SPEC §9's technical-issue checks read off the crawl (#570)", () => {
  const TIMEOUT = (url: string): FetchOutcome => ({ ok: false, reason: "timeout", url, readAt: READ_AT });

  it("names a linked page that answered with an HTTP error as broken, and a page it read as fetched", async () => {
    const home = page("Home", `<a href="/pricing">Pricing</a><a href="/about#team">About</a>`);
    const out = await crawlSite(
      fakeCost(),
      { domain: DOMAIN, homeUrl: HOME, homeHtml: home, sitemaps: [] },
      fakePorts({ "https://example.com/about": ok("https://example.com/about", page("About")) })
    );

    expect(out.pages[0]?.links).toEqual(["https://example.com/pricing", "https://example.com/about"]);
    expect(out.broken).toEqual(["https://example.com/pricing"]);
    expect(out.fetched).toEqual(expect.arrayContaining([HOME, "https://example.com/pricing", "https://example.com/about"]));
  });

  it("a link whose fetch timed out is neither broken nor fetched — a slow server is not a missing page", async () => {
    const home = page("Home", `<a href="/pricing">Pricing</a>`);
    const out = await crawlSite(
      fakeCost(),
      { domain: DOMAIN, homeUrl: HOME, homeHtml: home, sitemaps: [] },
      fakePorts({ "https://example.com/pricing": TIMEOUT("https://example.com/pricing") })
    );
    expect(out.broken).toEqual([]);
    expect(out.fetched).not.toContain("https://example.com/pricing");
  });

  it("states whether the site has a sitemap: found, a plain 404, or a read that did not come back", async () => {
    const run = (sitemapAnswer: FetchOutcome | undefined) =>
      crawlSite(
        fakeCost(),
        { domain: DOMAIN, homeUrl: HOME, homeHtml: page("Home"), sitemaps: [] },
        fakePorts(sitemapAnswer === undefined ? {} : { "https://example.com/sitemap.xml": sitemapAnswer })
      );
    const urlset = `<urlset><url><loc>https://example.com/</loc></url></urlset>`;

    expect((await run(ok("https://example.com/sitemap.xml", urlset))).sitemap).toBe("found");
    expect((await run(undefined)).sitemap).toBe("absent");
    expect((await run(TIMEOUT("https://example.com/sitemap.xml"))).sitemap).toBe("unreadable");
  });

  it("reads each page's meta description, phone viewport and structured data, and times its own fetch", async () => {
    const about =
      `<html><head><title>About</title><meta content="Who we are." name="description">` +
      `<meta name="viewport" content="width=device-width, initial-scale=1">` +
      `<script type="application/ld+json">{"@type":"Organization"}</script></head><body></body></html>`;
    const out = await crawlSite(
      fakeCost(),
      { domain: DOMAIN, homeUrl: HOME, homeHtml: page("Home", `<a href="/about">About</a>`), sitemaps: [] },
      fakePorts({ "https://example.com/about": ok("https://example.com/about", about) })
    );

    const [home, read] = out.pages;
    expect(home?.facts).toEqual({ metaDescription: "", noindex: false, phoneViewport: false, schemaTypes: 0 });
    // The home document was handed over, not fetched: nothing to time.
    expect(home?.fetchMs).toBeNull();
    expect(read?.facts).toEqual({ metaDescription: "Who we are.", noindex: false, phoneViewport: true, schemaTypes: 1 });
    expect(typeof read?.fetchMs).toBe("number");
  });
});

describe("the site's own rules and the crawl's hard bounds (issue 610)", () => {
  const linksTo = (paths: readonly string[]) => paths.map((p) => `<a href="${p}">x</a>`).join("");

  it("a Disallow: /cart line keeps /cart out of the inventory — and out of the fetches", async () => {
    const documents: Record<string, FetchOutcome> = {
      "https://example.com/cart": ok("https://example.com/cart", page("Cart")),
      "https://example.com/cart/checkout": ok("https://example.com/cart/checkout", page("Checkout")),
      "https://example.com/pricing": ok("https://example.com/pricing", page("Pricing")),
    };
    const ports = fakePorts(documents, undefined, "User-agent: *\nDisallow: /cart\n");

    const out = await crawlSite(
      fakeCost(),
      { domain: DOMAIN, homeUrl: HOME, homeHtml: page("Home", linksTo(["/cart", "/cart/checkout", "/pricing"])), sitemaps: [] },
      ports
    );

    expect(out.pages.map((p) => p.url)).toEqual([HOME, "https://example.com/pricing"]);
    expect(ports.fetched.filter((u) => u.includes("/cart"))).toEqual([]);
  });

  it("Crawl-delay: 5 is applied as 1 s between reads, one read at a time", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-12T08:00:00.000Z"));
    const paths = ["/a", "/b", "/c"];
    const documents: Record<string, FetchOutcome> = {};
    for (const p of paths) documents[`https://example.com${p}`] = ok(`https://example.com${p}`, page(p));
    const readAt: number[] = [];
    const ports = fakePorts(documents, () => readAt.push(Date.now()), "User-agent: *\nCrawl-delay: 5\n");

    const crawling = crawlSite(
      fakeCost(),
      { domain: DOMAIN, homeUrl: HOME, homeHtml: page("Home", linksTo(paths)), sitemaps: [] },
      ports
    );
    await vi.advanceTimersByTimeAsync(SITE_PROFILE.CRAWL_MS);
    const out = await crawling;

    const pageReads = ports.fetched
      .map((u, i) => ({ u, at: readAt[i]! }))
      .filter(({ u }) => documents[u] !== undefined)
      .map(({ at }) => at);
    expect(pageReads).toHaveLength(3);
    expect(pageReads[1]! - pageReads[0]!).toBe(SITE_PROFILE.CRAWL_DELAY_MAX_MS);
    expect(pageReads[2]! - pageReads[1]!).toBe(SITE_PROFILE.CRAWL_DELAY_MAX_MS);
    expect(out.pages).toHaveLength(4);
  });

  it("stops fetching once 8 MB have been read, and the inventory records what it has", async () => {
    // Twelve pages of 1 MB each: the bound is reached before the twelfth.
    const MB = 1_000_000;
    const paths = Array.from({ length: 12 }, (_v, i) => `/big/${i}`);
    const opts: SafeFetchOpts[] = [];
    const documents: Record<string, FetchOutcome> = {};
    for (const p of paths) {
      const url = `https://example.com${p}`;
      documents[url] = sized(url, page(p), MB);
    }
    const ports = fakePorts(documents);
    const fetchDocument = ports.fetchDocument;
    ports.fetchDocument = async (url, o) => {
      opts.push(o);
      const answer = await fetchDocument(url, o);
      // The fetcher's own rule: a body over the cap is refused, not held.
      if (answer.ok && answer.bytes > (o.maxBytes ?? Infinity)) {
        return { ok: false, reason: "too_large", url, readAt: READ_AT };
      }
      return answer;
    };

    const out = await crawlSite(
      fakeCost(),
      { domain: DOMAIN, homeUrl: HOME, homeHtml: page("Home", linksTo(paths)), sitemaps: [] },
      ports
    );

    expect(out.stoppedBy).toBe("byte_cap");
    const held = out.pages.length - 1; // every page but the home document was a 1 MB read
    expect(held).toBeGreaterThan(0);
    expect(held * MB).toBeLessThanOrEqual(SITE_PROFILE.CRAWL_MAX_BYTES);
    // Every read was capped at what was left, so no batch could pass the bound.
    for (const o of opts) expect(o.maxBytes).toBeLessThanOrEqual(SITE_PROFILE.CRAWL_MAX_BYTES);
  });

  it("a page too big only for its share of a batch is read again alone, not lost", async () => {
    const big = "https://example.com/big";
    const small = Array.from({ length: 5 }, (_v, i) => `https://example.com/s/${i}`);
    const documents: Record<string, FetchOutcome> = { [big]: sized(big, page("Big"), 3_000_000) };
    for (const u of small) documents[u] = ok(u, page(u));
    const ports = fakePorts(documents);
    const fetchDocument = ports.fetchDocument;
    ports.fetchDocument = async (url, o) => {
      const answer = await fetchDocument(url, o);
      if (answer.ok && answer.bytes > (o.maxBytes ?? Infinity)) return { ok: false, reason: "too_large", url, readAt: READ_AT };
      return answer;
    };

    const out = await crawlSite(
      fakeCost(),
      { domain: DOMAIN, homeUrl: HOME, homeHtml: page("Home", linksTo(["/big", "/s/0", "/s/1", "/s/2", "/s/3", "/s/4"])), sitemaps: [] },
      ports
    );

    expect(out.pages.map((p) => p.url)).toContain(big);
    expect(out.stoppedBy).toBe("complete");
  });

  it("a fetch still in flight at CRAWL_MS is aborted, and the crawl returns inside CRAWL_MS plus one second", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-12T08:00:00.000Z"));
    const started = Date.now();
    const signals: AbortSignal[] = [];
    const ports = fakePorts({});
    // A server that never answers — and a port that ignores the signal, so
    // the crawl cannot be relying on the fetcher to give up for it.
    ports.fetchDocument = (url, o) => {
      ports.fetched.push(url);
      if (o.signal !== undefined) signals.push(o.signal);
      return new Promise<FetchOutcome>(() => {});
    };

    let returnedAt: number | null = null;
    const crawling = crawlSite(
      fakeCost(),
      { domain: DOMAIN, homeUrl: HOME, homeHtml: page("Home", `<a href="/slow">slow</a>`), sitemaps: [] },
      ports
    ).then((out) => {
      returnedAt = Date.now();
      return out;
    });

    await vi.advanceTimersByTimeAsync(SITE_PROFILE.CRAWL_MS + 1_000);
    const out = await crawling;

    expect(returnedAt).not.toBeNull();
    expect(returnedAt! - started).toBeLessThanOrEqual(SITE_PROFILE.CRAWL_MS + 1_000);
    expect(out.stoppedBy).toBe("time_budget");
    expect(out.pages.map((p) => p.url)).toEqual([HOME]);
    expect(signals.length).toBeGreaterThan(0);
    expect(signals.every((s) => s.aborted)).toBe(true);
  });
});
