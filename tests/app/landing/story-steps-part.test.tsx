// The landing's story card, three steps and the owner's part as boards
// PubLanding and PubLandingPhone draw them: each section's strings, in the
// board's order. The "node" project, `renderToStaticMarkup`, the real registry.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import LandingPage from "@/app/(public)/page";
import { HOW_FACTS } from "@/app/(public)/_how/facts";
import {
  SPECIMEN_HERO,
  SPECIMEN_HERO_BUSINESS,
  SPECIMEN_HERO_MORE_RIVALS,
  SPECIMEN_HERO_PLACE,
} from "@/app/(public)/_landing/specimen";
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

describe("the story card's five rows carry the example business's sample", () => {
  const card = between('data-testid="landing-story"', 'id="how"');

  it("we research it: what it does, who buys, and who they pick instead, with the count of the rest", () => {
    inOrder(card, [
      copy("landing.story.2.title"),
      copy("landing.story.2.what"),
      copy("landing.story.2.services"),
      copy("landing.story.2.who"),
      copy("landing.story.2.buyers", PLACE),
      copy("landing.story.2.rival"),
      copy("landing.story.2.more", { more: String(SPECIMEN_HERO_MORE_RIVALS) }),
      copy("landing.story.3.title"),
    ]);
  });

  it("pages go live: two dated pages, each live at the example hour, then the pace", () => {
    const live = drawn(copy("landing.story.3.live", { time: SPECIMEN_HERO.liveAt }));
    const row = between(drawn(copy("landing.story.3.title")), drawn(copy("landing.story.4.title")));
    expect(row.split(live)).toHaveLength(3);
    inOrder(row, [
      copy("landing.story.3.page.1", PLACE),
      copy("landing.story.3.page.2", PLACE),
      copy("landing.story.3.pace", { weekPages: String(HOW_FACTS.weekPages) }),
    ]);
  });

  it("found: the page in a result, then the AI answer that names the business", () => {
    const row = between(drawn(copy("landing.story.4.title")), drawn(copy("landing.story.5.title")));
    inOrder(row, [copy("overview.answers.page"), copy("landing.story.4.quote", { business: SPECIMEN_HERO_BUSINESS })]);
  });

  it("the business row: the owner's day, then a Monday email that needs nothing", () => {
    inOrder(card, [
      copy("landing.story.5.title"),
      copy("landing.story.5.line"),
      copy("landing.story.5.day"),
      copy("landing.story.5.job"),
      copy("landing.story.5.mail"),
      copy("pricing.week.mail.calm"),
      copy("landing.hero.example"),
    ]);
  });

  it("a row's name and line are one block, as the board draws them", () => {
    for (const n of [1, 2, 3, 4, 5]) {
      const name = drawn(copy(`landing.story.${n}.title` as CopyKey));
      const line = drawn(copy(`landing.story.${n}.line` as CopyKey));
      const block = card.match(new RegExp(`<p[^>]*>(?:(?!</p>).)*${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:(?!</p>).)*</p>`))?.[0] ?? "";
      expect(block, `row ${n}`).toContain(line);
    }
  });
});

describe("on a phone, a five-step strip sits under the subline and the trust strip before the story card", () => {
  it("the strip names the five frames in order, between the subline and the field, and is hidden on a wide screen", () => {
    const hero = between('id="landing-field"', 'data-testid="landing-story"');
    const strip = hero.match(/<ol class="steps[^"]*"[^>]*>.*?<\/ol>/)?.[0] ?? "";
    expect(strip).toContain("lg:hidden");
    inOrder(strip, [1, 2, 3, 4, 5].map((n) => copy(`landing.flow.${n}` as CopyKey)));
    expect(hero.indexOf(strip)).toBeGreaterThan(hero.indexOf(drawn(copy("landing.headline"))));
    expect(hero.indexOf(strip)).toBeLessThan(hero.indexOf("<form"));
  });

  it("says Google and AI in words", () => {
    expect(copy("landing.flow.4")).toBe(copy("landing.story.4.title"));
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
  it("no story-card, step-3, loop or part-strip string of either board is missing from the render", () => {
    const ship = segments(markup);
    const ours = [
      copy("landing.story.1.title"),
      copy("landing.story.2.what"),
      copy("landing.story.3.title"),
      copy("landing.story.5.day"),
      copy("landing.loop"),
      copy("landing.part.answer"),
      copy("landing.how.full"),
      copy("landing.flow.5"),
    ].map((s) => s.toLowerCase());
    for (const board of ["PubLanding", "PubLandingPhone"]) {
      const { missing } = compare(readFileSync(boardFile(board), "utf8"), ship, readAllow(board));
      const ourMissing = missing.filter((s: string) => ours.some((o) => text(s).toLowerCase().includes(o)));
      expect(ourMissing, board).toEqual([]);
    }
  });
});
