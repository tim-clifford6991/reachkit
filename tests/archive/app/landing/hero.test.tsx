/** @vitest-environment jsdom */
// The landing above How it works, as boards PubLanding and PubLandingPhone v37
// draw it: the owner's headline, the field and offer made to stand out, a count
// row drawn only from 100 sites scanned, the six kinds of business, the story
// card's four frames for the one example business, and the walkthrough band
// once its file exists.
// The store and the gallery are the database seam; nothing else is replaced.
import "../../generate/env";
import { readFileSync } from "node:fs";
import React from "react";
import { parse, type HTMLElement } from "node-html-parser";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { boardFile, compare, readAllow, segments, words } from "../../../scripts/design/parity.mjs";
import { settledMarkup } from "../shell/settled";

type Page = { title: string; liveUrl: string; firstPublishedAt: Date; byline: null };

const db = vi.hoisted(() => ({
  site: null as { siteId: string; domain: string; host: string } | null,
  pages: [] as Page[],
  sites: 0,
}));

vi.mock("next/navigation", async (importOriginal) => ({ ...(await importOriginal<object>()), usePathname: () => "/" }));
vi.mock("@/lib/publish/destinations/hosted/store", () => ({
  hostedSiteForDomain: async () => db.site,
  hostedHostOfSite: async () => "content.reachkit.app",
  livePagesForSite: async () => db.pages,
}));
vi.mock("@/lib/scan/gallery", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/scan/gallery")>()),
  isListed: async () => true,
  listedCard: async () => ({ score: 62, hasLogo: false }),
  scannedSites: async () => db.sites,
}));

const { default: LandingPage, metadata } = await import("@/app/(public)/page");
const { copy } = await import("@/lib/presentation/copy");
const { SPECIMEN_HERO_BUSINESS, SPECIMEN_HERO_DOMAIN, SPECIMEN_HERO_RIVAL } = await import("@/app/(public)/_landing/specimen");
const { BUSINESS_KIND_NAMES } = await import("@/lib/market/kinds");

/** Every row the old proof card read is stored: ReachKit's own listed report, its articles, and 127 sites. */
function stored(): void {
  db.site = { siteId: "site-1", domain: "reachkit.app", host: "blog.reachkit.app" };
  db.pages = [{ title: "The newest article", liveUrl: "https://content.reachkit.app/newest", firstPublishedAt: new Date(Date.UTC(2026, 9, 17)), byline: null }];
  db.sites = 127;
}

/** The settled document, each streamed boundary put back where its placeholder sits, as the browser does. */
async function settle(tree: React.ReactElement): Promise<HTMLElement> {
  const page = parse(await settledMarkup(tree));
  for (const done of page.querySelectorAll('div[hidden][id^="S:"]')) {
    const slot = page.querySelector(`template[id="B:${done.id.slice(2)}"]`);
    slot?.replaceWith(done.innerHTML);
    done.remove();
  }
  return parse(page.toString());
}

const render = (Page: typeof LandingPage = LandingPage) => settle(React.createElement(Page, { searchParams: {} }));

/** An element's words, one space between elements, entities decoded. */
const flat = (el: HTMLElement): string => parse(el.toString().replace(/</g, " <")).text.replace(/\s+/g, " ").trim();

const hero = (page: HTMLElement): HTMLElement => page.querySelector("section#landing-field")!;
const column = (page: HTMLElement): HTMLElement => page.querySelector("h1")!.parentNode as HTMLElement;
const kids = (el: HTMLElement): HTMLElement[] => el.childNodes.filter((n): n is HTMLElement => n.nodeType === 1);
/** The count row: the column's child that draws the scan-search tile. */
const scannedRow = (page: HTMLElement): HTMLElement | null => kids(column(page)).find((el) => el.querySelector("svg.lucide-scan-search") !== null) ?? null;
const frames = (page: HTMLElement): HTMLElement[] => page.querySelectorAll('[data-testid="landing-story"] ol > li');
/** A frame's picture card: the last element of its row. */
const mini = (li: HTMLElement): HTMLElement => kids(li).at(-1)!;

beforeEach(() => stored());

describe("the hero, in the board's order", () => {
  it("h1, subline, the one field, the offer, the count row, the kinds, then the story card", async () => {
    const html = hero(await render()).toString();
    const at = ["<h1", copy("landing.subline"), "<form", copy("landing.hero.offer.free"), copy("landing.hero.proof.scanned.line"), copy("landing.hero.kinds.label"), 'data-testid="landing-story"'].map((m) =>
      html.indexOf(m),
    );
    expect(at.every((n) => n > -1), at.join(",")).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });

  it("the offer and the proof card share the field's column; the story card is the other column", async () => {
    const page = await render();
    const col = column(page);
    expect(kids(col).map((el) => el.rawTagName)).toEqual(["h1", "p", "div", "ul", "div", "div"]);
    expect(col.querySelector("form")).not.toBeNull();
    expect(col.querySelector('[data-testid="landing-story"]')).toBeNull();
    expect(kids(col.parentNode as HTMLElement).at(-1)!.getAttribute("data-testid")).toBe("landing-story");
  });

  it("the offer is two tick lines in a row from sm: the free scan and first page, then the price, cancel any time", async () => {
    const offer = kids(column(await render())).find((el) => el.rawTagName === "ul")!;
    expect(["sm:flex-row", "sm:gap-6"].every((c) => offer.classList.contains(c))).toBe(true);
    const lines = offer.querySelectorAll("li");
    expect(lines.map(flat)).toEqual([copy("landing.hero.offer.free"), copy("landing.hero.offer.price", { price: copy("price.amount") })]);
    for (const li of lines) {
      expect(["text-base", "font-semibold", "text-base-content"].every((c) => li.classList.contains(c))).toBe(true);
      const tick = li.querySelector("svg.lucide-check")!;
      expect([tick.getAttribute("width"), tick.classList.contains("text-success")]).toEqual(["20", true]);
    }
  });

  it("the field and Scan my site are 56px inside one 2px primary edge, under a bold label", async () => {
    const form = column(await render()).querySelector("form")!;
    expect(form.querySelector("label")!.classNames).toBe("text-base font-bold");
    const group = form.querySelector("input")!.parentNode as HTMLElement;
    expect(["border-2", "border-primary"].every((c) => group.classList.contains(c))).toBe(true);
    expect(form.querySelector("input")!.classList.contains("input-lg")).toBe(true);
    expect(["btn", "btn-primary", "btn-lg"].every((c) => form.querySelector('button[type="submit"]')!.classList.contains(c))).toBe(true);
  });

  it("the one h1 is the owner's headline in the hero class, and the subline under it is one sentence of at most 15 words", async () => {
    const page = await render();
    expect(page.querySelectorAll("h1").map(flat)).toEqual(["Get found where your competitors are and customers search."]);
    expect(page.querySelector("h1")!.classNames).toBe("t-hero");
    const subline = copy("landing.subline");
    expect(flat(kids(column(page))[1]!)).toBe(subline);
    expect(subline.match(/[.!?](?=\s|$)/g)).toHaveLength(1);
    expect(subline.split(/\s+/).length).toBeLessThanOrEqual(15);
  });

  it("the <title> keeps the search phrase the question headline gave up (seo-master)", () => {
    expect(String(metadata.title)).toMatch(/^Get found on Google/);
  });

  it("names no engine but Google and AI, and says found, never recommends or ranks", async () => {
    const words = flat(hero(await render()));
    expect(words).not.toMatch(/Perplexity|Gemini|Copilot|Claude|Bing/);
    expect(words).not.toMatch(/recommend|\brank/i);
  });
});

describe("the count row draws only a count of 100 or more", () => {
  it("from 100 sites scanned, the count rounded down to a ten beside its tile, no card and no link", async () => {
    for (const [sites, shown] of [[100, "100"], [127, "120"], [1004, "1000"]] as const) {
      db.sites = sites;
      const row = scannedRow(await render())!;
      expect(flat(row)).toBe(`${copy("landing.hero.proof.scanned", { count: shown })} ${copy("landing.hero.proof.scanned.line")}`);
      expect(row.querySelectorAll(".card, a")).toHaveLength(0);
      expect(row.querySelector(".text-lg.font-bold")!.text).toBe(copy("landing.hero.proof.scanned", { count: shown }));
      expect(row.querySelector(".text-sm")!.text).toBe(copy("landing.hero.proof.scanned.line"));
    }
  });

  it("below 100 sites scanned, or with no count read, there is no row and nothing in its place", async () => {
    for (const sites of [99, 0]) {
      db.sites = sites;
      const page = await render();
      expect(scannedRow(page)).toBeNull();
      expect(kids(column(page)).map((el) => el.rawTagName)).toEqual(["h1", "p", "div", "ul", "div"]);
    }
  });

  it("with ReachKit's report listed and its articles stored, the hero names neither", async () => {
    const section = hero(await render());
    expect(flat(section)).not.toMatch(/We run ReachKit on|Our blog is written by ReachKit/);
    expect(section.querySelectorAll('a[href^="/scan/"], a[href="#articles"]')).toHaveLength(0);
  });
});

describe("the six kinds of business", () => {
  it("under the count row, the label and the gallery's six kinds in its order, each a large soft badge and no link", async () => {
    const kinds = kids(column(await render())).at(-1)!;
    expect(flat(kinds.querySelector("p")!)).toBe(copy("landing.hero.kinds.label"));
    expect(kinds.querySelectorAll("li").map(flat)).toEqual(BUSINESS_KIND_NAMES.map((kind) => copy(`gallery.kind.${kind}` as never)));
    for (const li of kinds.querySelectorAll("li")) expect(["badge", "badge-soft", "badge-primary", "badge-lg"].every((c) => li.classList.contains(c))).toBe(true);
    expect(kinds.querySelectorAll("a")).toHaveLength(0);
  });
});

describe("the story card: four frames, the board's words and no footer", () => {
  it("the header names the example business beside its own mark, its letter where no logo is stored", async () => {
    const header = kids((await render()).querySelector('[data-testid="landing-story"]')!)[1]!;
    expect(flat(header)).toBe(`${SPECIMEN_HERO_DOMAIN[0]!.toUpperCase()} ${SPECIMEN_HERO_BUSINESS} ${SPECIMEN_HERO_DOMAIN} ${copy("landing.story.autopilot")}`);
  });

  const board = (name: string) => parse(readFileSync(boardFile(name), "utf8")).querySelector("figure[id^=hero-]")!;
  const count = (el: HTMLElement): number => words(flat(el)).length;

  it("competitors found, we research, we write pages, you get found, each titled with when it happens", async () => {
    const drawn = frames(await render());
    expect(drawn).toHaveLength(4);
    drawn.forEach((li, i) => {
      const text = flat(li);
      expect(text, `frame ${i + 1}`).toContain(copy(`landing.story.${i + 1}.title` as never));
      expect(text, `frame ${i + 1}`).toContain(copy(`landing.story.${i + 1}.when` as never));
    });
  });

  it("each frame says as many words as the board's frame", async () => {
    const drawn = frames(await render()).map(count);
    for (const name of ["PubLanding", "PubLandingPhone"]) expect(drawn, name).toEqual(board(name).querySelectorAll("ol > li").map(count));
  });

  it("frame 1 lights the competitor above a dashed You; frame 4 lights you with You beside it and dims the competitor", async () => {
    const [first, , , last] = frames(await render()).map(mini);
    const slot = first!.querySelector(".border-dashed")!;
    expect(flat(slot)).toBe(`– ${copy("landing.story.you")}`);
    expect(slot.querySelector("[data-unmeasured]")).not.toBeNull();
    expect(slot.hasAttribute("aria-hidden")).toBe(false);
    expect(flat(first!.querySelector(".bg-primary")!)).toBe(`1 ${SPECIMEN_HERO_RIVAL}`);
    expect(flat(last!.querySelector(".bg-primary")!)).toBe(`1 ${SPECIMEN_HERO_DOMAIN} ${copy("landing.story.you")}`);
    const ghost = last!.querySelectorAll(".border").at(-1)!;
    expect(flat(ghost)).toBe(`2 ${SPECIMEN_HERO_RIVAL}`);
    expect(ghost.classList.contains("text-base-content/70")).toBe(true);
  });

  it("the week is one of seven live, and Live, Tomorrow and Planned each say their word", async () => {
    const week = mini(frames(await render())[2]!);
    const bar = week.querySelector("progress")!;
    expect([bar.getAttribute("value"), bar.getAttribute("max")]).toEqual(["1", "7"]);
    for (const key of ["landing.story.3.live", "landing.story.3.next", "landing.story.3.planned"] as const) expect(flat(week)).toContain(copy(key));
  });

  it("the card's title is for screen readers only, it ends with frame 4, and it never says SEO", async () => {
    const card = (await render()).querySelector('[data-testid="landing-story"]')!;
    expect(card.querySelector("h2.sr-only")!.text).toBe(copy("landing.story.title"));
    expect(flat(card).endsWith(flat(card.querySelectorAll("ol > li")[3]!))).toBe(true);
    expect(flat(card)).not.toContain("Not a promise");
    expect(flat(card)).not.toMatch(/SEO/);
  });

  it("every mini draws the dark-safe edge", async () => {
    for (const li of frames(await render())) expect(mini(li).classList.contains("border-base-content/20")).toBe(true);
  });
});

describe("one example business on the whole page", () => {
  it("no plumber anywhere in the markup, and every domain the page shows ends in .example", async () => {
    const page = await render();
    expect(page.toString()).not.toMatch(/austin|plumb|harbor/i);
    // The field's placeholder is a hint, not an example business.
    page.querySelector("form")!.remove();
    const domains = (segments(page.querySelector("main")!.toString()).join(" ").match(/\b[\w-]+(?:\.[\w-]+)+\b/g) ?? []).filter((d) => /[a-z]$/i.test(d));
    expect(domains.length).toBeGreaterThan(0);
    expect(domains.filter((d) => !d.endsWith(".example"))).toEqual([]);
  });
});

describe("the walkthrough band", () => {
  it("with no video file there is no band, no heading and no player", async () => {
    const page = await render();
    expect(page.text).not.toContain(copy("landing.walkthrough.heading"));
    expect(page.text).not.toContain(copy("landing.walkthrough.eyebrow"));
    expect(page.querySelector("video")).toBeNull();
  });

  it("with a file, the band, its heading and the player follow the hero and come before How it works", async () => {
    vi.resetModules();
    vi.doMock("@/app/(public)/_landing/Walkthrough", async (importOriginal) => ({
      ...(await importOriginal<object>()),
      WALKTHROUGH_SRC: "/walkthrough.mp4",
    }));
    const { default: WithVideo } = await import("@/app/(public)/page");
    const html = (await render(WithVideo)).toString();
    const at = ['id="landing-field"', copy("landing.walkthrough.eyebrow"), copy("landing.walkthrough.heading"), '<video controls="" preload="none" src="/walkthrough.mp4"', 'id="how"'].map(
      (m) => html.indexOf(m),
    );
    expect(at.every((n) => n > -1), at.join(",")).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    vi.doUnmock("@/app/(public)/_landing/Walkthrough");
  });
});

describe("design parity above How it works", () => {
  // With rows stored, a stored-rows allow line excuses nothing: every string is drawn.
  for (const name of ["PubLanding", "PubLandingPhone"]) {
    it(`${name}: the hero's every board string is drawn`, async () => {
      const drawn = parse(readFileSync(boardFile(name), "utf8")).querySelector('section[aria-labelledby="hero"]')!;
      const allow = readAllow(name).filter((a: { reason: string }) => !/seeds none/.test(a.reason));
      expect(compare(drawn.toString(), segments(hero(await render()).toString()), allow).missing).toEqual([]);
    });
  }
});
