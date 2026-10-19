/** @vitest-environment jsdom */
// tests/hosted/indexing/language.test.tsx — SPEC §7 (2026-10-18), issue 1514
//
// A hosted page states its site's language where an engine reads it: the
// document's `<html lang>`, on both routes that draw one, and the feed's
// `<language>` — the tag `inLanguage` and `og:locale` already state (D66).
// The document carries none of ReachKit's scripts.
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

const state: { host: string; locale: { country: string; language: string } } = {
  host: "content.example.com",
  locale: { country: "DE", language: "de" },
};

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ host: state.host }),
}));

vi.mock("@/lib/account/billing", () => ({
  hostedServingState: async () => ({ serve: true }),
}));

vi.mock("@/lib/locale/site", () => ({
  siteLocale: async () => state.locale,
}));

vi.mock("@/lib/publish/destinations/hosted", () => ({
  tags: { site: (s: string) => `hosted:site:${s}`, page: (p: string) => `hosted:page:${p}` },
  retiredSlugsForSite: async () => new Set<string>(),
  hostedSiteForDomain: async (domain: string) =>
    domain === "example.com" ? { siteId: "site-1", domain, host: `content.${domain}` } : null,
  hostedSiteForHostname: async () => null,
  livePagesForSite: async () => [],
  hostedIdentity: async () => ({ name: "Bäckerei Beispiel", logoType: null, line: null }),
}));

const HostedPageLayout = (await import("@/app/(hosted)/hosted-page/layout")).default;
const HostedLiveLayout = (await import("@/app/(hosted)/hosted-live/[host]/layout")).default;
const { GET: feed } = await import("@/app/(hosted)/hosted-page/rss.xml/route");

function htmlTag(markup: string): string {
  return /<html[^>]*>/.exec(markup)?.[0] ?? "";
}

beforeEach(() => {
  state.host = "content.example.com";
  state.locale = { country: "DE", language: "de" };
});

describe("issue 1514 — a hosted page is in its site's language", () => {
  it("the uncached route's document states the site's tag on <html>", async () => {
    const markup = renderToStaticMarkup(await HostedPageLayout({ children: null }));
    expect(htmlTag(markup)).toContain('lang="de-DE"');
  });

  it("the cached article's document states it from the host in its path", async () => {
    state.host = "";
    const markup = renderToStaticMarkup(
      await HostedLiveLayout({ children: null, params: Promise.resolve({ host: "content.example.com" }) })
    );
    expect(htmlTag(markup)).toContain('lang="de-DE"');
  });

  it("each site its own: a UK site is en-GB, and a host that serves none the default", async () => {
    state.locale = { country: "GB", language: "en" };
    expect(htmlTag(renderToStaticMarkup(await HostedPageLayout({ children: null })))).toContain('lang="en-GB"');
    state.host = "content.unknown.example";
    expect(htmlTag(renderToStaticMarkup(await HostedPageLayout({ children: null })))).toContain('lang="en-US"');
  });

  it("the feed's <language> is the site's tag", async () => {
    const response = await feed(new Request("https://ignored.example/hosted-page/rss.xml", { headers: { host: state.host } }));
    expect(await response.text()).toContain("<language>de-DE</language>");
  });

  it("the feed's channel title and description are in the site's language (issue 1545)", async () => {
    const response = await feed(new Request("https://ignored.example/hosted-page/rss.xml", { headers: { host: state.host } }));
    const channel = (await response.text()).split("<item>")[0]!;
    expect(channel).toContain("<title>Artikel · Bäckerei Beispiel</title>");
    expect(channel).toContain("<description>Artikel und Ratgeber von Bäckerei Beispiel.</description>");
    expect(channel).not.toMatch(/Articles|guides from/);
  });

  it("the document carries no script of ReachKit's", async () => {
    const markup = renderToStaticMarkup(await HostedPageLayout({ children: null }));
    expect(markup).not.toContain("<script");
  });
});
