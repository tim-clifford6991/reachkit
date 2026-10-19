/** @vitest-environment jsdom */
// tests/hosted/indexing/language-agreement.test.tsx — SPEC §7 (2026-10-18), issue 1514
//
// One hosted render states one language everywhere an engine reads it:
// `<html lang>`, the article's `inLanguage` and its `og:locale` are the
// site's tag (D66), never two tags on one page.
//
// **React's `cache` is a per-request memo here, as it is in a server
// render.** The reader's language (`copy/reader.ts`) is held in `cache`,
// which memoises only inside a React Server Components render; outside
// one, as in this process, it calls through and the language said by
// `readIn` is lost. So `cache` is replaced by a memo keyed on its
// arguments, for this file's one render, which is what a request gives it.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  const cache = <A extends unknown[], R>(fn: (...args: A) => R): ((...args: A) => R) => {
    const held = new Map<string, R>();
    return (...args: A) => {
      const key = JSON.stringify(args);
      if (!held.has(key)) held.set(key, fn(...args));
      return held.get(key)!;
    };
  };
  return { ...actual, default: { ...actual, cache }, cache };
});

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ host: "content.example.com" }),
}));

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
  };
});

const HostedPageLayout = (await import("@/app/(hosted)/hosted-page/layout")).default;
const HostedPage = (await import("@/app/(hosted)/hosted-page/[[...slug]]/page")).default;
const { generateMetadata } = await import("@/app/(hosted)/hosted-page/[[...slug]]/page");

describe("issue 1514 — one hosted render states one language", () => {
  it("<html lang>, inLanguage and og:locale are the same tag", async () => {
    const params = Promise.resolve({ slug: ["sauerteigbrot-backen"] });
    const meta = await generateMetadata({ params });
    const markup = renderToStaticMarkup(await HostedPageLayout({ children: await HostedPage({ params }) }));

    const lang = /<html[^>]* lang="([^"]+)"/.exec(markup)?.[1];
    const posting = [...markup.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)]
      .map((m) => JSON.parse(m[1]!) as Record<string, unknown>)
      .find((schema) => schema["@type"] === "BlogPosting");
    const ogLocale = String((meta.openGraph as { locale?: string }).locale).replace("_", "-");

    expect(lang).toBe("de-DE");
    expect(posting?.inLanguage).toBe(lang);
    expect(ogLocale).toBe(lang);
  });
});
