// The landing from How it works to the articles, as boards PubLanding and
// PubLandingPhone v37 draw it: one heading size, the board's step and Why
// sizes, and the articles drawn only where rows are stored.
// The store and the gallery are the database seam; nothing else is replaced.
import "../../generate/env";
import React from "react";
import { parse, type HTMLElement } from "node-html-parser";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { settledMarkup } from "../shell/settled";

type Page = { title: string; liveUrl: string; firstPublishedAt: Date; byline: null };

const db = vi.hoisted(() => ({
  site: null as { siteId: string; domain: string; host: string } | null,
  pages: [] as Page[],
  listed: new Set<string>(),
}));

vi.mock("@/lib/publish/destinations/hosted/store", () => ({
  hostedSiteForDomain: async () => db.site,
  hostedHostOfSite: async () => "content.reachkit.app",
  livePagesForSite: async () => db.pages,
}));
vi.mock("@/lib/scan/gallery", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/scan/gallery")>()),
  isListed: async (domain: string) => db.listed.has(domain),
  listedCard: async (d: string) => (db.listed.has(d) ? { score: 62, hasLogo: false } : null),
}));

const { default: LandingPage } = await import("@/app/(public)/page");
const { copy } = await import("@/lib/presentation/copy");
const { SECTION_HEADING } = await import("@/app/(public)/_landing/sections");

const article = (slug: string, title: string, day: number): Page => ({
  title,
  liveUrl: `https://content.reachkit.app/${slug}`,
  firstPublishedAt: new Date(Date.UTC(2026, 9, day)),
  byline: null,
});

function stored(): void {
  db.site = { siteId: "site-1", domain: "reachkit.app", host: "blog.reachkit.app" };
  db.pages = [article("newest", "The newest article", 17), article("second", "Second newest", 14), article("third", "Third newest", 10)];
  db.listed = new Set(["reachkit.app"]);
}

function nothingStored(): void {
  db.site = null;
  db.pages = [];
  db.listed = new Set();
}

/** The settled page, each streamed boundary put back where its placeholder sits, as the browser does. */
async function render(): Promise<HTMLElement> {
  const page = parse(await settledMarkup(React.createElement(LandingPage, { searchParams: {} })));
  for (const done of page.querySelectorAll('div[hidden][id^="S:"]')) {
    const slot = page.querySelector(`template[id="B:${done.id.slice(2)}"]`);
    slot?.replaceWith(done.innerHTML);
    done.remove();
  }
  return parse(page.toString());
}

/** An element's words, one space between elements, entities decoded. */
const flat = (el: HTMLElement): string => parse(el.toString().replace(/</g, " <")).text.replace(/\s+/g, " ").trim();


beforeEach(stored);

describe("one size for each kind of line (A.0.4)", () => {
  const has = (el: HTMLElement | null, classes: string): boolean => classes.split(" ").every((c) => el!.classList.contains(c));

  it("every visible section heading is SECTION_HEADING, and the eyebrows are text-sm", async () => {
    const page = await render();
    const headings = page.querySelectorAll("main h2").filter((h) => !h.classList.contains("sr-only"));
    expect(headings).toHaveLength(6);
    for (const h of headings) expect(has(h, SECTION_HEADING), flat(h)).toBe(true);
    for (const id of ["how", "why"]) expect(page.querySelector(`section#${id} h2`)!.previousElementSibling!.classList.contains("text-sm")).toBe(true);
  });

  it("each step: a size-10 number, a badge-md tag, a text-2xl title and a max-w-md body that grows from lg", async () => {
    for (const step of (await render()).querySelectorAll("#how li[data-step]")) {
      expect(has(step.querySelector(".rounded-full"), "size-10")).toBe(true);
      expect(has(step.querySelector(".badge"), "badge-md")).toBe(true);
      expect(has(step.querySelector("h3"), "text-2xl")).toBe(true);
      expect(has(step.querySelector("h3 + p"), "max-w-md text-base lg:text-lg")).toBe(true);
    }
  });

  it("Why: the line under the heading is text-lg lg:text-xl, each card title text-xl lg:text-2xl over a text-base line", async () => {
    const why = (await render()).querySelector("section#why")!;
    expect(has(why.querySelector("h2 + p"), "text-lg lg:text-xl")).toBe(true);
    for (const card of why.querySelectorAll("li.card")) {
      expect(has(card.querySelector("h3"), "text-xl lg:text-2xl")).toBe(true);
      expect(has(card.querySelector("h3 + p"), "text-base")).toBe(true);
    }
  });
});

describe("Latest articles: a page section of three dated cards and the index", () => {
  it("three cards, newest first, each one link holding a tile, its title, its date and Read; then All articles", async () => {
    const section = (await render()).querySelector('section[aria-labelledby="latest-articles"]')!;
    expect(flat(section.querySelector("h2 + p")!)).toBe(copy("landing.articles.sub"));
    const cards = section.querySelectorAll("li");
    const read = copy("landing.articles.read");
    expect(cards.map((li) => flat(li))).toEqual([`The newest article 17 Oct 2026 ${read}`, `Second newest 14 Oct 2026 ${read}`, `Third newest 10 Oct 2026 ${read}`]);
    for (const [i, li] of cards.entries()) {
      const links = li.querySelectorAll("a");
      expect(links.map((a) => a.getAttribute("href"))).toEqual([db.pages[i]!.liveUrl]);
      expect(links[0]!.classList.contains("card")).toBe(true);
      expect(links[0]!.querySelectorAll("svg.lucide-file-text")).toHaveLength(1);
      expect(links[0]!.querySelector("strong")!.classNames).toBe("line-clamp-3 text-lg font-bold break-words lg:text-xl");
    }
    const all = section.querySelectorAll("a").find((a) => flat(a) === copy("landing.articles.all"))!;
    expect(all.getAttribute("href")).toBe("https://content.reachkit.app/");
  });

  it("with no article stored there is no section", async () => {
    nothingStored();
    expect((await render()).querySelector('section[aria-labelledby="latest-articles"]')).toBeNull();
  });
});

describe("the sections follow the board's order", () => {
  it("why → the plan → questions → articles → the closing band", async () => {
    const html = (await render()).toString();
    const at = ['id="why"', 'id="weekly"', 'id="faq"', 'aria-labelledby="latest-articles"', copy("landing.close.heading")].map((m) =>
      html.indexOf(m)
    );
    expect(at.every((n) => n > -1), at.join(",")).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });
});
