/** @vitest-environment jsdom */
// An article address the middleware did not find live in time is answered per request by the cached article's own renderer.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

const AT = new Date("2026-09-04T11:00:00.000Z");
const LIVE_URL = "https://content.example.com/a-page";
const PAGE = {
  publicationId: "pub-1",
  siteId: "site-1",
  slug: "a-page",
  title: "The best onboarding tools",
  heading: null,
  bodyMd: "One paragraph.\n\n## A heading\n\nAnother paragraph.",
  description: "Which onboarding tools small teams pick, and why.",
  faq: [{ question: "How long does it take?", answer: "Under an hour." }],
  made: null,
  grounded: null,
  publisher: { name: "Harbor Plumbing", category: null, timeZone: "UTC" },
  byline: null,
  publishedAt: AT,
  firstPublishedAt: AT,
  liveUrl: LIVE_URL,
  record: { opportunityId: "opp-1", targetQuery: "onboarding tools", measuredOn: AT, mode: "autopilot", liveUrl: LIVE_URL },
};

const state: { pages: unknown[] } = { pages: [PAGE] };

vi.mock("@/lib/account/billing", () => ({ hostedServingState: async () => ({ serve: true }) }));
vi.mock("@/lib/publish/destinations/hosted", () => ({
  tags: { site: (s: string) => `hosted:site:${s}`, page: (p: string) => `hosted:page:${p}` },
  hostedSiteForHostname: async () => null,
  hostedSiteForDomain: async (domain: string) =>
    domain === "example.com" ? { siteId: "site-1", domain, host: `content.${domain}` } : null,
  livePagesForSite: async () => state.pages,
  retiredSlugsForSite: async () => new Set<string>(),
  hostedIdentity: async () => ({ name: "Harbor Plumbing", logoType: null, line: null }),
  taggedForHosted: async () => undefined,
}));

const uncached = await import("@/app/(hosted)/hosted-article/[slug]/route");
const cached = await import("@/app/(hosted)/hosted-live/[host]/[slug]/route");

function ask(host: string, slug: string): Promise<Response> {
  return uncached.GET(new Request(`https://${host}/${slug}`, { headers: { host } }), { params: Promise.resolve({ slug }) });
}

function parse(html: string): Document {
  return new DOMParser().parseFromString(html, "text/html");
}

beforeEach(() => {
  state.pages = [PAGE];
});

describe("a live page that missed the middleware's deadline", () => {
  it("is static HTML: no script but the data blocks, no flight data, one stylesheet, never stored", async () => {
    const response = await ask("content.example.com", "a-page");
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Content-Type")).toBe("text/html; charset=utf-8");
    expect(html.match(/<script(?![^>]*type="application\/ld\+json")[^>]*>/g) ?? []).toEqual([]);
    expect(html).toContain('type="application/ld+json"');
    expect(html).not.toContain("self.__next_f");
    expect(html.match(/<link[^>]*rel="stylesheet"[^>]*>/g)).toEqual(['<link rel="stylesheet" href="/style.css"/>']);
  });

  it("is the cached article's document, byte for byte, so the two heads cannot differ", async () => {
    const fresh = await (await ask("content.example.com", "a-page")).text();
    const kept = await (
      await cached.GET(new Request(LIVE_URL), { params: Promise.resolve({ host: "content.example.com", slug: "a-page" }) })
    ).text();
    expect(fresh).toBe(kept);
    const head = parse(fresh).head;
    expect(head.querySelector("title")?.textContent).toBe("The best onboarding tools");
    expect(head.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe(LIVE_URL);
    expect(head.querySelector('meta[property="og:type"]')?.getAttribute("content")).toBe("article");
  });
});

describe("an address with no live page answers the hosted 404", () => {
  it("on a live site: 404, never stored, in the site's own short note under noindex", async () => {
    const response = await ask("content.example.com", "never-published");
    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const doc = parse(await response.text());
    expect(doc.querySelector('meta[name="robots"]')?.getAttribute("content")).toBe("noindex");
    expect(doc.querySelector("header")?.textContent).toContain("Harbor Plumbing");
    expect(doc.querySelectorAll("h1")).toHaveLength(1);
    expect(doc.querySelector('link[rel="stylesheet"]')?.getAttribute("href")).toBe("/style.css");
  });

  it("on a host no site claims: 404 with nothing of anyone's", async () => {
    const response = await ask("content.stranger.example", "a-page");
    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const doc = parse(await response.text());
    expect(doc.body.textContent?.trim()).toBe("");
    expect(doc.querySelector("a")).toBeNull();
  });
});
