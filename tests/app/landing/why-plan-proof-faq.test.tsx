// The landing from *Why you should care* to the articles, as boards PubLanding
// and PubLandingPhone draw it: each section's strings in the board's order, and
// the articles drawn only where rows are stored.
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
const { icons } = await import("../how/drawn-icons");

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

describe("Questions owners ask", () => {
  it("what to expect: calendar, search, eye, trending-up in order, and no note under them", async () => {
    const card = (await render()).querySelector("section#faq figure")!;
    expect(icons(card.toString())).toEqual(["calendar", "search", "eye", "trending-up"]);
  });
});

describe("Latest articles: a page section of three dated cards and the index", () => {
  it("three cards, newest first, each a title and its date, then All articles to the index", async () => {
    const section = (await render()).querySelector('section[aria-labelledby="latest-articles"]')!;
    const cards = section.querySelectorAll("li.card");
    expect(cards.map((li) => flat(li))).toEqual(["The newest article 17 Oct 2026", "Second newest 14 Oct 2026", "Third newest 10 Oct 2026"]);
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
