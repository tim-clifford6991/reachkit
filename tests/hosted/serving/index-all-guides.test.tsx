/** @vitest-environment jsdom */
// "All guides" on the hosted index (owner R1, 2026-10-22): every live page one
// click from `/`, grouped by SPEC §6 topic, with the newest-first paging kept.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { HostedPage } from "@/lib/publish/destinations/hosted";
import { HostedIndex } from "@/app/(hosted)/hosted-page/[[...slug]]/listing";

const BUSINESS = { name: "Harbor Plumbing", logoType: null, line: null, domain: "harborplumbing.com" };
const DAY = 86_400_000;

function guide(i: number, over: Partial<HostedPage> = {}): HostedPage {
  const at = new Date(Date.UTC(2026, 9, 20) - i * DAY);
  const slug = `guide-${i}-what-to-check-before-you-call-a-plumber`;
  return {
    publicationId: `pub-${i}`,
    siteId: "site-1",
    slug,
    title: `Guide ${String(i).padStart(3, "0")}: what to check before you call a plumber`,
    heading: null,
    bodyMd: "One paragraph.",
    description: "What to look at first, and when to stop and call.",
    faq: [],
    grounded: null,
    made: null,
    publisher: { name: "harborplumbing.com", category: null, timeZone: null },
    byline: null,
    publishedAt: at,
    firstPublishedAt: at,
    liveUrl: `https://help.harborplumbing.com/${slug}`,
    record: { opportunityId: `opp-${i}`, targetQuery: `query ${i}`, measuredOn: null, mode: "autopilot", liveUrl: "" },
    ...over,
  } as HostedPage;
}

function render(pages: HostedPage[], page = 1, query = ""): Document {
  const html = renderToStaticMarkup(
    <HostedIndex business={BUSINESS} canonical="https://help.harborplumbing.com/" pages={pages} query={query} page={page} />
  );
  return new DOMParser().parseFromString(html, "text/html");
}

function allGuides(doc: Document): HTMLElement {
  const heading = [...doc.querySelectorAll("h2")].find((h) => h.textContent === "All guides");
  if (heading === undefined) throw new Error("no All guides section");
  return heading.closest("section")!;
}

function linked(scope: ParentNode): string[] {
  return [...scope.querySelectorAll("a[href^='/']")].map((a) => a.getAttribute("href")!.slice(1));
}

describe("the hosted index lists every live guide by topic", () => {
  it("links every one of 400 live pages from `/` once, under 120 KB, and the Blog names only the cards", () => {
    // Every fourth page shares one of ten topics; the rest have none.
    const pages = Array.from({ length: 400 }, (_, i) => guide(i, { cluster: i % 4 === 0 ? `topic ${i % 10}` : null }));
    const html = renderToStaticMarkup(
      <HostedIndex business={BUSINESS} canonical="https://help.harborplumbing.com/" pages={pages} query="" page={1} />
    );
    const doc = new DOMParser().parseFromString(html, "text/html");

    const listed = linked(allGuides(doc));
    expect(listed.sort()).toEqual(pages.map((p) => p.slug).sort());
    expect(new TextEncoder().encode(html).length).toBeLessThan(120 * 1024);
    expect(allGuides(doc).querySelector("p")?.textContent).toBe("Every guide on this site, by topic.");

    const blog = JSON.parse(doc.querySelector("script[type='application/ld+json']")!.textContent!) as {
      "@graph"?: { "@type": string; blogPost?: unknown[] }[];
      blogPost?: unknown[];
    };
    const node = blog["@graph"]?.find((n) => n["@type"] === "Blog") ?? blog;
    expect(node.blogPost).toHaveLength(13);
  });

  it("labels a topic with the page that leads it, counts it, and puts an offering page, else the oldest, first", () => {
    const pages = [
      guide(1, { cluster: "water heater", title: "Water heater leaking from the bottom" }),
      guide(2, { cluster: "water heater", title: "Tank or tankless for a family of four" }),
      guide(3, { cluster: "water heater", title: "Water heater repair in Austin", offering: true }),
      guide(4, { cluster: "drain", title: "How to unclog a kitchen sink" }),
      guide(5, { cluster: "drain", title: "Toilet keeps running" }),
      guide(6, { cluster: "slab", title: "How to find a slab leak" }),
      guide(7, { title: "Low water pressure in the whole house" }),
    ];
    const section = allGuides(render(pages));
    const topics = [...section.querySelectorAll("h3")].map((h) => `${h.textContent} ${h.nextElementSibling?.textContent}`);
    expect(topics).toEqual(["Water heater repair in Austin 3 guides", "Toilet keeps running 2 guides"]);
    // One decorative book glyph per topic card, none on the A–Z list.
    for (const card of section.querySelectorAll(".card")) {
      expect(card.querySelectorAll("svg")).toHaveLength(1);
      expect(card.querySelectorAll("svg[aria-hidden='true']")).toHaveLength(1);
    }
    expect(section.querySelectorAll(":scope > ul svg")).toHaveLength(0);
    // A topic only one page has is no topic: it joins the A–Z rest.
    const rest = [...section.querySelectorAll(":scope > ul a")].map((a) => a.textContent);
    expect(rest).toEqual(["How to find a slab leak", "Low water pressure in the whole house"]);
    expect(linked(section).sort()).toEqual(pages.map((p) => p.slug).sort());
  });

  it("index search and group icons (E26)", () => {
    const pages = [1, 2, 3, 4].map((i) => guide(i, { cluster: i < 3 ? "water heater" : "drain" }));
    const doc = render(pages);
    const button = doc.querySelector("form[role='search'] button[type='submit']")!;
    expect(button.querySelector("svg.lucide-search")?.getAttribute("aria-hidden")).toBe("true");
    expect(button.textContent).toBe("Search");
    const cards = allGuides(doc).querySelectorAll(".card");
    expect(cards).toHaveLength(2);
    for (const card of cards) {
      expect([...card.querySelectorAll("svg")].map((svg) => svg.getAttribute("class"))).toEqual([
        "lucide lucide-book-open flex-none",
      ]);
    }
  });

  it("with no topic is one flat A–Z list, on every page of the newest-first paging", () => {
    const pages = Array.from({ length: 30 }, (_, i) => guide(i));
    for (const n of [1, 2, 3]) {
      const doc = render(pages, n);
      const section = allGuides(doc);
      expect(section.querySelectorAll("h3")).toHaveLength(0);
      const titles = [...section.querySelectorAll("a")].map((a) => a.textContent!);
      expect(titles).toEqual(pages.map((p) => p.title).sort((a, b) => a.localeCompare(b)));
      expect(doc.querySelector("[aria-current='page']")?.textContent).toBe(`Page ${n} of 3`);
    }
  });

  it("a site with no pages still says so, and a search shows its matches only", () => {
    const empty = render([]);
    expect(empty.body.textContent).toContain("Nothing has been published here yet.");
    expect([...empty.querySelectorAll("h2")].map((h) => h.textContent)).not.toContain("All guides");

    const searched = render([guide(1), guide(2)], 1, "guide 001");
    expect([...searched.querySelectorAll("h2")].map((h) => h.textContent)).not.toContain("All guides");
  });
});
