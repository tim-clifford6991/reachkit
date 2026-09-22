// SPEC §7 (2026-09-20, #928) — the three sources, and what happens when one
// of them does not answer.
//
// "every post on a connected WordPress (read through the connection when it
// is made and every Monday — all posts, not only ours), and the main site's
// crawled pages."
//
// The rule this file exists for is the failure one: **a source that could
// not be read leaves its own rows as they were.** An index emptied by a
// blog that was down for a minute would answer "nothing is covered" to
// every question asked of it, and the next day's page would repeat a post
// the customer already has.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { KNOWN_CONTENT } from "@/lib/config/constants";
import { headingsOf, plainText, postPage } from "@/lib/known-content/wordpress";
import { inventoryPages, refreshKnownContent } from "@/lib/known-content/refresh";
import type { KnownPage, KnownSource } from "@/lib/known-content/types";
import type { InventoryRow } from "@/lib/site-profile/types";

/** What was written, per source — the store, doubled at its own seam. */
const written: { source: KnownSource; pages: readonly KnownPage[] }[] = [];
const writeFails = { on: null as KnownSource | null };

vi.mock("@/lib/known-content/store", () => ({
  writeKnownSource: async (a: { source: KnownSource; pages: readonly KnownPage[] }) => {
    if (writeFails.on === a.source) throw new Error("the database refused");
    written.push({ source: a.source, pages: a.pages });
  },
  readOurPages: async () => [
    { source: "reachkit", ref: "d1", url: null, title: "A page in review", headings: [], live: false, publishedAt: null },
  ],
  readKnownContent: async () => [],
}));

beforeEach(() => {
  written.length = 0;
  writeFails.on = null;
});

function inventory(n: number): InventoryRow[] {
  return Array.from({ length: n }, (_, index) => ({
    url: `https://acme.example/page-${index}`,
    title: `Page ${index}`,
    h1: `Page ${index}`,
    purpose: "other" as const,
  }));
}

describe("#928 — a refresh writes each source on its own", () => {
  it("writes all three where all three answer", async () => {
    const result = await refreshKnownContent({
      siteId: "site-1",
      inventory: inventory(2),
      readWordPress: async () => [
        { source: "wordpress", ref: "9", url: "https://acme.example/p/9", title: "Theirs", headings: [], live: true, publishedAt: null },
      ],
    });
    expect(result).toEqual({ reachkit: 1, wordpress: 1, site: 2 });
    expect(written.map((row) => row.source).sort()).toEqual(["reachkit", "site", "wordpress"]);
  });

  it("a WordPress that did not answer writes no WordPress rows at all, and the others still land", async () => {
    const result = await refreshKnownContent({
      siteId: "site-1",
      inventory: inventory(2),
      // `null` is "we could not read this site" — never "they have nothing".
      readWordPress: async () => null,
    });
    expect(result.wordpress).toBeNull();
    expect(written.some((row) => row.source === "wordpress")).toBe(false);
    expect(result.reachkit).toBe(1);
    expect(result.site).toBe(2);
  });

  it("a site with no WordPress has no third source, and nothing is written over one", async () => {
    const result = await refreshKnownContent({ siteId: "site-1", inventory: [] });
    expect(result.wordpress).toBeNull();
    expect(written.some((row) => row.source === "wordpress")).toBe(false);
  });

  it("a write that raises is logged and leaves the other sources alone", async () => {
    writeFails.on = "reachkit";
    const result = await refreshKnownContent({ siteId: "site-1", inventory: inventory(1) });
    expect(result.reachkit).toBeNull();
    expect(result.site).toBe(1);
  });
});

describe("#928 — the crawl's reading, as the index holds it", () => {
  it("is capped at #928's own hundred pages", () => {
    expect(inventoryPages(inventory(150))).toHaveLength(KNOWN_CONTENT.INVENTORY_MAX);
  });

  it("drops a page with no words to match on, and holds one address once", () => {
    const rows: InventoryRow[] = [
      { url: "https://acme.example/a", title: "", h1: "", purpose: "other" },
      { url: "https://acme.example/b", title: "B", h1: "", purpose: "about" },
      { url: "https://acme.example/b", title: "B again", h1: "", purpose: "about" },
    ];
    expect(inventoryPages(rows).map((page) => page.ref)).toEqual(["https://acme.example/b"]);
  });
});

describe("#928 — one of their posts, as the index holds it", () => {
  it("takes the title, the address, the date and the headings — and no body", () => {
    const page = postPage({
      id: 42,
      link: "https://acme.example/blog/retainers",
      status: "publish",
      date_gmt: "2026-06-01T10:00:00",
      title: { rendered: "How to price a &amp; retainer" },
      content: { rendered: "<h2>What to charge</h2><p>Lots of words.</p><h3>Why</h3>" },
    });
    expect(page).toMatchObject({
      source: "wordpress",
      ref: "42",
      url: "https://acme.example/blog/retainers",
      title: "How to price a & retainer",
      headings: ["What to charge", "Why"],
      live: true,
    });
    expect(page?.publishedAt?.toISOString()).toBe("2026-06-01T10:00:00.000Z");
    expect(JSON.stringify(page)).not.toContain("Lots of words");
  });

  it("a post still in draft is known content and is not a page anyone can open", () => {
    const page = postPage({ id: 7, link: "https://acme.example/?p=7", status: "draft", title: { rendered: "Half written" } });
    expect(page?.live).toBe(false);
  });

  it("a row with no id or no title is not a page we can name", () => {
    expect(postPage({ link: "https://acme.example/x", title: { rendered: "No id" } })).toBeNull();
    expect(postPage({ id: 3, title: { rendered: "   " } })).toBeNull();
  });

  it("reads the words a reader meets, not the markup", () => {
    expect(plainText("<p>Two&nbsp;words &lt;here&gt;</p>")).toBe("Two words <here>");
    expect(headingsOf("<h1>One</h1><h4>Not a heading here</h4>")).toEqual(["One"]);
  });
});
