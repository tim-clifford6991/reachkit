// The landing draws the icons boards PubLanding and PubLandingPhone name, one
// per concept (AI is sparkles, your business is building-2), the real report's
// card draws its stored score as a ring and states it in text, and the FAQ's
// questions carry none.
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
  listedScore: async (domain: string) => db.listed.get(domain) ?? null,
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
  it("the story card's four frames draw search, scan-search, file-text, trending-up in order, each at chrome size", async () => {
    const frames = (await render()).querySelectorAll('[data-testid="landing-story"] ol > li');
    const nodes = frames.map((li) => li.querySelector(".timeline-middle")!);
    expect(nodes.map(glyphs)).toEqual([["search"], ["scan-search"], ["file-text"], ["trending-up"]]);
    expect(nodes.map((node) => node.querySelector("svg")!.getAttribute("width"))).toEqual(["20", "20", "20", "20"]);
  });

  it("we research draws your business and your competitors; one page is live and the other is a bare page", async () => {
    const frames = (await render()).querySelectorAll('[data-testid="landing-story"] ol > li');
    expect(glyphs(frames[1]!.querySelector(".timeline-end")!)).toEqual(["building-2", "users"]);
    expect(glyphs(frames[2]!.querySelector(".timeline-end")!)).toEqual(["file-text", "file-text"]);
    expect(frames[2]!.querySelectorAll(".timeline-end svg")[1]!.classList.contains("text-base-content/70")).toBe(true);
  });

  it("the empty slot, the dimmed rival and Live are drawn on the white picture card so each shows", async () => {
    const frames = (await render()).querySelectorAll('[data-testid="landing-story"] ol > li');
    const onMini = (el: HTMLElement) => (el.parentNode as HTMLElement).classList.contains("bg-base-100");
    const slot = frames[0]!.querySelector(".border-dashed")!;
    expect(slot.classList.contains("border-base-content/50")).toBe(true);
    expect(onMini(slot)).toBe(true);
    const rival = frames[3]!.querySelector(".badge-ghost")!;
    expect(rival.classList.contains("text-base-content/70")).toBe(true);
    expect(onMini(rival)).toBe(true);
    const live = frames[2]!.querySelector(".badge-success")!;
    expect(live.classList.contains("badge-soft")).toBe(true);
    expect(frames.map((li) => li.querySelectorAll(".bg-base-100").length)).toEqual([1, 1, 1, 1]);
  });

  it("the Why cards' tiles: sparkles, search, wrench, file-text", async () => {
    const cards = (await render()).querySelectorAll("section#why li.card");
    expect(cards.map((card) => glyphs(card.querySelector("h3")!))).toEqual([["sparkles"], ["search"], ["wrench"], ["file-text"]]);
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

  it("the real report's card draws its score ring and states the score; unscored, neither", async () => {
    const card = () => render().then((page) => page.querySelector('section[aria-labelledby="proof"] a[href="/scan/podia.com"]')!);
    const scored = await card();
    const ring = scored.querySelector(".radial-progress")!;
    expect(ring.getAttribute("aria-hidden")).toBe("true");
    expect(ring.getAttribute("style")).toContain("--value:62");
    expect(scored.text).toContain(`${copy("verdict.score.label")} 62 ${copy("verdict.score.of")}`);
    expect(scored.querySelectorAll(".skeleton")).toHaveLength(0);

    db.listed = new Map([["podia.com", null]]);
    const unscored = await card();
    expect(unscored.querySelector(".radial-progress")).toBeNull();
    expect(unscored.text).not.toContain(copy("verdict.score.of"));
    expect(unscored.text).not.toContain("62");
    expect(unscored.text).toContain(copy("about.proof.open"));
  });

  it("the FAQ summaries carry no lucide icon", async () => {
    const summaries = (await render()).querySelectorAll("section#faq details > summary");
    expect(summaries.length).toBeGreaterThan(0);
    for (const summary of summaries) expect(summary.querySelector("svg"), summary.text).toBeNull();
  });
});
