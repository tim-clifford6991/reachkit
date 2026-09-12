// SPEC §7 — the links a published asset carries, and the ones it must not.
// Asserted over the body as it will publish, read back through the one
// renderer the screen, both copy-out controls and both destinations use.
import "./env";
import { describe, expect, it } from "vitest";
import { bodyWithLinks, planLinks } from "../../src/lib/generate/links";
import { renderMarkdownHtml } from "../../src/lib/publish/render/markdown";
import type { PublishedAsset } from "../../src/lib/generate/store";
import type { PagePurpose, SiteProfile } from "../../src/lib/site-profile";

const AT = new Date("2026-09-01T10:00:00.000Z");
const QUERY = "best project management software for small teams";
const BODY = "## Which tool should a small team pick?\n\nIt depends how many need a seat.";

type Row = { url: string; title: string; purpose: PagePurpose; h1?: string };

function profile(rows: Row[]): SiteProfile {
  return {
    domain: "example.com", siteName: "Acme", products: [], claims: [], voice: null,
    inventory: rows.map((r) => ({ url: r.url, title: r.title, h1: r.h1 ?? "", purpose: r.purpose })),
    pagesRead: rows.length, refreshedAt: AT,
  };
}

function asset(over: Partial<PublishedAsset> = {}): PublishedAsset {
  return {
    liveUrl: "https://example.com/how-seat-limits-work", title: "How seat limits work",
    targetQuery: "project management seat limits", publishedAt: AT,
    unpublishedAt: null, knownMissing: false, ...over,
  };
}

const FULL_SITE: Row[] = [
  { url: "https://example.com/pricing", title: "Pricing", purpose: "pricing" },
  { url: "https://example.com/about", title: "About Acme", purpose: "about" },
  { url: "https://example.com/features", title: "Features", purpose: "features" },
  { url: "https://example.com/products/boards", title: "Boards", purpose: "product" },
  { url: "https://example.com/blog/hello", title: "Hello", purpose: "blog" },
  { url: "https://example.com/contact", title: "Talk to us", purpose: "contact" },
];

function publish(a: { rows?: Row[]; published?: PublishedAsset[]; body?: string }): string {
  const body = a.body ?? BODY;
  const links = planLinks({
    profile: a.rows === undefined ? null : profile(a.rows),
    published: a.published ?? [],
    targetQuery: QUERY,
    bodyMarkdown: body,
  });
  return bodyWithLinks(body, links);
}

describe("SPEC §7 — every published asset links into the site and its cluster", () => {
  it("links to the site's own pages the inventory holds, and to the earlier asset in its cluster", () => {
    const html = renderMarkdownHtml(publish({ rows: FULL_SITE, published: [asset()] }));
    expect(html).toContain('<a href="https://example.com/pricing">Pricing</a>');
    expect(html).toContain('<a href="https://example.com/about">About Acme</a>');
    expect(html).toContain('<a href="https://example.com/features">Features</a>');
    expect(html).toContain('<a href="https://example.com/products/boards">Boards</a>');
    expect(html).toContain('<a href="https://example.com/how-seat-limits-work">How seat limits work</a>');
    // Purposes §7 does not name are not pages it sends a reader to.
    expect(html).not.toContain("/blog/hello");
    expect(html).not.toContain("/contact");
  });

  it("a site whose inventory holds no pricing page gets no pricing link and no apology", () => {
    const body = publish({ rows: FULL_SITE.filter((r) => r.purpose !== "pricing") });
    expect(body.toLowerCase()).not.toContain("pricing");
    expect(body).toContain("https://example.com/about");
  });

  it("a site read as nothing, with nothing published, leaves the page exactly as written", () => {
    expect(publish({})).toBe(BODY);
  });

  it("a page known to lead nowhere is not linked", () => {
    const body = publish({
      published: [
        asset({ liveUrl: "https://example.com/taken-down", unpublishedAt: AT }),
        asset({ liveUrl: "https://example.com/never-found", knownMissing: true }),
        asset({ liveUrl: "https://example.com/untitled", title: "  " }),
      ],
    });
    expect(body).toBe(BODY);
  });

  it("a page the body already links is not linked twice", () => {
    const grounded = `${BODY}\n\nSeats are per person, per [pricing](https://example.com/pricing).`;
    expect(publish({ rows: FULL_SITE, body: grounded }).match(/example\.com\/pricing/g)).toHaveLength(1);
  });

  it("no placeholder href ships: an unaddressable address, and a row with no words, are not written", () => {
    const html = renderMarkdownHtml(
      publish({
        rows: [
          { url: "javascript:alert(1)", title: "Pricing", purpose: "pricing" },
          { url: "https://example.com/features", title: "", h1: "", purpose: "features" },
          { url: "https://example.com/about", title: "About Acme", purpose: "about" },
        ],
      })
    );
    expect(html).not.toContain("javascript");
    expect(html).not.toContain("/features");
    expect(html).toContain('<a href="https://example.com/about">About Acme</a>');
  });

  it("only the assets sharing this page's topic are linked, and at most three of them", () => {
    const body = publish({
      published: [
        asset({ liveUrl: "https://example.com/a", targetQuery: "project management for teams" }),
        asset({ liveUrl: "https://example.com/b", targetQuery: "software for managing projects" }),
        asset({ liveUrl: "https://example.com/c", targetQuery: "project software pricing" }),
        asset({ liveUrl: "https://example.com/d", targetQuery: "project management software" }),
        asset({ liveUrl: "https://example.com/e", targetQuery: "best coffee in Lisbon" }),
      ],
    });
    expect(body).not.toContain("https://example.com/e");
    expect(body.match(/- \[/g)).toHaveLength(3);
  });
});
