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
import type { CostContext } from "@/lib/costs";
import type { FetchOutcome } from "@/lib/egress/types";
import { OWN_FETCH_SOURCE } from "@/lib/measure/own-fetch";
import { crawlSite, type CrawlPorts } from "@/lib/site-profile/crawl";

const DOMAIN = "example.com";
const HOME = "https://example.com/";
const READ_AT = new Date("2026-09-12T08:00:00.000Z");

function ok(url: string, html: string): FetchOutcome {
  return { ok: true, status: 200, url, html, bytes: html.length, readAt: READ_AT, headers: {} };
}

const NOT_FOUND = (url: string): FetchOutcome => ({ ok: false, reason: "status", status: 404, url, readAt: READ_AT });

interface Ledgered {
  source: string;
  cacheKey: string;
  costCents: number;
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
        ledgered.push({ source: call.source, cacheKey: call.cacheKey, costCents: call.costCents });
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
  onFetch?: () => void
): CrawlPorts & { fetched: string[] } {
  const fetched: string[] = [];
  return {
    fetched,
    async fetchDocument(url: string) {
      fetched.push(url);
      onFetch?.();
      return documents[url] ?? NOT_FOUND(url);
    },
  };
}

const page = (title: string, body = "") => `<html><head><title>${title}</title></head><body><h1>${title}</h1>${body}</body></html>`;

afterEach(() => {
  vi.useRealTimers();
});

describe("crawlSite", () => {
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
    // Exactly what was read: one row per document the port answered, plus
    // the home page. Nothing is invented to fill the bound.
    expect(out.pages).toHaveLength(ports.fetched.filter((u) => documents[u] !== undefined).length + 1);
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
