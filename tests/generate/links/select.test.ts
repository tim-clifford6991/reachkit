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

describe("site pages are ranked by the page's topic, across the whole inventory", () => {
  it("offers the pages nearest the topic whatever their kind, the page a reader acts on first", () => {
    const targets = siteLinkTargets({
      domain: "example.com",
      inventory: [...FULL, row("https://example.com/blog/project-templates-guide", "blog", "A guide to project templates")],
      query: "project management templates",
    });
    expect(targets[0]?.url).toBe("https://example.com/pricing");
    expect(targets[1]?.url).toBe("https://example.com/products/project-templates");
    expect(targets.map((t) => t.url)).toContain("https://example.com/blog/project-templates-guide");
    expect(targets.length).toBeGreaterThanOrEqual(CROSS_LINKS.SITE_MIN);
    expect(targets.length).toBeLessThanOrEqual(CROSS_LINKS.SITE_MAX);
    expect(targets[1]).toMatchObject({ why: { kind: "topic", words: expect.arrayContaining(["project", "templates"]) } });
  });

  it("takes no more than two pages from one section of the site, and no sign-in or search page", () => {
    const inventory = [
      ...["sales", "marketing", "recruiting", "education"].map((slug) =>
        row(`https://example.com/solutions/${slug}`, "product", "", `${slug} scheduling software`)
      ),
      row("https://example.com/search", "other", "", "Search scheduling software"),
      row("https://example.com/meeting-polls", "other", "", "Meeting polls for scheduling"),
    ];
    const urls = siteLinkTargets({ domain: "example.com", inventory, query: "scheduling software" }).map((t) => t.url);
    expect(urls.filter((url) => url.includes("/solutions/"))).toHaveLength(2);
    expect(urls).toContain("https://example.com/meeting-polls");
    expect(urls).not.toContain("https://example.com/search");
  });

  it("a word every page carries tells no two apart: the site's name ranks nothing", () => {
    const inventory = ["menu", "catering", "about", "contact"].map((slug) =>
      row(`https://example.com/${slug}`, slug === "about" ? "about" : "other", "", `${slug} | Blue Door Cafe`)
    );
    const targets = siteLinkTargets({ domain: "example.com", inventory, query: "blue door cafe catering prices" });
    expect(targets[0]).toMatchObject({ url: "https://example.com/catering", why: { kind: "topic", words: ["catering"] } });
  });

  it("a site with no page near the topic still gets its main pages, up to the floor", () => {
    const targets = siteLinkTargets({ domain: "example.com", inventory: FULL, query: "zzz" });
    expect(targets).toHaveLength(CROSS_LINKS.SITE_MIN);
    expect(targets.map((t) => t.why?.kind)).toEqual(["buy", "main", "main"]);
    expect(targets.map((t) => t.url)).toContain("https://example.com/pricing");
  });

  it("never links the home page or a legal page", () => {
    const urls = siteLinkTargets({ domain: "example.com", inventory: FULL, query: "acme privacy" }).map((t) => t.url);
    expect(urls).not.toContain("https://example.com/");
    expect(urls).not.toContain("https://example.com/privacy");
  });

  it("a site whose inventory holds no pricing page gets no pricing link — nothing is guessed in its place", () => {
    const inventory = FULL.filter((r) => r.purpose !== "pricing");
    const targets = siteLinkTargets({ domain: "example.com", inventory, query: "pricing" });
    expect(targets.some((t) => t.url.includes("pricing"))).toBe(false);
  });

  it("an empty inventory links nothing", () => {
    expect(siteLinkTargets({ domain: "example.com", inventory: [], query: "x" })).toEqual([]);
  });

  it("names a page by what its address says, never by its slogan", () => {
    const targets = siteLinkTargets({
      domain: "example.com",
      inventory: [
        { url: "https://example.com/pricing", purpose: "pricing", h1: "One plan. One page a day.", title: "One plan. One page a day." },
        { url: "https://example.com/about", purpose: "about", h1: "", title: "About Acme | Acme" },
        { url: "https://example.com/features", purpose: "features", h1: "", title: "" },
      ],
      query: "x",
    });
    expect(targets.map((t) => t.label)).toEqual(["Pricing", "Features", "About Acme"]);
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
      why: { kind: "cluster" },
    });
    expect(targets.some((t) => t.url.endsWith("untitled"))).toBe(false);
  });
});
