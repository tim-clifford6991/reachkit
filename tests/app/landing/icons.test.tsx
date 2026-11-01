// The landing draws the icons boards PubLanding and PubLandingPhone name, one
// per concept (AI is sparkles, your business is building-2), the proof card's
// report row draws the site's mark and states its stored score in text, the
// kinds row draws the gallery's six, and the FAQ's questions carry none.
// The store and the gallery are the database seam; nothing else is replaced.
import "../../generate/env";
import React from "react";
import { parse, type HTMLElement } from "node-html-parser";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { settledMarkup } from "../shell/settled";

const db = vi.hoisted(() => ({
  listed: new Map<string, number | null>(),
}));

vi.mock("@/lib/publish/destinations/hosted/store", () => ({
  hostedSiteForDomain: async () => null,
  hostedHostOfSite: async () => null,
  livePagesForSite: async () => [],
}));
vi.mock("@/lib/scan/gallery", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/scan/gallery")>()),
  isListed: async (domain: string) => db.listed.has(domain),
  listedCard: async (domain: string) => {
    const score = db.listed.get(domain) ?? null;
    return score === null ? null : { score, hasLogo: false };
  },
}));

const { default: LandingPage } = await import("@/app/(public)/page");
const { copy } = await import("@/lib/presentation/copy");
const { SPECIMEN_HERO_BUSINESS } = await import("@/app/(public)/_landing/specimen");

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

/** The lucide name each `svg.lucide` under `el` draws, in document order; the last class is the canonical name. */
const glyphs = (el: HTMLElement): string[] =>
  el.querySelectorAll("svg.lucide").map((svg) => {
    const name = svg.classList.value.filter((c) => c.startsWith("lucide-")).at(-1);
    expect(svg.getAttribute("aria-hidden"), name).toBe("true");
    return name!.slice("lucide-".length);
  });

beforeEach(() => {
  db.listed = new Map([["podia.com", 62]]);
});

describe("the landing's icons are the boards'", () => {
  const story = async () => (await render()).querySelector('[data-testid="landing-story"]')!;
  const minis = (card: HTMLElement) => card.querySelectorAll("ol > li").map((li) => li.querySelector(":scope > div")!);

  it("the story card's four nodes draw search, scan-search, file-text, trending-up in order", async () => {
    const nodes = (await story()).querySelectorAll("ol > li > span.rounded-full");
    expect(nodes.map(glyphs)).toEqual([["search"], ["scan-search"], ["file-text"], ["trending-up"]]);
    expect(nodes.map((node) => node.querySelector("svg")!.getAttribute("width"))).toEqual(["18", "18", "18", "18"]);
  });

  it("the header draws the business's own mark, no icon; each frame's picture draws the board's icons", async () => {
    const card = await story();
    expect(glyphs(card.querySelector(":scope > div")!)).toEqual([]);
    expect(minis(card).map(glyphs)).toEqual([
      ["search", "sparkles"],
      ["building-2", "users", "search", "sparkles"],
      ["file-text", "circle-check", "file-text", "clock", "file-text", "calendar"],
      ["search", "sparkles"],
    ]);
    expect(card.querySelector("figcaption")).toBeNull();
  });

  it("only the live page's file is primary; the dashed slot and the dimmed competitor keep their contrast", async () => {
    const [first, , week, last] = minis(await story());
    const files = week!.querySelectorAll("svg.lucide-file-text");
    expect(files.map((svg) => svg.classList.contains("text-primary"))).toEqual([true, false, false]);
    expect(first!.querySelector(".border-dashed")!.classList.contains("border-base-content/50")).toBe(true);
    expect(last!.querySelectorAll(".text-base-content\\/70").length).toBeGreaterThan(0);
    expect(week!.querySelector(".badge-success")!.classList.contains("badge-soft")).toBe(true);
  });

  it("the Why cards' tiles: sparkles, search", async () => {
    const cards = (await render()).querySelectorAll("section#why li.card");
    expect(cards.map((card) => glyphs(card.querySelector("h3")!))).toEqual([["sparkles"], ["search"]]);
  });

  it("the AI card draws who is mentioned and who is not", async () => {
    const drawing = (await render()).querySelectorAll("section#why li.card")[0]!.querySelector("[data-demo]")!;
    const head = drawing.querySelectorAll("p").find((p) => p.text.includes(copy("landing.feature.ai.mentions")))!;
    expect(glyphs(head)).toEqual(["sparkles"]);
    const named = drawing.querySelectorAll("ul > li");
    expect(named.map(glyphs)).toEqual([["circle-check"], ["circle-check"]]);
    expect(drawing.querySelector("ul svg.lucide-circle-x")).toBeNull();
    const missing = drawing.querySelector("svg.lucide-circle-x")!.parentNode as HTMLElement;
    expect(missing.text).toContain(copy("landing.feature.ai.you", { you: SPECIMEN_HERO_BUSINESS }));
    expect(missing.classList.contains("text-error")).toBe(true);
  });

  it("the proof card's report row draws the site's mark and states the score; unscored, no row", async () => {
    const row = () => render().then((page) => page.querySelector('#landing-field a[href="/scan/podia.com"]'));
    const scored = (await row())!;
    expect(scored.querySelector(".radial-progress")).toBeNull();
    expect(scored.querySelector("span.badge[aria-hidden]")!.text).toBe("P");
    expect(scored.text).toContain(copy("landing.hero.proof.report", { domain: "podia.com", score: "62" }));
    expect(scored.querySelectorAll(".skeleton")).toHaveLength(0);

    db.listed = new Map([["podia.com", null]]);
    expect(await row()).toBeNull();
  });

  it("the kinds row draws the gallery's six icons: wrench, store, utensils, briefcase, laptop, video", async () => {
    const kinds = (await render()).querySelector('#landing-field ul[aria-labelledby="kinds"]')!;
    expect(kinds.querySelectorAll("li").map(glyphs)).toEqual([["wrench"], ["store"], ["utensils"], ["briefcase"], ["laptop"], ["video"]]);
  });

  it("the FAQ summaries carry no lucide icon", async () => {
    const summaries = (await render()).querySelectorAll("section#faq details > summary");
    expect(summaries.length).toBeGreaterThan(0);
    for (const summary of summaries) expect(summary.querySelector("svg"), summary.text).toBeNull();
  });
});
