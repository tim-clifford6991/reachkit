// tests/generate/links/select.test.ts — SPEC §7 (2026-09-12): which of the
// customer's own pages a new page links to.
import "../env";
import { describe, expect, it } from "vitest";
import { CROSS_LINKS } from "../../../src/lib/config/constants";
import { clusterLinkTargets, siteLinkTargets } from "../../../src/lib/generate/links/select";
import type { InventoryRow, PagePurpose } from "../../../src/lib/site-profile/types";

function row(url: string, purpose: PagePurpose, h1 = "", title = ""): InventoryRow {
  return { url, purpose, h1, title: title || `Page at ${url}` };
}

const FULL: InventoryRow[] = [
  row("https://example.com/", "other", "Acme"),
  row("https://example.com/pricing", "pricing", "Plans for every team"),
  row("https://example.com/pricing/enterprise", "pricing", "Enterprise"),
  row("https://example.com/about", "about", "Who we are"),
  row("https://example.com/features", "features", "Everything in one place"),
  row("https://example.com/products/gantt-charts", "product", "Gantt charts"),
  row("https://example.com/products/time-tracking", "product", "Time tracking"),
  row("https://example.com/products/project-templates", "product", "Project templates"),
  row("https://example.com/blog/hello", "blog", "Hello"),
  row("https://example.com/privacy", "legal", "Privacy"),
];

describe("site pages come from the inventory, by purpose", () => {
  it("links one pricing, about and features page, and the product pages nearest the query", () => {
    const targets = siteLinkTargets({
      domain: "example.com",
      inventory: FULL,
      query: "project management templates",
    });
    expect(targets.map((t) => t.url)).toEqual([
      "https://example.com/pricing",
      "https://example.com/about",
      "https://example.com/features",
      "https://example.com/products/project-templates",
      expect.stringMatching(/^https:\/\/example\.com\/products\//),
    ]);
    expect(targets.filter((t) => t.source === "site" && t.purpose === "product")).toHaveLength(
      CROSS_LINKS.PRODUCT_PAGES_MAX
    );
  });

  it("never links the blog, contact, legal or home rows", () => {
    const urls = siteLinkTargets({ domain: "example.com", inventory: FULL, query: "x" }).map((t) => t.url);
    expect(urls).not.toContain("https://example.com/");
    expect(urls).not.toContain("https://example.com/blog/hello");
    expect(urls).not.toContain("https://example.com/privacy");
  });

  it("a site whose inventory holds no pricing page gets no pricing link — nothing is guessed in its place", () => {
    const inventory = FULL.filter((r) => r.purpose !== "pricing");
    const targets = siteLinkTargets({ domain: "example.com", inventory, query: "x" });
    expect(targets.some((t) => t.source === "site" && t.purpose === "pricing")).toBe(false);
    expect(targets.some((t) => t.url.includes("pricing"))).toBe(false);
  });

  it("an empty inventory links nothing", () => {
    expect(siteLinkTargets({ domain: "example.com", inventory: [], query: "x" })).toEqual([]);
  });

  it("labels a link with the page's own h1, then its title, and skips a page with neither", () => {
    const targets = siteLinkTargets({
      domain: "example.com",
      inventory: [
        { url: "https://example.com/about", purpose: "about", h1: "", title: "About Acme" },
        { url: "https://example.com/features", purpose: "features", h1: "", title: "" },
      ],
      query: "x",
    });
    expect(targets).toEqual([{ source: "site", purpose: "about", url: "https://example.com/about", label: "About Acme" }]);
  });

  it("does not link the page to itself, or to a row off the customer's domain", () => {
    const targets = siteLinkTargets({
      domain: "example.com",
      inventory: [
        row("https://www.example.com/features/", "features", "Features"),
        row("https://elsewhere.example/about", "about", "About"),
      ],
      query: "x",
      selfUrl: "https://example.com/features",
    });
    expect(targets).toEqual([]);
  });
});

describe("an address's query is part of the page it names", () => {
 it("keeps two pages that differ only by their query as two pages", () => {
  const targets = siteLinkTargets({
    domain: "example.com",
    inventory: [
      row("https://example.com/product?id=1", "product", "Boards"),
      row("https://example.com/product?id=2", "product", "Timelines"),
    ],
    query: "x",
  });
  expect(targets.map((t) => t.url)).toEqual(["https://example.com/product?id=1", "https://example.com/product?id=2"]);
 });
});

describe("earlier pages come from the cluster's live publications", () => {
  it("newest first, titled, deduplicated and bounded", () => {
    const pages = Array.from({ length: CROSS_LINKS.CLUSTER_PAGES_MAX + 2 }, (_, i) => ({
      liveUrl: `https://content.example.com/p-${i}`,
      title: `Page ${i}`,
      publishedAt: new Date(Date.UTC(2026, 8, 1 + i)),
    }));
    pages.push({ liveUrl: "https://content.example.com/p-0/", title: "Page 0 again", publishedAt: new Date(0) });
    pages.push({ liveUrl: "https://content.example.com/untitled", title: " ", publishedAt: new Date() });

    const targets = clusterLinkTargets(pages);
    expect(targets).toHaveLength(CROSS_LINKS.CLUSTER_PAGES_MAX);
    expect(targets[0]).toEqual({
      source: "cluster",
      url: `https://content.example.com/p-${CROSS_LINKS.CLUSTER_PAGES_MAX + 1}`,
      label: `Page ${CROSS_LINKS.CLUSTER_PAGES_MAX + 1}`,
    });
    expect(targets.some((t) => t.url.endsWith("untitled"))).toBe(false);
  });
});
