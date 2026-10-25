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

const state: { host: string; serving: Serving; stored: Locale | null; identityFails: boolean; live: unknown[] } = {
  host: "content.example.com",
  serving: { serve: true },
  stored: null,
  identityFails: false,
  live: [],
};

const OLD_TITLE = "How to winterize outdoor faucets";

// The hosted routes' server bundle as production builds it: lucide's `Icon` is a
// client module there, so calling any icon throws instead of drawing.
vi.mock("lucide-react", async (importOriginal) => {
  const real = await importOriginal<Record<string, unknown>>();
  return Object.fromEntries(
    Object.keys(real).map((name) => [
      name,
      () => {
        throw new Error(`Attempted to call ${name} from the server, but it's on the client.`);
      },
    ])
  );
});

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
    livePagesForSite: async () => state.live,
    taggedForHosted: async () => undefined,
    hostedIdentity: async () => {
      if (state.identityFails) throw new Error("identity read failed");
      return {
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
          phone: "(512) 555-0142",
        },
        offer: { category: "a plumber", place: "Austin", region: "TX" },
      };
    },
    hostedAddress: async () => ({ state: "retired", publicationId: null }),
  };
});

const gone = await import("@/app/(hosted)/hosted-gone/route");
const NotFound = (await import("@/app/(hosted)/hosted-page/not-found")).default;
const Page = (await import("@/app/(hosted)/hosted-page/[[...slug]]/page")).default;
const cached = await import("@/app/(hosted)/hosted-live/[host]/[slug]/route");
const article = await import("@/app/(hosted)/hosted-article/[slug]/route");
const { readingIn } = await import("@/lib/presentation/copy/reader");

beforeEach(() => {
  state.host = "content.example.com";
  state.serving = { serve: true };
  state.stored = null;
  state.identityFails = false;
  state.live = [];
});

function request(language?: string): Request {
  const headers: Record<string, string> = { host: state.host, ...(language === undefined ? {} : { "accept-language": language }) };
  return new Request("https://content.example.com/winterize-outdoor-faucets", { headers });
}

function parse(html: string): Document {
  return new DOMParser().parseFromString(html, "text/html");
}

/** The 404 of an address that could name a page, as the article's uncached route answers it. */
async function notFoundPage(slug: string): Promise<{ status: number; doc: Document }> {
  const response = await article.GET(new Request(`https://${state.host}/${slug}`, { headers: { host: state.host } }), {
    params: Promise.resolve({ slug }),
  });
  return { status: response.status, doc: parse(await response.text()) };
}

/** The 404 of a deeper path, which the catch-all answers with its not-found screen. */
async function deeperNotFound(): Promise<{ thrown: unknown; doc: Document }> {
  const thrown = await Page({ params: Promise.resolve({ slug: ["a", "b"] }) }).then(
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
    // The stored phone is the primary action, drawn without lucide's client Icon.
    expect(doc.querySelector('header a[href="tel:5125550142"]')?.textContent).toBe("(512) 555-0142");
    expect(doc.querySelector('aside a[href="tel:5125550142"]')?.textContent).toBe("Call (512) 555-0142");
  });
});

describe("A: the 410 is styled by the site's own sheet", () => {
  it("links /style.css once and preloads at most two faces from the same host", async () => {
    const doc = parse(await (await gone.GET(request())).text());
    const sheets = doc.querySelectorAll('link[rel="stylesheet"]');
    expect(sheets).toHaveLength(1);
    expect(sheets[0]?.getAttribute("href")).toBe("/style.css");
    const preloads = [...doc.querySelectorAll('link[rel="preload"]')];
    expect(preloads.length).toBeGreaterThan(0);
    expect(preloads.length).toBeLessThanOrEqual(2);
    for (const link of preloads) {
      expect(link.getAttribute("as")).toBe("font");
      expect(link.getAttribute("href")).toMatch(/^\/font\/[^/]+\.woff2$/);
    }
    expect(doc.querySelector("script")).toBeNull();
  });
});

describe("A: the short body draws lucide's glyphs without its client Icon", () => {
  it("gone draws file-x and list", async () => {
    const response = await gone.GET(request());
    expect(response.status).toBe(410);
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const main = parse(await response.text()).querySelector("main")!;
    const head = main.querySelector("svg.lucide-file-x");
    expect(head?.compareDocumentPosition(main.querySelector("h1")!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    const index = [...main.querySelectorAll("a")].find((a) => a.textContent === ENGLISH.index);
    expect(index?.querySelector("svg.lucide-list")?.getAttribute("aria-hidden")).toBe("true");
  });
});

describe("the cached article draws its glyphs without lucide's client Icon", () => {
  it("an offering page answers 200 with the header's call and the places' pins", async () => {
    const at = new Date("2026-10-19T11:00:00.000Z");
    const liveUrl = "https://content.example.com/emergency-plumber-austin";
    state.live = [
      {
        publicationId: "pub-2",
        siteId: "site-1",
        slug: "emergency-plumber-austin",
        title: "Emergency plumber in Austin",
        heading: null,
        bodyMd: "## Where and when\n\n- Austin\n- Round Rock",
        description: null,
        faq: [],
        grounded: null,
        made: null,
        publisher: { name: "example.com", category: null, timeZone: "UTC" },
        byline: null,
        offering: true,
        whereWhen: "Where and when",
        businessFit: 3,
        publishedAt: at,
        firstPublishedAt: at,
        liveUrl,
        record: { opportunityId: "opp-1", targetQuery: "emergency plumber austin", measuredOn: at, mode: "autopilot", liveUrl },
      },
    ];
    const params = Promise.resolve({ host: "content.example.com", slug: "emergency-plumber-austin" });
    const response = await cached.GET(new Request(liveUrl), { params });
    expect(response.status).toBe(200);
    const doc = parse(await response.text());
    expect(doc.querySelectorAll("main svg.lucide-map-pin").length).toBeGreaterThanOrEqual(2);
    expect(doc.querySelector('header a[href^="tel:"] svg')).not.toBeNull();
  });
});

describe("A: a body that cannot be drawn still answers 410, never 500", () => {
  it("410, noindex, no-store and the empty document in the site's language", async () => {
    state.identityFails = true;
    state.stored = { country: "DE", language: "de" };
    const response = await gone.GET(request());
    expect(response.status).toBe(410);
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const doc = parse(await response.text());
    expect(doc.documentElement.getAttribute("lang")).toBe("de-DE");
    expect(doc.querySelector('meta[name="robots"]')?.getAttribute("content")).toBe("noindex");
    expect(doc.body.innerHTML).toBe("");
  });
});

describe("B: an unknown address on a live site answers 404 with the same body", () => {
  it("the article's route answers 404 with variant A under noindex", async () => {
    const { status, doc } = await notFoundPage("never-a-page");
    expect(status).toBe(404);
    expectVariantA(doc, ENGLISH);
  });

  it("a deeper path answers not found, and the not-found screen is variant A with noindex", async () => {
    const { thrown, doc } = await deeperNotFound();
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
    const { status, doc } = await notFoundPage("anything");
    expect(status).toBe(404);
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

describe("E10: the 410's business block names the place its market stores, in the site's language only", () => {
  it("an English site's block says Serves Austin, TX. after lucide's pin", async () => {
    const doc = parse(await (await gone.GET(request())).text());
    const pin = doc.querySelector("aside svg.lucide-map-pin");
    expect(pin?.getAttribute("aria-hidden")).toBe("true");
    expect(pin?.parentElement?.textContent).toBe("Serves Austin, TX.");
  });

  it("a German site's 410 is byte-identical for Accept-Language en, de and none, and reads in German", async () => {
    state.stored = { country: "DE", language: "de" };
    const [none, en, de] = await Promise.all([undefined, "en-US,en;q=0.9", "de-DE,de;q=0.9"].map(async (language) => (await gone.GET(request(language))).text()));
    expect(en).toBe(none);
    expect(de).toBe(none);
    const doc = parse(none!);
    expect(doc.documentElement.getAttribute("lang")).toBe("de-DE");
    expect(doc.querySelector("aside svg.lucide-map-pin")?.parentElement?.textContent).toBe("Vor Ort in Austin, TX.");
  });

  it("an English site's 410 is byte-identical whatever the reader's language", async () => {
    const [none, de] = await Promise.all([undefined, "de-DE,de;q=0.9"].map(async (language) => (await gone.GET(request(language))).text()));
    expect(de).toBe(none);
    expect(none).toContain("Serves Austin, TX.");
  });
});
