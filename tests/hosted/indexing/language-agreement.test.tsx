/** @vitest-environment jsdom */
// tests/hosted/indexing/language-agreement.test.tsx — SPEC §7 (2026-10-18), issue 1514
//
// One hosted render states one language everywhere an engine reads it:
// `<html lang>`, the article's `inLanguage` and its `og:locale` are the
// site's tag (D66), never two tags on one page.
import { describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

vi.mock("@/lib/account/billing", () => ({
  hostedServingState: async () => ({ serve: true }),
}));

vi.mock("@/lib/locale/site", () => ({
  siteLocale: async () => ({ country: "DE", language: "de" }),
}));

const PAGE = {
  publicationId: "pub-1",
  siteId: "site-1",
  slug: "sauerteigbrot-backen",
  title: "Sauerteigbrot backen",
  bodyMd: "Ein Absatz.",
  description: "Wie ein Sauerteigbrot gelingt.",
  faq: [],
  made: null,
  grounded: null,
  publisher: { name: "Bäckerei Beispiel", category: null, timeZone: "Europe/Berlin" },
  publishedAt: new Date("2026-10-01T09:00:00.000Z"),
  firstPublishedAt: new Date("2026-10-01T09:00:00.000Z"),
  byline: null,
  liveUrl: "https://content.example.com/sauerteigbrot-backen",
  record: {},
};

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
    livePageBySlug: async () => PAGE,
    livePagesForSite: async () => [PAGE],
    hostedIdentity: async () => ({ name: "Bäckerei Beispiel", logoType: null, line: null, mainSite: null }),
    hostedAddress: async () => ({ state: "none", publicationId: null }),
    taggedForHosted: async () => undefined,
  };
});

const { GET } = await import("@/app/(hosted)/hosted-article/[slug]/route");

describe("issue 1514 — one hosted render states one language", () => {
  it("<html lang>, inLanguage and og:locale are the same tag", async () => {
    const request = new Request("https://content.example.com/sauerteigbrot-backen", { headers: { host: "content.example.com" } });
    const markup = await (await GET(request, { params: Promise.resolve({ slug: "sauerteigbrot-backen" }) })).text();

    const lang = /<html[^>]* lang="([^"]+)"/.exec(markup)?.[1];
    const posting = [...markup.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)]
      .map((m) => JSON.parse(m[1]!) as Record<string, unknown>)
      .find((schema) => schema["@type"] === "BlogPosting");
    const ogLocale = /<meta property="og:locale" content="([^"]+)"/.exec(markup)?.[1]?.replace("_", "-");

    expect(lang).toBe("de-DE");
    expect(posting?.inLanguage).toBe(lang);
    expect(ogLocale).toBe(lang);
  });
});
