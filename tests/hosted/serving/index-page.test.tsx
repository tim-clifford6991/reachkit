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
    hostedSiteForDomain: async (domain: string) =>
      domain === "example.com" ? { siteId: "site-1", domain, host: `content.${domain}` } : null,
    hostedSiteForHostname: async () => null,
    livePageBySlug: async () => null,
    livePagesForSite: async () => state.pages,
    wasEverLive: async () => false,
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
    grounded: null,
    publisher: { name: "example.com", category: null, timeZone: null },
    publishedAt: new Date(publishedAt),
    liveUrl: `https://content.example.com/${slug}`,
    record: {},
  };
}

async function render(q?: string): Promise<string> {
  const tree = await Page({
    params: Promise.resolve({}),
    searchParams: Promise.resolve(q === undefined ? {} : { q }),
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
