/** @vitest-environment jsdom */
// The landing above How it works, as boards PubLanding and PubLandingPhone v36
// draw it: the hero in the board's order, a proof card drawn only from stored
// rows, the six kinds of business, the story card's four frames, the
// walkthrough band once its file exists, and no announcement bar on this page
// alone.
// The store and the gallery are the database seam; nothing else is replaced.
import "../../generate/env";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parse, type HTMLElement } from "node-html-parser";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { boardFile, compare, readAllow, segments, words } from "../../../scripts/design/parity.mjs";
import { settledMarkup } from "../shell/settled";

type Page = { title: string; liveUrl: string; firstPublishedAt: Date; byline: null };

const db = vi.hoisted(() => ({
  site: null as { siteId: string; domain: string; host: string } | null,
  pages: [] as Page[],
  listed: new Map<string, number | null>(),
  logo: false,
}));

vi.mock("next/navigation", async (importOriginal) => ({ ...(await importOriginal<object>()), usePathname: () => "/" }));
vi.mock("@/lib/publish/destinations/hosted/store", () => ({
  hostedSiteForDomain: async () => db.site,
  hostedHostOfSite: async () => "content.reachkit.app",
  livePagesForSite: async () => db.pages,
}));
vi.mock("@/lib/scan/gallery", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/scan/gallery")>()),
  isListed: async (domain: string) => db.listed.has(domain),
  listedCard: async (domain: string) => {
    const score = db.listed.get(domain) ?? null;
    return score === null ? null : { score, hasLogo: db.logo };
  },
}));

const { default: LandingPage, metadata } = await import("@/app/(public)/page");
const { default: PricingPage } = await import("@/app/(public)/pricing/page");
const { Header } = await import("@/app/(public)/_chrome/Header");
const { copy } = await import("@/lib/presentation/copy");
const { SPECIMEN_HERO_BUSINESS, SPECIMEN_HERO_DOMAIN, SPECIMEN_HERO_RIVAL } = await import("@/app/(public)/_landing/specimen");
const { BUSINESS_KIND_NAMES } = await import("@/lib/market/kinds");

function stored(score: number | null = 62): void {
  db.logo = false;
  db.site = { siteId: "site-1", domain: "reachkit.app", host: "blog.reachkit.app" };
  db.pages = [{ title: "The newest article", liveUrl: "https://content.reachkit.app/newest", firstPublishedAt: new Date(Date.UTC(2026, 9, 17)), byline: null }];
  db.listed = new Map([["podia.com", score]]);
}

function nothingStored(): void {
  db.site = null;
  db.pages = [];
  db.listed = new Map();
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
const proof = (page: HTMLElement): HTMLElement | null =>
  kids(column(page)).find((el) => el.querySelector('a[href^="/scan/"], a[href="#articles"]') !== null) ?? null;
const frames = (page: HTMLElement): HTMLElement[] => page.querySelectorAll('[data-testid="landing-story"] ol > li');
/** A frame's picture card: the last element of its row. */
const mini = (li: HTMLElement): HTMLElement => kids(li).at(-1)!;

beforeEach(() => stored());

describe("the hero, in the board's order", () => {
  it("h1, subline, the one field, the offer, the proof card, the kinds, then the story card", async () => {
    const html = hero(await render()).toString();
    const at = ["<h1", copy("landing.subline"), "<form", copy("landing.hero.offer.free"), 'href="/scan/podia.com"', copy("landing.hero.kinds.label"), 'data-testid="landing-story"'].map((m) =>
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

  it("the offer is two tick lines: the free scan and first page, then the price, cancel any time", async () => {
    const offer = kids(column(await render())).find((el) => el.rawTagName === "ul")!;
    const lines = offer.querySelectorAll("li");
    expect(lines.map(flat)).toEqual([copy("landing.hero.offer.free"), copy("landing.hero.offer.price", { price: copy("price.amount") })]);
    expect(lines.map((li) => li.querySelectorAll("svg.lucide-check").length)).toEqual([1, 1]);
  });

  it("the one h1 is the headline, and the subline under it is one sentence of at most 15 words", async () => {
    const page = await render();
    expect(page.querySelectorAll("h1").map(flat)).toEqual([copy("landing.headline")]);
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

describe("the proof card draws only stored rows", () => {
  it("listed with an article: the report row, then the blog row, each a whole-row link with a chevron", async () => {
    const page = await render();
    const rows = proof(page)!.querySelectorAll("a");
    expect(rows.map((a) => a.getAttribute("href"))).toEqual(["/scan/podia.com", "#articles"]);
    expect(rows.map(flat)).toEqual([
      `P ${copy("landing.hero.proof.report", { domain: "podia.com", score: "62" })} ${copy("landing.hero.proof.report.open")}`,
      `${copy("landing.hero.proof.blog")} ${copy("landing.hero.proof.blog.open")}`,
    ]);
    expect(rows.map((a) => a.querySelectorAll("svg.lucide-chevron-right").length)).toEqual([1, 1]);
    expect(page.querySelector("section#articles")).not.toBeNull();
  });

  it("the score is the stored row's: 71 stored is 71 drawn", async () => {
    stored(71);
    const report = proof(await render())!.querySelector('a[href="/scan/podia.com"]')!;
    expect(flat(report)).toContain(copy("landing.hero.proof.report", { domain: "podia.com", score: "71" }));
  });

  it("the report row draws podia.com's stored logo, or its letter where none is stored", async () => {
    const mark = async () => proof(await render())!.querySelector('a[href="/scan/podia.com"] > span[aria-hidden]')!;
    expect(flat(await mark())).toBe("P");
    db.logo = true;
    expect((await mark()).querySelector("img")!.getAttribute("src")).toBe("/scans/logo/podia.com");
  });

  it("a report no longer listed, or listed without a score, is no row; the blog row stays", async () => {
    for (const listed of [new Map(), new Map([["podia.com", null]])]) {
      db.listed = listed;
      const card = proof(await render())!;
      expect(card.querySelector('a[href^="/scan/"]')).toBeNull();
      expect(card.querySelectorAll("a")).toHaveLength(1);
    }
  });

  it("with nothing stored there is no card, never a placeholder or a 0", async () => {
    nothingStored();
    const page = await render();
    expect(proof(page)).toBeNull();
    expect(kids(column(page)).map((el) => el.rawTagName)).toEqual(["h1", "p", "div", "ul", "div"]);
  });
});

describe("the six kinds of business", () => {
  it("under the proof card, the label and the gallery's six kinds in its order", async () => {
    const kinds = kids(column(await render())).at(-1)!;
    expect(flat(kinds.querySelector("p")!)).toBe(copy("landing.hero.kinds.label"));
    expect(kinds.querySelectorAll("li").map(flat)).toEqual(BUSINESS_KIND_NAMES.map((kind) => copy(`gallery.kind.${kind}` as never)));
  });
});

describe("the story card: four frames, the board's words and no footer", () => {
  it("the header names the example business beside its own mark, its letter where no logo is stored", async () => {
    const header = kids((await render()).querySelector('[data-testid="landing-story"]')!)[1]!;
    expect(flat(header)).toBe(`${SPECIMEN_HERO_DOMAIN[0]!.toUpperCase()} ${SPECIMEN_HERO_BUSINESS} ${SPECIMEN_HERO_DOMAIN} ${copy("landing.story.autopilot")}`);
  });

  const board = (name: string) => parse(readFileSync(boardFile(name), "utf8")).querySelector("figure[id^=hero-]")!;
  const names = new Set<string>([SPECIMEN_HERO_DOMAIN, SPECIMEN_HERO_RIVAL].flatMap((d) => words(d)));
  const count = (el: HTMLElement): number => words(flat(el)).filter((w: string) => !names.has(w)).length;

  it("competitors found, we research, we write pages, you get found, each titled with when it happens", async () => {
    const drawn = frames(await render());
    expect(drawn).toHaveLength(4);
    drawn.forEach((li, i) => {
      const text = flat(li);
      expect(text, `frame ${i + 1}`).toContain(copy(`landing.story.${i + 1}.title` as never));
      expect(text, `frame ${i + 1}`).toContain(copy(`landing.story.${i + 1}.when` as never));
    });
  });

  it("each frame says as many words as the board's frame, besides the example names", async () => {
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
    expect(flat(card)).not.toContain(copy("landing.hero.example"));
    expect(flat(card)).not.toMatch(/SEO/);
  });

  it("every mini draws the dark-safe edge", async () => {
    for (const li of frames(await render())) expect(mini(li).classList.contains("border-base-content/20")).toBe(true);
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

describe("the announcement bar is gone on the landing only", () => {
  /** The banner's own hiding rule, read from its class as Tailwind writes it, run on the whole document. */
  async function bannerHidden(page: React.ReactElement): Promise<boolean> {
    const header = renderToStaticMarkup(React.createElement(Header));
    const document = new DOMParser().parseFromString(`<body>${header}${(await settle(page)).toString()}</body>`, "text/html");
    const banner = document.querySelector('[data-testid="public-banner"]')!;
    const rules = [...banner.classList].filter((c) => /^\[.*&\]:hidden$/.test(c)).map((c) => c.slice(1, -"]:hidden".length).replace(/_/g, " "));
    return rules.some((rule) => document.querySelector(rule.replace("&", '[data-testid="public-banner"]')) !== null);
  }

  it("/ hides it, and /pricing still shows it", async () => {
    expect(await bannerHidden(React.createElement(LandingPage, { searchParams: {} }))).toBe(true);
    expect(await bannerHidden(React.createElement(PricingPage, { searchParams: {} }))).toBe(false);
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
