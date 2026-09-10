// Issue #326 — every public route says something about itself.
// tests/app/seo/metadata.test.tsx
//
// The Done-when is "a test asserts every public route has non-empty
// metadata", and the word doing the work is *every*. So the list is not
// written down here: it is walked off `src/app/(public)/` the way
// `tests/app/middleware.test.ts` walks the same tree for its allow-list,
// and a new public route with no `<head>` fails this file without anybody
// remembering to add a row.
//
// The metadata itself is read from the module that actually exports it
// rather than re-derived: for eight routes that is a `metadata` export, for
// `/scan/{domain}` a `generateMetadata`, and for `/signin` the segment
// layout, because the screen is a Client Component and Next reads metadata
// only from a Server Component. `OWNER` below is the one place that
// mapping lives, and the walk checks it is total.
//
// `tests/app/**` runs under the `node` project, so nothing here renders —
// every assertion is on an exported object, on a module's own source, or
// on a pure function.
import { readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Metadata } from "next";
import { applyEnvFixture, ENV_FIXTURE } from "../../mail/env-fixture";

applyEnvFixture();

const REPO_ROOT = path.resolve(import.meta.dirname, "../../..");
const PUBLIC_DIR = path.join(REPO_ROOT, "src/app/(public)");
const ORIGIN = ENV_FIXTURE.NEXT_PUBLIC_APP_URL;
if (ORIGIN === undefined) throw new Error("the env fixture binds no NEXT_PUBLIC_APP_URL");

/** `Metadata["openGraph"]` and `Metadata["twitter"]` are discriminated
 *  unions keyed on the very fields asserted below, so the discriminant is
 *  not readable off the union itself. Read as the two records they are —
 *  what is under test is the object the route ships, not Next's typing of
 *  it. */
const og = (meta: Metadata): Record<string, unknown> =>
  (meta.openGraph ?? {}) as Record<string, unknown>;
const tw = (meta: Metadata): Record<string, unknown> =>
  (meta.twitter ?? {}) as Record<string, unknown>;

const { PUBLIC_ROUTE_SEO, PUBLIC_ROUTE_SEO_ROWS, sitemapPaths } = await import(
  "@/app/(public)/_seo/routes"
);
const { COPY, AWAITING_COPY } = await import("@/lib/presentation/copy/registry");

type Row = (typeof PUBLIC_ROUTE_SEO_ROWS)[number];

/**
 * Every route pattern under `(public)` that renders a document, walked off
 * disk.
 *
 * `route.ts` files are deliberately excluded and `/signin/{token}` is the
 * only one: it redeems a link and redirects, so it has no `<head>` to
 * fill. `_`-prefixed directories are internals, the same rule the
 * middleware walk applies.
 */
function publicRoutePatterns(dir: string, prefix = ""): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isFile() && /^page\.tsx?$/.test(entry.name)) {
      found.push(prefix === "" ? "/" : prefix);
      continue;
    }
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith("_")) continue;
    const segment = entry.name.startsWith("(")
      ? ""
      : `/${entry.name.replace(/^\[(.+)\]$/, "{$1}")}`;
    found.push(...publicRoutePatterns(path.join(dir, entry.name), `${prefix}${segment}`));
  }
  return found;
}

/** Which module Next reads each route's `<head>` from, and how. */
const OWNER: Readonly<Record<string, { module: string; generated?: true }>> = {
  "/": { module: "@/app/(public)/page" },
  "/pricing": { module: "@/app/(public)/pricing/page" },
  "/privacy": { module: "@/app/(public)/privacy/page" },
  "/terms": { module: "@/app/(public)/terms/page" },
  "/imprint": { module: "@/app/(public)/imprint/page" },
  // The screen is a Client Component; its metadata is the segment layout's.
  "/signin": { module: "@/app/(public)/signin/layout" },
  "/scan/{domain}": { module: "@/app/(public)/scan/[domain]/page", generated: true },
  "/veto/{token}": { module: "@/app/(public)/veto/[token]/page" },
  "/opt-out/{token}": { module: "@/app/(public)/opt-out/[token]/page" },
};

/** The `<head>` a route actually ships, from the module that exports it. */
async function metadataOf(route: string): Promise<Metadata> {
  const owner = OWNER[route];
  if (owner === undefined) throw new Error(`no OWNER row for ${route}`);
  const mod = (await import(owner.module)) as {
    metadata?: Metadata;
    generateMetadata?: (a: { params: Promise<Record<string, string>> }) => Promise<Metadata>;
  };
  if (owner.generated === true) {
    if (mod.generateMetadata === undefined) throw new Error(`${route} exports no generateMetadata`);
    return await mod.generateMetadata({ params: Promise.resolve({ domain: "example.com" }) });
  }
  if (mod.metadata === undefined) throw new Error(`${route} exports no metadata`);
  return mod.metadata;
}

const rowFor = (route: string): Row | undefined =>
  PUBLIC_ROUTE_SEO_ROWS.find((r) => r.route === route);

const nonEmpty = (value: unknown): boolean => typeof value === "string" && value.trim().length > 0;

describe("the route table covers the tree, and nothing else", () => {
  const walked = publicRoutePatterns(PUBLIC_DIR).sort();

  it("the group is actually walked — a rule over nothing is not a rule", () => {
    expect(walked.length).toBeGreaterThan(5);
    expect(walked).toContain("/");
    expect(walked).toContain("/scan/{domain}");
  });

  it("every public route on disk has a row in _seo/routes.ts", () => {
    const missing = walked.filter((route) => rowFor(route) === undefined);
    expect(missing, `public routes with no _seo/routes.ts row: ${missing.join(", ")}`).toEqual([]);
  });

  it("every row in _seo/routes.ts is a route on disk", () => {
    const orphans = PUBLIC_ROUTE_SEO_ROWS.map((r) => r.route).filter(
      (route) => !walked.includes(route)
    );
    expect(orphans, `rows naming no route: ${orphans.join(", ")}`).toEqual([]);
  });

  it("every public route on disk names the module its <head> comes from", () => {
    expect(Object.keys(OWNER).sort()).toEqual(walked);
  });
});

describe("issue #326 — every public route exports non-empty metadata", () => {
  for (const route of Object.keys(OWNER)) {
    it(`${route} carries a title, a description, Open Graph and a Twitter card`, async () => {
      const meta = await metadataOf(route);

      expect(nonEmpty(meta.title), "title").toBe(true);
      expect(nonEmpty(meta.description), "description").toBe(true);

      expect(meta.openGraph, "openGraph").toBeDefined();
      expect(og(meta).type).toBe("website");
      expect(nonEmpty(og(meta).title), "og:title").toBe(true);
      expect(nonEmpty(og(meta).description), "og:description").toBe(true);
      expect(nonEmpty(og(meta).siteName), "og:site_name").toBe(true);

      expect(tw(meta).card).toBe("summary_large_image");
      expect(nonEmpty(tw(meta).title), "twitter:title").toBe(true);
      expect(nonEmpty(tw(meta).description), "twitter:description").toBe(true);

      // Every relative metadata URL — the generated share images are the
      // ones that matter — resolves against this, or Next falls back to
      // localhost in production and the og:image points nowhere.
      expect(String(meta.metadataBase)).toBe(`${ORIGIN}/`);
    });
  }
});

describe("the canonical address is the address, and never a pattern", () => {
  const ADDRESSED: Readonly<Record<string, string>> = {
    "/": "/",
    "/pricing": "/pricing",
    "/privacy": "/privacy",
    "/terms": "/terms",
    "/imprint": "/imprint",
    "/signin": "/signin",
    // `generateMetadata` is asked for `example.com` above.
    "/scan/{domain}": "/scan/example.com",
  };

  for (const [route, address] of Object.entries(ADDRESSED)) {
    it(`${route} declares ${address} as its canonical, and says so twice`, async () => {
      const meta = await metadataOf(route);
      const expected = new URL(address, ORIGIN).toString();
      expect(meta.alternates?.canonical).toBe(expected);
      expect(og(meta).url).toBe(expected);
    });
  }

  // The path *is* the credential on both of these: a `<link rel="canonical">`
  // would restate the stop link inside the document, and there is no one URL
  // a single-use address should be indexed under in any case.
  for (const route of ["/veto/{token}", "/opt-out/{token}"]) {
    it(`${route} declares no canonical — the path is the credential`, async () => {
      const meta = await metadataOf(route);
      expect(meta.alternates).toBeUndefined();
      expect(og(meta).url).toBeUndefined();
    });
  }

  it("a report segment that does not parse gets no canonical either (REQ-001 c4)", async () => {
    const { generateMetadata } = await import("@/app/(public)/scan/[domain]/page");
    const meta = await generateMetadata({ params: Promise.resolve({ domain: "not a domain" }) });
    expect(meta.alternates).toBeUndefined();
  });

  it("the report's canonical is the canonical domain, not the segment as written (ADR-020)", async () => {
    const { generateMetadata } = await import("@/app/(public)/scan/[domain]/page");
    const meta = await generateMetadata({ params: Promise.resolve({ domain: "WWW.Example.COM" }) });
    expect(meta.alternates?.canonical).toBe(`${ORIGIN}/scan/example.com`);
  });
});

describe("indexing is one fact, read by the page and by the sitemap", () => {
  it("every row the table calls indexable carries no robots directive", async () => {
    for (const row of PUBLIC_ROUTE_SEO_ROWS.filter((r) => r.indexable)) {
      const meta = await metadataOf(row.route);
      expect(meta.robots, row.route).toBeUndefined();
    }
  });

  it("every row the table refuses carries index: false and follow: false", async () => {
    const refused = PUBLIC_ROUTE_SEO_ROWS.filter((r) => !r.indexable);
    // ADR-002 · REQ-001 c8 for the report, issue #144's reasoning for the
    // two token paths, and S9 for the sign-in form.
    expect(refused.map((r) => r.route).sort()).toEqual([
      "/opt-out/{token}",
      "/scan/{domain}",
      "/signin",
      "/veto/{token}",
    ]);
    for (const row of refused) {
      const meta = await metadataOf(row.route);
      expect(meta.robots, row.route).toEqual({ index: false, follow: false });
    }
  });

  it("the sitemap names exactly the indexable rows with no {param} in them", () => {
    expect([...sitemapPaths()]).toEqual(
      PUBLIC_ROUTE_SEO_ROWS.filter((r) => r.indexable && !r.route.includes("{")).map((r) => r.route)
    );
  });

  it("no report address is in it (ADR-002 decision 1 · REQ-001 c8)", () => {
    expect(sitemapPaths().some((route) => route.startsWith("/scan"))).toBe(false);
  });
});

describe("every sentence in a public <head> is a key, and the owner is told which", () => {
  it("every title and description is a meta.* key that exists in the registry", () => {
    for (const row of PUBLIC_ROUTE_SEO_ROWS) {
      for (const key of [row.title, row.description]) {
        expect(key.startsWith("meta."), `${row.route}: ${key}`).toBe(true);
        expect(Object.keys(COPY), `${row.route}: ${key}`).toContain(key);
      }
    }
  });

  it("all of them are owner-owed and carry the marker, none is drafted", () => {
    // Rule 5.5: stated and counted. No approved artifact writes a document
    // title, so ruling 11a fills none of these — every one is awaiting the
    // owner's pen and renders the marker rather than a suggestion.
    const keys = PUBLIC_ROUTE_SEO_ROWS.flatMap((row) => [row.title, row.description]);
    expect(keys).toHaveLength(18);
    for (const key of keys) expect(AWAITING_COPY, key).toContain(key);
  });

  it("the share images' alt text is owed the same way, and the site name is not owed at all", () => {
    for (const key of ["meta.og.alt", "meta.report.og.alt"] as const) {
      expect(AWAITING_COPY, key).toContain(key);
    }
    // `og:site_name` and the manifest's name are `chrome.wordmark`, which
    // ruling 11a approved as written — one home for one word.
    expect(COPY["chrome.wordmark"]).toBe("ReachKit");
  });
});

describe("the favicon set and the manifest ship, and no file is owed to the owner", () => {
  const GENERATED = [
    "src/app/(public)/icon.tsx",
    "src/app/(public)/apple-icon.tsx",
    "src/app/(public)/opengraph-image.tsx",
    "src/app/(public)/scan/[domain]/opengraph-image.tsx",
    "src/app/manifest.ts",
  ];

  for (const file of GENERATED) {
    it(`${file} exists`, () => {
      expect(existsSync(path.join(REPO_ROOT, file))).toBe(true);
    });
  }

  it("every one of them is drawn from code, so no owner-supplied asset is needed", () => {
    // The Done-when's "no owner files": the mark is the wordmark chip —
    // `--accent` in a pill — and it is rendered rather than committed, so
    // the colour has one home (`src/ui/theme.css`, through the resolved
    // table) instead of being baked into bytes no check can read.
    expect(existsSync(path.join(REPO_ROOT, "public"))).toBe(false);
  });

  it("the two icons declare the size a browser asks each of them for", async () => {
    const icon = (await import("@/app/(public)/icon")) as { size: { width: number } };
    const apple = (await import("@/app/(public)/apple-icon")) as { size: { width: number } };
    expect(icon.size.width).toBe(32);
    expect(apple.size.width).toBe(180);
  });

  it("both share images declare the Open Graph canvas, a type and non-empty alt text", async () => {
    for (const specifier of [
      "@/app/(public)/opengraph-image",
      "@/app/(public)/scan/[domain]/opengraph-image",
    ]) {
      const mod = (await import(specifier)) as {
        alt: string;
        size: { width: number; height: number };
        contentType: string;
      };
      expect(mod.size, specifier).toEqual({ width: 1200, height: 630 });
      expect(mod.contentType, specifier).toBe("image/png");
      expect(nonEmpty(mod.alt), specifier).toBe(true);
    }
  });

  it("the manifest speaks in copy keys and tokens, not literals", async () => {
    const { default: manifest } = (await import("@/app/manifest")) as {
      default: () => { name?: string; theme_color?: string; start_url?: string };
    };
    const document = manifest();
    expect(document.name).toBe(COPY["chrome.wordmark"]);
    expect(document.start_url).toBe("/");
    const { token } = await import("@/lib/mail/shell/tokens");
    expect(document.theme_color).toBe(token("--accent"));
  });
});

describe("the two indexing documents the app host serves", () => {
  it("robots allows the whole site and names the sitemap, with no Disallow", async () => {
    const { appRobotsDocument } = await import("@/app/(public)/_seo/policies");
    const document = appRobotsDocument(`${ORIGIN}/sitemap.xml`);
    expect(document).toContain("User-agent: *\nAllow: /");
    expect(document).toContain(`Sitemap: ${ORIGIN}/sitemap.xml`);
    expect(document).not.toContain("Disallow");
  });

  it("the sitemap is well-formed and holds one entry per indexable route", async () => {
    const { appSitemapDocument } = await import("@/app/(public)/_seo/policies");
    const document = appSitemapDocument(ORIGIN);
    expect(document.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(document).toContain("<urlset");
    const locs = [...document.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(locs).toEqual(sitemapPaths().map((route) => new URL(route, ORIGIN).toString()));
  });
});

describe("the table is the one home for the flag", () => {
  it("no public page writes its own robots directive any more", async () => {
    const { readFileSync } = await import("node:fs");
    for (const [route, owner] of Object.entries(OWNER)) {
      const file = path.join(REPO_ROOT, `${owner.module.replace("@/", "src/")}.tsx`);
      const source = readFileSync(file, "utf8");
      const code = source.slice(source.indexOf("import "));
      expect(code.includes("robots:"), `${route} writes its own robots directive`).toBe(false);
    }
    // And the row that carries it instead is a real one.
    expect(PUBLIC_ROUTE_SEO.report.indexable).toBe(false);
  });
});
