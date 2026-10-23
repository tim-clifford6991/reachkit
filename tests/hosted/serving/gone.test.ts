/** @vitest-environment jsdom */
// Owner R1 (2026-10-22), the seo-master's answer 3 on #1715: what each of the
// four endings of a hosted address answers. A page removed from a live site
// and an unknown address on one carry the short body; a site that is gone
// and a host no site claims carry nothing of the customer's. 0¢.
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

type Serving = { serve: true } | { serve: false; because: "retention_elapsed" | "account_deleted" };
type Locale = { country: string; language: string };

const state: { host: string; serving: Serving; stored: Locale | null } = {
  host: "content.example.com",
  serving: { serve: true },
  stored: null,
};

const OLD_TITLE = "How to winterize outdoor faucets";

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ host: state.host }),
}));

vi.mock("@/lib/account/billing", () => ({
  hostedServingState: async () => state.serving,
}));

vi.mock("@/lib/locale/site", () => ({
  readStoredLocale: async () => state.stored,
  siteLocale: async () => state.stored ?? { country: "US", language: "en" },
}));

vi.mock("@/lib/publish/destinations/hosted", async () => {
  const address = await import("@/lib/publish/destinations/hosted/address");
  return {
    liveUrlFor: address.liveUrlFor,
    liveUrlOnHost: address.liveUrlOnHost,
    hostedHostFor: address.hostedHostFor,
    tags: { site: (s: string) => `hosted:site:${s}`, page: (p: string) => `hosted:page:${p}` },
    retiredSlugsForSite: async () => new Set(["winterize-outdoor-faucets"]),
    hostedSiteForDomain: async (domain: string) =>
      domain === "example.com" ? { siteId: "site-1", domain, host: `content.${domain}` } : null,
    hostedSiteForHostname: async () => null,
    livePageBySlug: async () => null,
    livePagesForSite: async () => [],
    hostedIdentity: async () => ({
      name: "Harbor Plumbing",
      logoType: null,
      line: "Licensed plumbers in Austin, TX.",
      mainSite: {
        home: "https://example.com/",
        organization: { id: null, name: null, logo: null },
        sameAs: [],
        aboutPages: [],
        links: [],
        actions: [
          { kind: "book", url: "https://example.com/book" },
          { kind: "quote", url: "https://example.com/quote" },
        ],
      },
    }),
    hostedAddress: async () => ({ state: "retired", publicationId: null }),
  };
});

const gone = await import("@/app/(hosted)/hosted-gone/route");
const NotFound = (await import("@/app/(hosted)/hosted-page/not-found")).default;
const Page = (await import("@/app/(hosted)/hosted-page/[[...slug]]/page")).default;
const { readingIn } = await import("@/lib/presentation/copy/reader");

beforeEach(() => {
  state.host = "content.example.com";
  state.serving = { serve: true };
  state.stored = null;
});

function request(): Request {
  return new Request("https://content.example.com/winterize-outdoor-faucets", { headers: { host: state.host } });
}

function parse(html: string): Document {
  return new DOMParser().parseFromString(html, "text/html");
}

/** The 404 as a request draws it: the page throws, and the route's not-found screen is the body. */
async function notFoundPage(slug: string): Promise<{ thrown: unknown; doc: Document }> {
  const thrown = await Page({ params: Promise.resolve({ slug: [slug] }) }).then(
    () => null,
    (error: unknown) => error
  );
  const html = await readingIn(async () => renderToStaticMarkup(await NotFound()));
  return { thrown, doc: parse(`<!doctype html><html><head></head><body>${html}</body></html>`) };
}

/** Variant A, whichever route drew it. */
function expectVariantA(doc: Document, words: { heading: string; line: string; index: string }): void {
  expect(doc.querySelector("header")?.textContent).toContain("Harbor Plumbing");
  expect(doc.querySelector('header a[href="https://example.com/"]')).not.toBeNull();
  expect(doc.querySelectorAll("h1")).toHaveLength(1);
  expect(doc.querySelector("h1")?.textContent).toBe(words.heading);
  expect(doc.body.textContent).toContain(words.line);
  const index = [...doc.querySelectorAll("a")].find((a) => a.textContent === words.index);
  expect(index?.getAttribute("href")).toBe("/");
  // The business block as it ships: the about card with the main site's own book and quote pages.
  const card = doc.querySelector("aside");
  expect(card?.querySelector('a[href="https://example.com/book"]')).not.toBeNull();
  expect(card?.querySelector('a[href="https://example.com/quote"]')).not.toBeNull();
  expect(doc.querySelector('meta[name="robots"]')?.getAttribute("content")).toBe("noindex");
  expect(doc.documentElement.outerHTML).not.toContain(OLD_TITLE);
  expect(doc.querySelector('script[type="application/ld+json"]')).toBeNull();
  expect(doc.documentElement.outerHTML.toLowerCase()).not.toContain("reachkit");
}

const ENGLISH = {
  heading: "This page is no longer available",
  line: "Harbor Plumbing has removed this guide.",
  index: "Browse all guides",
};

describe("A: a page removed from a live site answers 410 with the short body", () => {
  it("410, noindex, no-store, no Location, in the site's language, with the header, the words and the business block", async () => {
    const response = await gone.GET(request());
    expect(response.status).toBe(410);
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Location")).toBeNull();
    const doc = parse(await response.text());
    expect(doc.documentElement.getAttribute("lang")).toBe("en-US");
    expect(doc.title).toBe("content.example.com");
    expectVariantA(doc, ENGLISH);
  });
});

describe("B: an unknown address on a live site answers 404 with the same body", () => {
  it("the page answers not found, and the not-found screen is variant A with noindex", async () => {
    const { thrown, doc } = await notFoundPage("never-a-page");
    expect((thrown as { digest?: string } | null)?.digest).toBe("NEXT_HTTP_ERROR_FALLBACK;404");
    expectVariantA(doc, ENGLISH);
  });
});

describe("C: a site that is gone answers 410 with the empty document", () => {
  it("access ended: empty body, lang from the stored locale", async () => {
    state.serving = { serve: false, because: "retention_elapsed" };
    state.stored = { country: "DE", language: "de" };
    const response = await gone.GET(request());
    expect(response.status).toBe(410);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Location")).toBeNull();
    const doc = parse(await response.text());
    expect(doc.documentElement.getAttribute("lang")).toBe("de-DE");
    expect(doc.body.innerHTML).toBe("");
  });

  it("account deleted with no stored locale: empty body and no lang at all", async () => {
    state.serving = { serve: false, because: "account_deleted" };
    const response = await gone.GET(request());
    expect(response.status).toBe(410);
    const doc = parse(await response.text());
    expect(doc.documentElement.hasAttribute("lang")).toBe(false);
    expect(doc.body.innerHTML).toBe("");
  });
});

describe("D: a host no site claims answers 404 with nothing", () => {
  it("the not-found screen is empty", async () => {
    state.host = "content.stranger.example";
    const { thrown, doc } = await notFoundPage("anything");
    expect((thrown as { digest?: string } | null)?.digest).toBe("NEXT_HTTP_ERROR_FALLBACK;404");
    expect(doc.body.textContent?.trim()).toBe("");
    expect(doc.querySelector("a")).toBeNull();
  });
});

describe("E: variant A is in the site's language", () => {
  const GERMAN = {
    heading: "Diese Seite ist nicht mehr verfügbar",
    line: "Harbor Plumbing hat diesen Ratgeber entfernt.",
    index: "Alle Ratgeber ansehen",
  };

  it("a German site's 410 reads in German, under lang de-DE", async () => {
    state.stored = { country: "DE", language: "de" };
    const doc = parse(await (await gone.GET(request())).text());
    expect(doc.documentElement.getAttribute("lang")).toBe("de-DE");
    expectVariantA(doc, GERMAN);
  });

  it("a German site's 404 reads in German", async () => {
    state.stored = { country: "DE", language: "de" };
    expectVariantA((await notFoundPage("nie-eine-seite")).doc, GERMAN);
  });
});
