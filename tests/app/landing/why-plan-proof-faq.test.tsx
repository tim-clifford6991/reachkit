// The landing from *Why you should care* to the articles, as boards PubLanding
// and PubLandingPhone draw it: each section's strings in the board's order, and
// the two sections that read stored rows drawn only where rows are stored.
// The store and the gallery are the database seam; nothing else is replaced.
import "../../generate/env";
import { readFileSync } from "node:fs";
import React from "react";
import { parse, type HTMLElement } from "node-html-parser";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { boardFile, compare, readAllow, segments } from "../../../scripts/design/parity.mjs";
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
  listedScore: async (d: string) => (db.listed.has(d) ? 62 : null),
}));

const { default: LandingPage } = await import("@/app/(public)/page");
const { copy } = await import("@/lib/presentation/copy");
const { HOW_FACTS } = await import("@/app/(public)/_how/facts");
const { WEEK_PLAN } = await import("@/lib/config/constants");
const { SPECIMEN_HERO } = await import("@/app/(public)/_landing/specimen");
const { buysIcons, whenIcons } = await import("../how/drawn-icons");

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

describe("Why you should care: four cards whose drawings are the board's", () => {
  it("the Google card draws one search, a chain's page at #2, and You not on Google's first two pages, as an example", async () => {
    const why = (await render()).querySelector("section#why")!;
    const card = why.querySelectorAll("li.card")[1]!;
    inOrder(flat(card), [
      copy("landing.feature.google.title"),
      copy("landing.feature.google.search"),
      copy("landing.feature.google.chain"),
      "#2",
      copy("landing.feature.google.you"),
      copy("landing.feature.google.absent"),
      copy("landing.feature.example"),
    ]);
    expect(card.querySelector("progress")).toBeNull();
  });

  it("the Fix card shows the problems as found, each with who fixes it", async () => {
    const card = (await render()).querySelector("section#why")!.querySelectorAll("li.card")[2]!;
    inOrder(flat(card), [
      copy("landing.feature.fix.title"),
      copy("how.read.held.ai"),
      copy("landing.feature.fix.free"),
      copy("how.read.held.list"),
      copy("landing.feature.fix.free"),
      copy("landing.feature.fix.titles"),
      copy("landing.feature.fix.ours"),
      copy("landing.feature.example"),
    ]);
  });

  it("the Pages card draws Tuesday to Saturday, each live at the example hour, and says it is an example", async () => {
    const card = (await render()).querySelector("section#why")!.querySelectorAll("li.card")[3]!;
    const days = card.querySelectorAll("ol > li").map((li) => flat(li));
    expect(days).toEqual(["Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => `${d} ${SPECIMEN_HERO.liveAt}`));
    expect(flat(card)).toContain(copy("landing.feature.daily.caption", { time: SPECIMEN_HERO.liveAt }));
  });

  it("every drawing shows at every width, as the phone board draws them", async () => {
    for (const demo of (await render()).querySelectorAll("section#why [data-demo]")) {
      expect(demo.getAttribute("class")).not.toMatch(/\bhidden\b/);
    }
  });

  it("the section ends with the link to how we find who answers instead", async () => {
    const links = (await render()).querySelector("section#why")!.querySelectorAll("a");
    const last = links[links.length - 1]!;
    expect(flat(last)).toBe(copy("landing.why.more"));
    expect(last.getAttribute("href")).toBe("/how-it-works#competitors");
  });
});

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

describe("See it on a real site: the listed report and ReachKit's own newest page, from stored rows", () => {
  const proof = (page: HTMLElement): HTMLElement | null => page.querySelector('section[aria-labelledby="proof"]');

  it("the report card opens podia.com's report, then the page card names the newest live page", async () => {
    const section = proof(await render())!;
    inOrder(flat(section), [
      copy("about.proof.title"),
      copy("about.proof.report"),
      "podia.com",
      copy("about.proof.open"),
      copy("landing.real.page"),
      "The newest article",
      copy("landing.real.page.line"),
    ]);
    expect(section.querySelector('a[href="/scan/podia.com"]')).not.toBeNull();
    expect(section.querySelector('a[href="https://content.reachkit.app/newest"]')).not.toBeNull();
  });

  it("a report no longer listed is not the example; the page card stays", async () => {
    db.listed = new Set();
    const section = proof(await render())!;
    expect(section.querySelector('a[href^="/scan/"]')).toBeNull();
    expect(flat(section)).toContain(copy("landing.real.page"));
  });

  it("with nothing stored there is no section, never a placeholder", async () => {
    nothingStored();
    const page = await render();
    expect(proof(page)).toBeNull();
    expect(page.text).not.toContain(copy("about.proof.title"));
  });
});

describe("Questions owners ask", () => {
  it("what to expect, when, comes before the first question", async () => {
    const text = flat((await render()).querySelector("section#faq")!);
    inOrder(text, [copy("landing.faq.heading"), copy("how.when.title"), copy("how.when.sub"), copy("how.when.promise"), copy("how.when.maps"), copy("landing.faq.spam.q")]);
  });

  it("what to expect: calendar, search, eye, trending-up in order, then the notes: info, map-pin", async () => {
    const faq = (await render()).querySelector("section#faq")!;
    expect(whenIcons(faq.toString())).toEqual({ steps: ["calendar", "search", "eye", "trending-up"], notes: ["info", "map-pin"] });
  });

  it("the spam answer names Claude, and the results answer says where the Monday email shows the pages", async () => {
    const text = flat((await render()).querySelector("section#faq")!);
    expect(text).toContain("Claude, an AI model, writes each page");
    expect(text).toContain("Each Monday email shows where they sit on Google, and whether AI links to them.");
  });

  it("the section ends with every question, with the detail, on How it works", async () => {
    const links = (await render()).querySelector("section#faq")!.querySelectorAll("a");
    const last = links[links.length - 1]!;
    expect(flat(last)).toBe(copy("landing.faq.more"));
    expect(last.getAttribute("href")).toBe("/how-it-works#faq");
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

describe("the sections follow the board's order, and no board string of them is missing", () => {
  it("why → the plan → a real site → questions → articles → the closing band", async () => {
    const html = (await render()).toString();
    const at = ['id="why"', 'id="weekly"', 'aria-labelledby="proof"', 'id="faq"', 'aria-labelledby="latest-articles"', copy("landing.close.heading")].map((m) =>
      html.indexOf(m)
    );
    expect(at.every((n) => n > -1), at.join(",")).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });

  // With rows stored, a stored-rows allow line excuses nothing: every string is drawn.
  for (const board of ["PubLanding", "PubLandingPhone"]) {
    it(`${board}: each section from why to the articles carries the board's strings`, async () => {
      const page = await render();
      const drawn = parse(readFileSync(boardFile(board), "utf8"));
      const allow = readAllow(board).filter((a: { reason: string }) => !/seeds none/.test(a.reason));
      const pairs: [string, string][] = [
        ['section[aria-labelledby="why"]', "section#why"],
        ['section[aria-labelledby="weekly"]', "section#weekly"],
        ['section[aria-labelledby="proof"]', 'section[aria-labelledby="proof"]'],
        ['section[aria-labelledby="faq"]', "section#faq"],
        ['section[aria-labelledby="articles"]', 'section[aria-labelledby="latest-articles"]'],
      ];
      for (const [want, got] of pairs) {
        const ship = page.querySelector(got);
        expect(ship, got).not.toBeNull();
        expect(compare(drawn.querySelector(want)!.toString(), segments(ship!.toString()), allow).missing, want).toEqual([]);
      }
    });
  }
});
