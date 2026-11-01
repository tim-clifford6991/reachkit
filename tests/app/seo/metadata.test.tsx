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
import { readdirSync, existsSync, readFileSync } from "node:fs";
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
const OWNER: Readonly<Record<string, { module: string; generated?: Record<string, string> }>> = {
  "/": { module: "@/app/(public)/page" },
  "/pricing": { module: "@/app/(public)/pricing/page" },
  "/scans": { module: "@/app/(public)/scans/page" },
  "/how-it-works": { module: "@/app/(public)/how-it-works/page" },
  "/about": { module: "@/app/(public)/about/page" },
  "/privacy": { module: "@/app/(public)/privacy/page" },
  "/terms": { module: "@/app/(public)/terms/page" },
  "/imprint": { module: "@/app/(public)/imprint/page" },
  // The screen is a Client Component; its metadata is the segment layout's.
  "/signin": { module: "@/app/(public)/signin/layout" },
  "/auth/confirm": { module: "@/app/(public)/auth/confirm/page" },
  "/scan/{domain}": { module: "@/app/(public)/scan/[domain]/page", generated: { domain: "example.com" } },
  // Issue 1458: the pages earlier versions published.
  "/compare": { module: "@/app/(public)/compare/page" },
  "/compare/{tool}": { module: "@/app/(public)/compare/[tool]/page", generated: { tool: "ahrefs" } },
  "/teardowns": { module: "@/app/(public)/teardowns/page" },
  "/teardowns/{site}": { module: "@/app/(public)/teardowns/[site]/page", generated: { site: "plausible" } },
  "/answers/{question}": {
    module: "@/app/(public)/answers/[question]/page",
    generated: { question: "free-seo-competitor-analysis-tool" },
  },
  "/tools": { module: "@/app/(public)/tools/page" },
  "/tools/meta-preview": { module: "@/app/(public)/tools/meta-preview/page" },
  "/tools/on-page-check": { module: "@/app/(public)/tools/on-page-check/page" },
  "/veto/{token}": { module: "@/app/(public)/veto/[token]/page" },
  "/opt-out/{token}": { module: "@/app/(public)/opt-out/[token]/page" },
  "/unsubscribe/{token}": { module: "@/app/(public)/unsubscribe/[token]/page" },
  "/pause/{token}": { module: "@/app/(public)/pause/[token]/page" },
};

/** The `<head>` a route actually ships, from the module that exports it. */
async function metadataOf(route: string): Promise<Metadata> {
  const owner = OWNER[route];
  if (owner === undefined) throw new Error(`no OWNER row for ${route}`);
  const mod = (await import(owner.module)) as {
    metadata?: Metadata;
    generateMetadata?: (a: { params: Promise<Record<string, string>> }) => Promise<Metadata>;
  };
  if (owner.generated !== undefined) {
    if (mod.generateMetadata === undefined) throw new Error(`${route} exports no generateMetadata`);
    return await mod.generateMetadata({ params: Promise.resolve(owner.generated) });
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
    "/scans": "/scans",
    "/how-it-works": "/how-it-works",
    "/about": "/about",
    "/privacy": "/privacy",
    "/terms": "/terms",
    "/imprint": "/imprint",
    "/signin": "/signin",
    // `generateMetadata` is asked for `example.com` above.
    "/scan/{domain}": "/scan/example.com",
    "/compare": "/compare",
    "/compare/{tool}": "/compare/ahrefs",
    "/teardowns": "/teardowns",
    "/teardowns/{site}": "/teardowns/plausible",
    "/answers/{question}": "/answers/free-seo-competitor-analysis-tool",
    "/tools": "/tools",
    "/tools/meta-preview": "/tools/meta-preview",
    "/tools/on-page-check": "/tools/on-page-check",
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
  for (const route of ["/veto/{token}", "/opt-out/{token}", "/unsubscribe/{token}", "/pause/{token}"]) {
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
      "/auth/confirm",
      "/opt-out/{token}",
      "/pause/{token}",
      "/scan/{domain}",
      "/signin",
      "/unsubscribe/{token}",
      "/veto/{token}",
    ]);
    for (const row of refused) {
      const meta = await metadataOf(row.route);
      expect(meta.robots, row.route).toEqual({ index: false, follow: false });
    }
  });

  it("the sitemap names every indexable row: a static one itself, a {param} one by its addresses", () => {
    expect([...sitemapPaths()]).toEqual(
      PUBLIC_ROUTE_SEO_ROWS.filter((r) => r.indexable).flatMap((r) =>
        r.route.includes("{") ? [...(r.addresses?.() ?? [])] : [r.route]
      )
    );
    // Issue 1458: every indexable pattern names its addresses, so none is
    // silently missing from the sitemap.
    for (const row of PUBLIC_ROUTE_SEO_ROWS.filter((r) => r.indexable && r.route.includes("{"))) {
      expect(row.addresses?.().length ?? 0, row.route).toBeGreaterThan(0);
    }
  });

  it("no report address is in it (ADR-002 decision 1 · REQ-001 c8)", () => {
    expect(sitemapPaths().some((route) => route.startsWith("/scan/"))).toBe(false);
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

  it("all of them carry the owner's approved sentence, none the marker", () => {
    // Rule 5.5: stated and counted. No approved artifact writes a document
    // title, so ruling 11a filled none of these; the owner approved the
    // first twenty on 2026-09-10 (#459), and the four of `/how-it-works`
    // and `/about` are drafted (issue 1396).
    const keys = PUBLIC_ROUTE_SEO_ROWS.flatMap((row) => [row.title, row.description]);
    // Issue 1458 adds eight rows: six with keys of their own and three
    // articles sharing the two `meta.article.*` slot keys. Issue 1741 adds
    // the Monday mail's two token pages, drafted. Issue 2099 adds the
    // sign-in link's page, drafted.
    expect(keys).toHaveLength(46);
    for (const key of keys) {
      expect(AWAITING_COPY, key).not.toContain(key);
      expect(COPY[key], key).not.toBe("");
    }
  });

  it("the share images' alt text is the owner's the same way, and the site name is the wordmark", () => {
    for (const key of ["meta.og.alt", "meta.report.og.alt"] as const) {
      expect(AWAITING_COPY, key).not.toContain(key);
      expect(COPY[key], key).not.toBe("");
    }
    // `og:site_name` and the manifest's name are `chrome.wordmark`, which
    // ruling 11a approved as written — one home for one word.
    expect(COPY["chrome.wordmark"]).toBe("ReachKit");
  });
});

describe("the favicon set and the manifest ship, and no file is owed to the owner", () => {
  const GENERATED = [
    "src/app/(public)/opengraph-image.tsx",
    "src/app/(public)/scan/[domain]/opengraph-image.tsx",
    "src/app/manifest.ts",
  ];

  /** The committed set (#982, #1121): Next's icon convention at the root
   *  of `app/`, so every route names it, and the stable files third
   *  parties read. All of it is written by `scripts/brand/render.mjs`. */
  const COMMITTED = [
    "src/app/icon.svg",
    "src/app/icon.ico",
    "src/app/apple-icon.png",
    ...["mark.svg", "mark-bimi.svg", "mark-maskable-512.png", "logo.png", "logo@2x.png", "logo-dark.png"].map(
      (file) => `public/brand/${file}`
    ),
    ...[32, 96, 192, 512, 1024].map((size) => `public/brand/mark-${size}.png`),
  ];

  for (const file of [...GENERATED, ...COMMITTED]) {
    it(`${file} exists`, () => {
      expect(existsSync(path.join(REPO_ROOT, file))).toBe(true);
    });
  }

  it("the committed SVGs are the drawing, byte for byte — a changed mark.ts fails until re-rendered", async () => {
    const { brandMarkSvg } = (await import("@/lib/brand/mark")) as {
      brandMarkSvg: () => string;
    };
    for (const file of ["src/app/icon.svg", "public/brand/mark.svg"]) {
      expect(readFileSync(path.join(REPO_ROOT, file), "utf8").trim(), file).toBe(brandMarkSvg());
    }
  });

  it("the BIMI mark is SVG Tiny PS: square, titled, no script or outside reference", () => {
    const bimi = readFileSync(path.join(REPO_ROOT, "public/brand/mark-bimi.svg"), "utf8");
    expect(bimi).toContain('baseProfile="tiny-ps"');
    expect(bimi).toContain("<title>ReachKit</title>");
    expect(bimi).toMatch(/viewBox="0 0 (\d+) \1"/);
    expect(bimi).not.toMatch(/<script|<image|href=|clipPath/);
  });

  // #1568: the rest of the profile a BIMI validator reads. Tiny 1.2 under
  // the PS base profile, no positioning on the root, nothing animated,
  // styled or embedded, every paint reference internal, and a ground that
  // fills the whole square so the inbox's crop never shows a transparent
  // corner.
  it("the BIMI mark is the rest of SVG Tiny PS: 1.2, no root x/y, internal paint only, a full ground", () => {
    const bimi = readFileSync(path.join(REPO_ROOT, "public/brand/mark-bimi.svg"), "utf8");
    const root = /<svg\b[^>]*>/.exec(bimi)?.[0] ?? "";
    expect(root).toContain('version="1.2"');
    expect(root).not.toMatch(/\s(x|y|width|height)=/);
    expect(bimi).not.toMatch(/<(style|a|foreignObject|animate\w*|set|use|font|text)\b/);
    for (const [, ref] of bimi.matchAll(/url\(([^)]*)\)/g)) expect(ref).toMatch(/^#/);
    const box = /viewBox="0 0 (\d+) \1"/.exec(bimi)?.[1];
    expect(bimi).toMatch(new RegExp(`<rect width="${box}" height="${box}" fill="#[0-9a-f]{6}"/>`));
  });

  it("the committed .ico holds the two sizes a browser asks a tab for", () => {
    // ICO: a 6-byte header (reserved, type 1, count), then one 16-byte
    // directory entry per image. Byte 0 of an entry is its width, and 0
    // means 256 — which is why the sizes are read and not assumed.
    const ico = readFileSync(path.join(REPO_ROOT, "src/app/icon.ico"));
    expect(ico.readUInt16LE(0)).toBe(0);
    expect(ico.readUInt16LE(2)).toBe(1);
    const count = ico.readUInt16LE(4);
    const sizes = Array.from({ length: count }, (_, i) => ico.readUInt8(6 + i * 16) || 256);
    expect(sizes.sort((a, b) => a - b)).toEqual([16, 32]);
  });

  it("every PNG is the size its name or the manifest says", async () => {
    const { default: manifest } = await import("@/app/manifest");
    const sized = (file: string, size: number) => {
      const png = readFileSync(path.join(REPO_ROOT, file));
      expect(png.subarray(1, 4).toString(), file).toBe("PNG");
      // IHDR's width and height, big-endian, at a fixed offset in every PNG.
      expect([png.readUInt32BE(16), png.readUInt32BE(20)], file).toEqual([size, size]);
    };
    sized("src/app/apple-icon.png", 180);
    for (const size of [32, 96, 192, 512, 1024]) sized(`public/brand/mark-${size}.png`, size);
    const icons = manifest().icons ?? [];
    expect(icons.map((icon) => icon.purpose)).toEqual(["any", "any", "maskable"]);
    for (const icon of icons) sized(`public${icon.src}`, Number(icon.sizes?.split("x")[0]));
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
    expect(document.theme_color).toBe(token("--color-primary"));
  });
});

describe("the landing and pricing heads state the owner's A1 week (2026-10-19)", () => {
  it("the description, og and twitter tags, the manifest and llms.txt say up to a week's pages, never every day", async () => {
    const { WEEK_PLAN } = await import("@/lib/config/constants");
    const week = `up to ${WEEK_PLAN.days} pages a week`;
    for (const route of ["/", "/pricing"]) {
      const meta = await metadataOf(route);
      for (const said of [meta.description, og(meta).description, tw(meta).description]) {
        expect(String(said), route).toContain(week);
        expect(String(said), route).not.toMatch(/every day/i);
      }
    }
    const { default: manifest } = (await import("@/app/manifest")) as { default: () => { description?: string } };
    expect(manifest().description).toContain(week);
    const { llmsText } = await import("@/app/(public)/_library/feeds");
    const llms = llmsText(ORIGIN!);
    const { copy } = await import("@/lib/presentation/copy");
    expect(llms).toContain(copy("pricing.subline", { weekPages: WEEK_PLAN.days }));
    expect(llms).toContain(week);
  });

  it("llms.txt's third line is the landing subline", async () => {
    const { llmsText } = await import("@/app/(public)/_library/feeds");
    const { copy } = await import("@/lib/presentation/copy");
    expect(llmsText(ORIGIN!).split("\n")[2]).toBe(`> ${copy("landing.subline")}`);
  });
});

describe("the two indexing documents the app host serves", () => {
  it("robots allows the whole site but the gallery's filter variants, and names the sitemap", async () => {
    const { appRobotsDocument } = await import("@/app/(public)/_seo/policies");
    const { parseRobotsTxt, robotsAllows } = await import("@/lib/egress/robots");
    const document = appRobotsDocument(`${ORIGIN}/sitemap.xml`);
    const policy = { ok: true as const, origin: ORIGIN, readAt: new Date(0), absent: false, ...parseRobotsTxt(document) };
    expect(policy.sitemaps).toEqual([`${ORIGIN}/sitemap.xml`]);
    expect(policy.disallowsAll).toBe(false);
    expect(Object.values(policy.disallowedAgents).some(Boolean)).toBe(false);
    for (const agent of ["*", "Googlebot", "Bingbot", "OAI-SearchBot", "PerplexityBot", "GPTBot"]) {
      for (const variant of ["/scans?cat=a", "/scans?sort=az", "/scans?q=a", "/scans?shown=32"]) {
        expect(robotsAllows(policy, [agent], variant), `${agent} ${variant}`).toBe(false);
      }
      for (const page of ["/scans", "/scans/logo/x.com", "/scan/x.com", "/"]) {
        expect(robotsAllows(policy, [agent], page), `${agent} ${page}`).toBe(true);
      }
    }
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
