/** @vitest-environment jsdom */
// tests/hosted/serving/index-page.test.tsx — SPEC §7 (2026-09-16)
//
// The root of a hosted host: every live page, newest first, a search that
// works with no script, and an empty site that says so instead of a 404.
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

const state: { host: string; pages: unknown[] } = { host: "content.example.com", pages: [] };

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ host: state.host }),
}));

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
    retiredSlugsForSite: async () => new Set<string>(),
    hostedSiteForDomain: async (domain: string) =>
      domain === "example.com" ? { siteId: "site-1", domain, host: `content.${domain}` } : null,
    hostedSiteForHostname: async () => null,
    livePageBySlug: async () => null,
    livePagesForSite: async () => state.pages,
    hostedIdentity: async (a: { domain: string }) => ({ name: a.domain, logoType: null, line: null }),
    hostedAddress: async () => ({ state: "none", publicationId: null }),
  };
});

const Page = (await import("@/app/(hosted)/hosted-page/[[...slug]]/page")).default;
const { generateMetadata } = await import("@/app/(hosted)/hosted-page/[[...slug]]/page");

function page(slug: string, title: string, body: string, publishedAt: string): unknown {
  return {
    publicationId: `pub-${slug}`,
    siteId: "site-1",
    slug,
    title,
    bodyMd: body,
    description: null,
    faq: [],
    made: null,
    grounded: null,
    publisher: { name: "example.com", category: null, timeZone: null },
    publishedAt: new Date(publishedAt),
    firstPublishedAt: new Date(publishedAt),
    byline: null,
    liveUrl: `https://content.example.com/${slug}`,
    record: {},
  };
}

async function render(q?: string, pageNumber?: string): Promise<string> {
  const tree = await Page({
    params: Promise.resolve({}),
    searchParams: Promise.resolve({
      ...(q === undefined ? {} : { q }),
      ...(pageNumber === undefined ? {} : { page: pageNumber }),
    }),
  });
  return renderToStaticMarkup(tree);
}

beforeEach(() => {
  state.host = "content.example.com";
  state.pages = [
    page("onboarding-tools", "The best onboarding tools", "Time to the first flow.", "2026-09-15T10:00:00Z"),
    page("pricing-guide", "How onboarding software is priced", "Seats and tiers.", "2026-09-14T10:00:00Z"),
  ];
});

describe("the hosted index", () => {
  it("lists every live page, newest first, each linking to its address on the host", async () => {
    const html = await render();
    expect(html.indexOf("The best onboarding tools")).toBeLessThan(html.indexOf("How onboarding software is priced"));
    expect(html).toContain('href="/onboarding-tools"');
    expect(html).toContain('href="/pricing-guide"');
    expect(html).toContain("15 Sep 2026");
  });

  it("searches with a plain GET form, over title and body, case-insensitively", async () => {
    const html = await render("SEATS");
    expect(html).toMatch(/<form[^>]*method="get"/);
    expect(html).toContain('name="q"');
    expect(html).toContain("How onboarding software is priced");
    expect(html).not.toContain("The best onboarding tools");
  });

  it("says so when nothing matches, and when nothing is published at all", async () => {
    expect(await render("zebra")).toContain("No articles match “zebra”.");
    state.pages = [];
    const empty = await render();
    expect(empty).toContain("Nothing has been published here yet.");
    expect(empty).not.toContain("<ul");
  });

  it("carries Blog and WebSite data naming the pages it lists, and no others (issue 1141)", async () => {
    const graphOf = (html: string): Record<string, unknown>[] => {
      const block = /<script type="application\/ld\+json">(.*?)<\/script>/s.exec(html)?.[1] ?? "{}";
      return (JSON.parse(block) as { "@graph": Record<string, unknown>[] })["@graph"];
    };
    const [site, blog] = graphOf(await render());
    expect(site).toMatchObject({
      "@type": "WebSite",
      url: "https://content.example.com/",
      name: "example.com",
    });
    expect(blog).toMatchObject({
      "@type": "Blog",
      url: "https://content.example.com/",
      name: "example.com",
      isPartOf: { "@id": site?.["@id"] },
      blogPost: [
        { headline: "The best onboarding tools", url: "https://content.example.com/onboarding-tools" },
        { headline: "How onboarding software is priced", url: "https://content.example.com/pricing-guide" },
      ],
    });
    // A search lists its matches, and the data follows the list.
    const [, searched] = graphOf(await render("seats"));
    expect((searched?.blogPost as { headline: string }[]).map((post) => post.headline)).toEqual([
      "How onboarding software is priced",
    ]);
  });

  it("reads as board HostedIndex: guides from the business, a search of them, the recent ones, and a footer of name, site and feed", async () => {
    const doc = new DOMParser().parseFromString(await render(), "text/html");
    expect(doc.querySelector("h1")?.textContent).toBe("Guides from example.com");
    expect(doc.querySelector('input[name="q"]')?.getAttribute("aria-label")).toBe("Search the guides");
    expect(doc.querySelector("#articles")?.textContent).toBe("Recent guides");
    const footer = doc.querySelector("footer")!;
    expect([...footer.firstElementChild!.children].map((part) => part.textContent)).toEqual(["© example.com", "example.com", "RSS"]);
    expect(footer.querySelector('a[href="/rss.xml"]')).not.toBeNull();
  });

  it("opens with the newest page as the featured card, and the rest as cards under it", async () => {
    const html = await render();
    const featured = html.slice(html.indexOf("Latest"), html.indexOf('id="articles"'));
    expect(featured).toContain("The best onboarding tools");
    expect(featured).not.toContain("How onboarding software is priced");
  });

  it("pages the cards with plain links: ?page= on the address, and the search kept", async () => {
    state.pages = Array.from({ length: 30 }, (_, i) =>
      page(`guide-${i}`, `Guide ${i}`, "Seats and tiers.", new Date(Date.UTC(2026, 8, 30 - i)).toISOString())
    );
    // 1 featured and 29 cards: three pages of twelve.
    const first = await render();
    expect(first).toContain("Page 1 of 3");
    expect(first).toContain('href="/?page=2"');
    expect(first).not.toContain('rel="prev"');

    const second = await render(undefined, "2");
    // The cards page; "All guides" under them lists every page on each.
    const cards = new DOMParser().parseFromString(second, "text/html").querySelector("[aria-labelledby='articles']")!.innerHTML;
    expect(cards).toContain('href="/guide-13"');
    expect(cards).not.toContain('href="/guide-12"');
    expect(second).not.toContain("Latest");
    expect(second).toMatch(/<a href="\/" rel="prev"[^>]*>Previous page<\/a>/);
    expect(second).toMatch(/<a href="\/\?page=3" rel="next"[^>]*>Next page<\/a>/);

    // A search keeps its query.
    expect(await render("seats", "2")).toContain('href="/?q=seats&amp;page=3"');
  });

  it("answers a page past the last 404, with or without a search (issue 1514)", async () => {
    state.pages = Array.from({ length: 30 }, (_, i) =>
      page(`guide-${i}`, `Guide ${i}`, "Seats and tiers.", new Date(Date.UTC(2026, 8, 30 - i)).toISOString())
    );
    expect(await render(undefined, "3")).toContain("Page 3 of 3");
    await expect(render(undefined, "4")).rejects.toThrow();
    await expect(render(undefined, "9999999")).rejects.toThrow();
    await expect(render("seats", "4")).rejects.toThrow();
    // An empty site has its one page and no second.
    state.pages = [];
    await expect(render(undefined, "2")).rejects.toThrow();
  });

  it("each later page of the index is its own canonical; a search and page 1 name the index (issue 1514)", async () => {
    state.pages = Array.from({ length: 30 }, (_, i) =>
      page(`guide-${i}`, `Guide ${i}`, "Seats and tiers.", new Date(Date.UTC(2026, 8, 30 - i)).toISOString())
    );
    const at = async (search: Record<string, string>) =>
      (await generateMetadata({ params: Promise.resolve({}), searchParams: Promise.resolve(search) })).alternates
        ?.canonical;
    expect(await at({ page: "2" })).toBe("https://content.example.com/?page=2");
    expect(await at({ page: "3" })).toBe("https://content.example.com/?page=3");
    expect(await at({ page: "1" })).toBe("https://content.example.com/");
    expect(await at({})).toBe("https://content.example.com/");
    expect(await at({ q: "seats", page: "2" })).toBe("https://content.example.com/");
    // The share card's address is the page's own canonical too.
    const meta = await generateMetadata({ params: Promise.resolve({}), searchParams: Promise.resolve({ page: "2" }) });
    expect((meta.openGraph as { url?: string }).url).toBe("https://content.example.com/?page=2");
  });

  it("carries nothing of ReachKit's", async () => {
    expect((await render()).toLowerCase()).not.toContain("reachkit");
  });

  it("a Host that is no site has no index: 404", async () => {
    state.host = "content.unknown.test";
    await expect(render()).rejects.toThrow();
  });

  it("names its canonical on the customer's host", async () => {
    const meta = await generateMetadata({ params: Promise.resolve({}) });
    expect(meta.alternates?.canonical).toBe("https://content.example.com/");
  });
});
