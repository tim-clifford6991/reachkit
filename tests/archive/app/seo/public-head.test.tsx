// Issue 1512 — what reachkit.app's own heads say: a share image on every
// indexable route, the brand once in each title, the Organization and
// WebSite on the landing, an Article and its breadcrumb on each library
// page that restate the dates the page prints, and a title on the 404.
//
// The routes are walked off `PUBLIC_ROUTE_SEO`, so a new indexable row is
// held here without a line being added.
import "../../generate/env";
import { describe, expect, it, vi } from "vitest";
import type React from "react";
import type { Metadata } from "next";
import { renderToStaticMarkup } from "react-dom/server";
import { settledMarkup } from "../shell/settled";

// The landing's two reads are rows; neither is what this file asks about.
vi.mock("@/lib/scan/gallery", () => ({ readRecent: async () => [] }));
vi.mock("@/app/(public)/_chrome/own-articles", () => ({ readOwnArticles: async () => null, LATEST_SHOWN: 3 }));
// `@vercel/og` loads its renderer over `fetch`, which no test here may make.
// The stand-in keeps what the route hands it; that the live card answers
// 200 `image/png` is the pull request's curl.
vi.mock("next/og", () => ({
  ImageResponse: class extends Response {
    readonly options: { width: number; height: number };
    constructor(_element: unknown, options: { width: number; height: number }) {
      super(null, { status: 200, headers: { "content-type": "image/png" } });
      this.options = options;
    }
  },
}));

const { PUBLIC_ROUTE_SEO_ROWS } = await import("@/app/(public)/_seo/routes");
const { ANSWERS, COMPARISONS, TEARDOWNS, longDate } = await import("@/app/(public)/_library");
const { ORGANIZATION_ID } = await import("@/app/(public)/_seo/structured");
const { organizationIdOf } = await import("@/app/(hosted)/hosted-page/[[...slug]]/seo");
const { COPY } = await import("@/lib/presentation/copy");
const { GET: shareCard } = await import("@/app/(public)/share-card/route");
const groupCard = await import("@/app/(public)/opengraph-image");
const { OG_SIZE } = await import("@/app/(public)/_seo/og-card");

type Row = (typeof PUBLIC_ROUTE_SEO_ROWS)[number];
type PageModule = {
  default: (props: never) => Promise<React.JSX.Element> | React.JSX.Element;
  metadata?: Metadata;
  generateMetadata?: (props: { params: Promise<Record<string, string>> }) => Promise<Metadata>;
};

const WORDMARK = COPY["chrome.wordmark"];

/** The page module a row's route is served from. */
async function moduleOf(route: string): Promise<PageModule> {
  const dir = route === "/" ? "" : route.replace(/\{(\w+)\}/g, "[$1]");
  return (await import(/* @vite-ignore */ `@/app/(public)${dir}/page`)) as PageModule;
}

/** The params an address fills a row's pattern with. */
function paramsOf(route: string, address: string): Record<string, string> {
  const names = [...route.matchAll(/\{(\w+)\}/g)].map((m) => m[1] as string);
  const values = address.split("/").slice(route.split("/").length - names.length);
  return Object.fromEntries(names.map((name, i) => [name, decodeURIComponent(values[i] ?? "")]));
}

/** Every indexable address, with the head its route ships for it. */
async function indexableHeads(): Promise<{ address: string; meta: Metadata }[]> {
  const rows = PUBLIC_ROUTE_SEO_ROWS.filter((row: Row) => row.indexable);
  const heads: { address: string; meta: Metadata }[] = [];
  for (const row of rows) {
    const mod = await moduleOf(row.route);
    const addresses = row.route.includes("{") ? (row.addresses?.() ?? []) : [row.route];
    for (const address of addresses) {
      const meta =
        mod.generateMetadata !== undefined
          ? await mod.generateMetadata({ params: Promise.resolve(paramsOf(row.route, address)) })
          : (mod.metadata ?? {});
      heads.push({ address, meta });
    }
  }
  return heads;
}

const og = (meta: Metadata): Record<string, unknown> => (meta.openGraph ?? {}) as Record<string, unknown>;

function imagesOf(meta: Metadata): { url: string | URL }[] {
  const images = og(meta).images;
  if (images === undefined) return [];
  return (Array.isArray(images) ? images : [images]).map((image) =>
    typeof image === "string" || image instanceof URL ? { url: image } : (image as { url: string | URL })
  );
}

/** Every JSON-LD block in a piece of markup. */
function blocksIn(html: string): Record<string, unknown>[] {
  return [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map(
    (m) => JSON.parse(m[1] as string) as Record<string, unknown>
  );
}

/** The markup with every script and tag taken out: what a reader sees. */
function visibleText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");
}

describe("every indexable public route has a share image (issue 1512, A1)", () => {
  it("each head names an og:image, and the card it names answers 200 image/png at 1200×630", async () => {
    const heads = await indexableHeads();
    expect(heads.length).toBeGreaterThan(30);
    const named = new Set<string>();
    for (const { address, meta } of heads) {
      const images = imagesOf(meta);
      expect(images.length, address).toBeGreaterThan(0);
      for (const image of images) named.add(String(image.url));
    }
    // One fixed address for the whole group, and it is the card route.
    expect([...named]).toEqual(["/share-card"]);
    const response = shareCard() as Response & { options: { width: number; height: number } };
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(groupCard.contentType).toBe("image/png");
    expect({ width: response.options.width, height: response.options.height }).toEqual({ width: 1200, height: 630 });
    expect(groupCard.size).toEqual(OG_SIZE);
  });

  it("a title names the brand once", async () => {
    for (const { address, meta } of await indexableHeads()) {
      const title = String(meta.title);
      expect(title.split(WORDMARK).length - 1, `${address}: ${title}`).toBe(1);
    }
  });
});

describe("the landing states ReachKit's Organization and WebSite (issue 1512)", () => {
  it("both blocks, with the @id a hosted page of reachkit.app names as its publisher", async () => {
    const { default: LandingPage } = await import("@/app/(public)/page");
    const html = await settledMarkup(<LandingPage />);
    const blocks = blocksIn(html);
    const organization = blocks.find((b) => b["@type"] === "Organization");
    const website = blocks.find((b) => b["@type"] === "WebSite");
    expect(organization?.["@id"]).toBe("https://reachkit.app/#organization");
    // Issue 1511's composer, for ReachKit's own site with no declared @id.
    const hosted = organizationIdOf({ domain: "reachkit.app", mainSite: null } as Parameters<typeof organizationIdOf>[0]);
    expect(organization?.["@id"]).toBe(hosted);
    expect(organization?.name).toBe(WORDMARK);
    expect(organization).not.toHaveProperty("sameAs");
    expect(website?.publisher).toEqual({ "@id": ORGANIZATION_ID });
    expect(website?.name).toBe(WORDMARK);
  });
});

describe("a library page's Article states the dates it prints (issue 1512, A2)", () => {
  const pages: { path: string; render: () => Promise<React.JSX.Element> }[] = [
    ...COMPARISONS.map((c) => ({
      path: `/compare/${c.slug}`,
      render: async () => (await moduleOf("/compare/{tool}")).default({ params: Promise.resolve({ tool: c.slug }) } as never),
    })),
    ...TEARDOWNS.map((t) => ({
      path: `/teardowns/${t.slug}`,
      render: async () => (await moduleOf("/teardowns/{site}")).default({ params: Promise.resolve({ site: t.slug }) } as never),
    })),
    ...ANSWERS.map((a) => ({
      path: `/answers/${a.slug}`,
      render: async () =>
        (await moduleOf("/answers/{question}")).default({ params: Promise.resolve({ question: a.slug }) } as never),
    })),
  ];

  for (const page of pages) {
    it(`${page.path}: headline, dates and publisher match the page`, async () => {
      const html = renderToStaticMarkup(await page.render());
      const text = visibleText(html);
      const blocks = blocksIn(html);
      const article = blocks.find((b) => b["@type"] === "Article");
      const crumbs = blocks.find((b) => b["@type"] === "BreadcrumbList");
      expect(article, page.path).toBeDefined();
      const h1 = /<h1[^>]*>(.*?)<\/h1>/.exec(html)?.[1];
      expect(article?.headline).toBe(h1);
      for (const field of ["datePublished", "dateModified"] as const) {
        const date = article?.[field];
        if (field === "dateModified") expect(date, page.path).toBeDefined();
        if (date !== undefined) expect(text, `${page.path} ${field}`).toContain(longDate(String(date)));
      }
      expect((article?.publisher as Record<string, unknown>)["@id"]).toBe(ORGANIZATION_ID);
      expect(article).not.toHaveProperty("description");
      const items = crumbs?.itemListElement as { name: string; item: string }[];
      expect(items[0]?.name).toBe(WORDMARK);
      expect(items.at(-1)).toEqual({ "@type": "ListItem", position: items.length, name: h1, item: expect.stringMatching(new RegExp(`${page.path}$`)) });
    });
  }
});

describe("the 404 has a title (issue 1512)", () => {
  it("the screen names its own <title>", async () => {
    const { default: PublicNotFound } = await import("@/app/(public)/not-found");
    const html = renderToStaticMarkup(<PublicNotFound />);
    expect(html).toContain(`<title>${COPY["meta.notfound.title"]}</title>`);
  });
});
