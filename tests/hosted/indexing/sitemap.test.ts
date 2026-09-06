// tests/hosted/indexing/sitemap.test.ts — BUILD §9, REQ-059 c3, ADR-002, #49
//
// Exactly this site's live pages, and nothing else. The rows that matter
// are the exclusions: another site's page, a page in any state but live, a
// preview address, a ReachKit address, a report address.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

const sites = new Map<string, string>();
const pagesBySite = new Map<string, unknown[]>();
const serving = new Map<string, { serve: boolean; because?: string }>();

vi.mock("@/lib/publish/destinations/hosted", async () => {
  const address = await import("@/lib/publish/destinations/hosted/address");
  return {
    hostedHostFor: address.hostedHostFor,
    liveUrlFor: address.liveUrlFor,
    tags: { site: (s: string) => `hosted:site:${s}`, page: (p: string) => `hosted:page:${p}` },
    hostedSiteForDomain: async (domain: string) => {
      const id = sites.get(domain);
      return id === undefined ? null : { siteId: id, domain };
    },
    livePagesForSite: async (siteId: string) => pagesBySite.get(siteId) ?? [],
    livePageBySlug: async () => null,
    wasEverLive: async () => false,
  };
});

vi.mock("@/lib/account/billing", () => ({
  hostedServingState: async (siteId: string) => serving.get(siteId) ?? { serve: true },
}));

const { PREVIEW_HOST_SUFFIX } = await import("@/lib/config/constants");
const { GET } = await import("@/app/(hosted)/sitemap.xml/route");

function page(slug: string, domain = "example.com"): unknown {
  return {
    publicationId: `pub-${slug}`,
    siteId: "site-1",
    slug,
    title: slug,
    bodyMd: "",
    faq: [],
    publishedAt: new Date("2026-09-01T09:00:00.000Z"),
    liveUrl: `https://content.${domain}/${slug}`,
    record: {
      opportunityId: "opp",
      targetQuery: "q",
      measuredOn: null,
      mode: "autopilot",
      liveUrl: `https://content.${domain}/${slug}`,
    },
  };
}

function get(host: string): Promise<Response> {
  return GET(new Request("https://ignored.example/sitemap.xml", { headers: { host } }));
}

beforeEach(() => {
  sites.clear();
  pagesBySite.clear();
  serving.clear();
  sites.set("example.com", "site-1");
  sites.set("other.example", "site-2");
  pagesBySite.set("site-1", [page("first"), page("second")]);
  pagesBySite.set("site-2", [page("theirs", "other.example")]);
});

describe("REQ-059 c3 — a published hosted page is listed in a sitemap", () => {
  it("every live page of this site is listed, as its own live address", async () => {
    const body = await (await get("content.example.com")).text();
    expect(body).toContain("<loc>https://content.example.com/first</loc>");
    expect(body).toContain("<loc>https://content.example.com/second</loc>");
  });

  it("it is a valid urlset with the sitemap namespace", async () => {
    const response = await get("content.example.com");
    const body = await response.text();
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("application/xml");
    expect(body.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(body).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(body.trimEnd().endsWith("</urlset>")).toBe(true);
  });

  it("each entry carries the date the page went live", async () => {
    expect(await (await get("content.example.com")).text()).toContain("<lastmod>2026-09-01</lastmod>");
  });
});

describe("what it may never contain", () => {
  it("another site's pages are absent", async () => {
    expect(await (await get("content.example.com")).text()).not.toContain("theirs");
  });

  it("an unpublished page is absent the moment its row changes", async () => {
    pagesBySite.set("site-1", [page("first")]);
    const body = await (await get("content.example.com")).text();
    expect(body).toContain("first");
    expect(body).not.toContain("second");
  });

  it("no preview address and no ReachKit address appears", async () => {
    const body = await (await get("content.example.com")).text();
    expect(body).not.toContain(PREVIEW_HOST_SUFFIX);
    expect(body.toLowerCase()).not.toContain("reachkit");
  });

  it("no report address can reach it: it emits live hosted URLs and nothing else", async () => {
    // ADR-002 decision 1 — report pages are noindex forever and in no
    // sitemap. Nothing here can name one: every `<loc>` is a live URL of a
    // hosted publication.
    const body = await (await get("content.example.com")).text();
    expect(body).not.toContain("/scan/");
    const locs = [...body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(locs.every((loc) => loc?.startsWith("https://content.example.com/"))).toBe(true);
  });
});

describe("the states this document has to have", () => {
  it("a site with no live page yields a valid empty sitemap, never an error", async () => {
    pagesBySite.set("site-1", []);
    const response = await get("content.example.com");
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("<urlset");
    expect(body).not.toContain("<url>");
  });

  it("a preview host has no sitemap at all (ADR-002)", async () => {
    expect((await get(`a-page.${PREVIEW_HOST_SUFFIX}`)).status).toBe(404);
  });

  it("an unknown host has none", async () => {
    expect((await get("content.stranger.example")).status).toBe(404);
    expect((await get("reachkit.example")).status).toBe(404);
  });

  it("a site whose serving has stopped has none", async () => {
    serving.set("site-1", { serve: false, because: "retention_elapsed" });
    expect((await get("content.example.com")).status).toBe(404);
  });

  it("it is never cached: an unpublished page leaves it at once, not after a TTL", async () => {
    expect((await get("content.example.com")).headers.get("Cache-Control")).toBe("no-store");
  });
});
