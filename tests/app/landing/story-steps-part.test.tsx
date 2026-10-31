// The landing's story card, three steps and the owner's part as boards
// PubLanding and PubLandingPhone draw them: each section's strings, in the
// board's order. The "node" project, `renderToStaticMarkup`, the real registry.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import LandingPage, { metadata } from "@/app/(public)/page";
import { HOW_FACTS } from "@/app/(public)/_how/facts";
import { SPECIMEN_HERO_DOMAIN, SPECIMEN_HERO_PLACE, SPECIMEN_HERO_RIVAL } from "@/app/(public)/_landing/specimen";
import { boardFile, compare, readAllow, segments } from "../../../scripts/design/parity.mjs";

const markup = renderToStaticMarkup(React.createElement(LandingPage, { searchParams: {} }));
const PLACE = { place: SPECIMEN_HERO_PLACE };

/** React escapes these five in text; a sentence is looked for as it is drawn. */
const drawn = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");

function between(from: string, to: string): string {
  const a = markup.indexOf(from);
  const b = markup.indexOf(to, a);
  expect(a, from).toBeGreaterThan(-1);
  expect(b, to).toBeGreaterThan(a);
  return markup.slice(a, b);
}

/** Every sentence is in `html`, each after the one before it. */
function inOrder(html: string, sentences: readonly string[]): void {
  let from = 0;
  for (const s of sentences) {
    const at = html.indexOf(drawn(s), from);
    expect(at, s).toBeGreaterThan(-1);
    from = at + 1;
  }
}

/** The text of a block-level element, as one line. */
const text = (html: string): string => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

describe("the hero says the owner's headline and a one-sentence subline (owner O1, O2)", () => {
  const hero = between('id="landing-field"', 'id="how"');

  it("the one h1 is the headline, and the subline under it is one sentence of at most 15 words", () => {
    expect(markup.match(/<h1[^>]*>(.*?)<\/h1>/g)).toEqual([`<h1 class="t-hero">${drawn(copy("landing.headline"))}</h1>`]);
    const subline = copy("landing.subline");
    expect(hero).toContain(drawn(subline));
    expect(subline.match(/[.!?](?=\s|$)/g)).toHaveLength(1);
    expect(subline.split(/\s+/).length).toBeLessThanOrEqual(15);
  });

  it("the <title> keeps the search phrase the question headline gave up (seo-master)", () => {
    expect(String(metadata.title)).toMatch(/^Get found on Google/);
  });

  it("names no engine but Google and AI, and says found, never recommends or ranks", () => {
    const words = text(hero);
    expect(words).not.toMatch(/Perplexity|Gemini|Copilot|Claude|Bing/);
    expect(words).not.toMatch(/recommend|\brank/i);
  });
});

describe("the story card tells the hero's story in four frames and as few words as possible (owner O3)", () => {
  const card = between('data-testid="landing-story"', 'id="how"');
  const frames = card.slice(0, card.indexOf("</ol>")).split("<li>").slice(1);
  const words = (html: string): string[] => text(html).split(" ").filter(Boolean);

  it("rival found, we research, we write pages, you get found: four frames in that order", () => {
    expect(frames).toHaveLength(4);
    frames.forEach((frame, i) => expect(frame, `frame ${i + 1}`).toContain(drawn(copy(`landing.story.${i + 1}.title` as CopyKey))));
  });

  it("each frame shows at most four words besides the example names", () => {
    const names = new Set([SPECIMEN_HERO_DOMAIN, SPECIMEN_HERO_RIVAL]);
    frames.forEach((frame, i) => expect(words(frame).filter((w) => !names.has(w)).length, `frame ${i + 1}`).toBeLessThanOrEqual(4));
  });

  it("the first answer lights the rival beside an empty slot; the last lights you and dims the rival", () => {
    const lit = (frame: string) => frame.match(/badge-primary[^>]*>(?:<[^>]*>)*([^<]+)/)?.[1];
    expect(lit(frames[0]!)).toBe(SPECIMEN_HERO_RIVAL);
    expect(frames[0]).toMatch(/border-dashed/);
    expect(lit(frames[3]!)).toBe(SPECIMEN_HERO_DOMAIN);
    expect(frames[3]).toMatch(new RegExp(`badge-ghost[^>]*>(?:<[^>]*>)*${SPECIMEN_HERO_RIVAL.replace(/\./g, "\\.")}`));
  });

  it("the card's title is for screen readers only, and its one caveat closes the card", () => {
    expect(card).toContain(`<h2 class="sr-only">${drawn(copy("landing.story.title"))}</h2>`);
    expect(card.split(drawn(copy("landing.hero.example")))).toHaveLength(2);
    expect(card).toMatch(new RegExp(`</ol><p[^>]*>${drawn(copy("landing.hero.example")).replace(/\./g, "\\.")}</p></div></div>`));
  });
});

describe("on a phone, the trust strip comes before the story card, with no second telling above the field", () => {
  it("the hero draws no step strip between the subline and the field", () => {
    const hero = between('id="landing-field"', 'data-testid="landing-story"');
    expect(hero).not.toMatch(/<ol class="steps/);
  });

  it("the trust strip comes before the story card in the page, and moves under both on a wide screen", () => {
    const trust = drawn(copy("landing.trust", { price: copy("price.amount"), checks: String(HOW_FACTS.checks) }));
    const at = markup.indexOf(trust);
    expect(at).toBeGreaterThan(-1);
    expect(at).toBeLessThan(markup.indexOf('data-testid="landing-story"'));
    const open = markup.lastIndexOf("<p", at);
    expect(markup.slice(open, at)).toMatch(/lg:order-last/);
    expect(markup.slice(open, at)).toMatch(/lg:col-span-2/);
  });
});

describe("the three steps", () => {
  const steps = between('id="how"', 'id="why"');

  it("the heading stays at six words (SPEC §0)", () => {
    expect(steps).toContain(drawn(copy("landing.start.heading")));
    expect(copy("landing.start.heading").split(/\s+/).length).toBeLessThanOrEqual(6);
  });

  it("step 3 names no go-live time, since each customer sets their own (SPEC §4)", () => {
    expect(copy("landing.step.3.body")).not.toMatch(/\d{1,2}:\d{2}|\b[AP]M\b/);
  });

  it("Monday in Inside ReachKit says what it checked for the example town's buyers, and counts nothing", () => {
    const inside = between('data-testid="landing-inside"', 'id="why"');
    const monday = copy("how.top.monday", { buyers: copy("landing.inside.buyers", PLACE) });
    expect(inside).toContain(drawn(monday));
    expect(monday).not.toMatch(/\d/);
  });
});

describe("after the steps: the loop, the owner's part, and two ways on", () => {
  const tail = between("</ol>", 'id="why"');
  const after = tail.slice(tail.indexOf(drawn(copy("landing.loop"))));

  it("the loop, the part strip's title, its three steps, what follows, the paragraph, then the two ways on", () => {
    inOrder(after, [
      copy("landing.loop"),
      copy("landing.part.once", { minutes: String(HOW_FACTS.setupMinutes) }),
      copy("landing.part.answer"),
      copy("how.part.three"),
      copy("landing.part.done"),
      copy("landing.part.after"),
      copy("landing.part.body"),
      copy("landing.start.cta"),
      copy("landing.how.full"),
    ]);
  });

  it("its button is soft and brings the field into view, never a second submit; the link opens How it works", () => {
    const button = after.match(/<button[^>]*>/)?.[0] ?? "";
    expect(button).toContain('type="button"');
    expect(button).toContain("btn-soft");
    expect(after).toMatch(new RegExp(`<a[^>]*href="/how-it-works"[^>]*>${drawn(copy("landing.how.full"))}`));
  });

  it("the steps section keeps a soft button only, so the hero's Scan stays the one solid", () => {
    expect(between('id="how"', 'id="why"')).not.toMatch(/class="btn btn-primary"/);
  });
});

describe("design parity on this half of the landing", () => {
  it("no hero, story-card, loop or part-strip string of either board is missing from the render", () => {
    const ship = segments(markup);
    const ours = [
      copy("landing.headline"),
      copy("landing.subline"),
      copy("landing.story.1.title"),
      copy("landing.story.3.live"),
      copy("landing.story.4.title"),
      copy("landing.hero.example"),
      copy("landing.loop"),
      copy("landing.part.answer"),
      copy("landing.how.full"),
    ].map((s) => s.toLowerCase());
    for (const board of ["PubLanding", "PubLandingPhone"]) {
      const { missing } = compare(readFileSync(boardFile(board), "utf8"), ship, readAllow(board));
      const ourMissing = missing.filter((s: string) => ours.some((o) => text(s).toLowerCase().includes(o)));
      expect(ourMissing, board).toEqual([]);
    }
  });
});
