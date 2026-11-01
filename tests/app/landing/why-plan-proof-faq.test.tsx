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
const { HOW_FACTS } = await import("@/app/(public)/_how/facts");
const { WEEK_PLAN } = await import("@/lib/config/constants");
const { buysIcons, icons } = await import("../how/drawn-icons");

const article = (slug: string, title: string, day: number): Page => ({
  title,
  liveUrl: `https://content.reachkit.app/${slug}`,
  firstPublishedAt: new Date(Date.UTC(2026, 9, day)),
  byline: null,
});

function stored(): void {
  db.site = { siteId: "site-1", domain: "reachkit.app", host: "blog.reachkit.app" };
  db.pages = [article("newest", "The newest article", 17), article("second", "Second newest", 14), article("third", "Third newest", 10)];
  db.listed = new Set(["podia.com"]);
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

/** Every sentence is in `text`, each after the one before it. */
function inOrder(text: string, sentences: readonly string[]): void {
  let from = 0;
  for (const s of sentences) {
    const at = text.indexOf(s, from);
    expect(at, s).toBeGreaterThan(-1);
    from = at + s.length;
  }
}

const price = copy("price.amount");

beforeEach(stored);

describe("What €49 a month gets you: the tiles, everything in the plan, the plan card", () => {
  it("the heading, then what €49 buys as Pricing's four tiles, with no guarantee before the launch gate", async () => {
    const weekly = (await render()).querySelector("section#weekly")!;
    inOrder(flat(weekly), [
      copy("landing.price.heading", { price }),
      copy("pricing.buys", { price }),
      `${copy("pricing.buys.pages", { weekPages: WEEK_PLAN.days })} ${copy("pricing.buys.pages.what")}`,
      `${copy("pricing.buys.rivals", { rivals: HOW_FACTS.rivals })} ${copy("pricing.buys.rivals.what")}`,
      `${copy("pricing.buys.mail")} ${copy("pricing.buys.mail.what")}`,
      `${copy("pricing.buys.time", { minutes: HOW_FACTS.setupMinutes })} ${copy("pricing.buys.time.what")}`,
    ]);
    expect(weekly.querySelector(`ul[aria-label="${copy("pricing.buys", { price })}"]`)!.querySelectorAll("li")).toHaveLength(4);
    expect(weekly.text).not.toMatch(/money-back/i);
  });

  it("what €49 buys: four tiles with file-text, users, inbox, timer", async () => {
    const weekly = (await render()).querySelector("section#weekly")!;
    expect(buysIcons(weekly.toString(), copy("pricing.buys", { price }))).toEqual(["file-text", "users", "inbox", "timer"]);
  });

  it("everything in the one plan: seven items, the last the pages Google and Bing found on the address we run", async () => {
    const card = (await render()).querySelector("section#weekly h3")!.parentNode as HTMLElement;
    expect(flat(card.querySelector("h3")!)).toBe(copy("landing.price.all"));
    expect(card.querySelectorAll("li").map((li) => flat(li))).toEqual([
      copy("landing.pace", { weekPages: String(HOW_FACTS.weekPages) }),
      copy("landing.price.facts"),
      copy("landing.price.ready"),
      copy("landing.price.monday"),
      copy("landing.price.competitors", { rivals: String(HOW_FACTS.rivals) }),
      copy("landing.price.site"),
      copy("landing.price.found"),
    ]);
  });

  it("the plan card: ReachKit, One plan, €49 a month, the terms, a soft See pricing, then the full value", async () => {
    const card = (await render()).querySelector('[data-testid="landing-price"]')!;
    inOrder(flat(card), [
      copy("chrome.wordmark"),
      copy("pricing.plan.badge"),
      `${price} ${copy("landing.price.month")}`,
      copy("landing.price.terms", { price }),
      copy("landing.price.see"),
      copy("landing.price.more"),
    ]);
    const see = card.querySelectorAll("a").find((a) => flat(a) === copy("landing.price.see"))!;
    expect(see.getAttribute("href")).toBe("/pricing");
    expect(see.getAttribute("class")).toContain("btn-soft");
  });
});

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
