// tests/app/scan-address/landing-s1.test.tsx
//
// **UI-SPEC S1, the owner-approved screen set (2026-09-08) — issue #351.**
// `landing.test.tsx` beside this file holds REQ-001's own criteria (one
// field, one submit, no gate, the no-JavaScript path) and is unchanged by
// the redraw except where ruling 2b widened what a button on this page may
// be. This file holds what the approved set added: the hero, the video
// frame ruling 4c put back, the three numbered sections with their live
// components, and the closing CTA.
//
// **The hero block is Round 11's** (owner ruling 2026-09-21, #935): S1's
// browser frame over three tiles was replaced, so this file's first block
// was retargeted onto the card that replaced it rather than deleted — the
// claim "the hero is the approved drawing and every figure in it is the
// specimen's" is the same claim, about a different drawing.
//
// Same conventions as its neighbour: the "node" project, `react-dom/
// server`'s `renderToStaticMarkup`, and `copy()` mocked to `(key) => key`
// so the assertions read the rendered *tree* and the key each line resolves
// from, never the owner's wording.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";

vi.mock("@/lib/presentation/copy", () => ({
  copy: (key: string, vars?: Record<string, string>) =>
    vars === undefined ? key : `${key}:${Object.values(vars).join(",")}`,
}));

async function renderPage(): Promise<string> {
  vi.resetModules();
  const { default: LandingPage } = (await import("@/app/(public)/page.tsx")) as {
    default: (p: { searchParams: Record<string, string> }) => React.JSX.Element;
  };
  return renderToStaticMarkup(React.createElement(LandingPage, { searchParams: {} }));
}

/** The hero card alone. Bounded at both ends — the video block is the next
 *  thing on the page — because "nothing in this card is a control" is only
 *  a claim about this card, and the closing CTA below it is a button. */
function heroCard(markup: string): string {
  const from = markup.indexOf('data-testid="landing-hero-week"');
  const to = markup.indexOf('data-testid="landing-video"');
  expect(from).toBeGreaterThan(-1);
  expect(to).toBeGreaterThan(from);
  return markup.slice(from, to);
}

describe("Hero D — one week, one card (owner ruling 2026-09-21, #935)", () => {
  // The ruling replaced S1's browser-frame hero with Round 11's
  // `R11-H4-Week`. The rows below are that ruling's own list, in its own
  // order; the approved headline and sub-line are asserted by
  // `landing.test.tsx` and are untouched by it.

  it("the card renders, and the rejected browser frame does not", async () => {
    const markup = await renderPage();
    expect(markup).toContain('data-testid="landing-hero-week"');
    expect(markup).not.toContain('data-testid="landing-shot"');
    expect(markup).not.toContain("landing.shot.address");
  });

  it("the autopilot pill and the Discoverability number are up top", async () => {
    const markup = await renderPage();
    const card = heroCard(markup);
    // The pill carries the date it was switched on, through the key's slot.
    expect(card).toMatch(/landing\.hero\.autopilot:[^"<]+/);
    expect(card).toContain("overview.tile.score.label");
    // 47 / 100, and what it rose by, every one of them `.num`.
    for (const figure of ["47", "/100", "25"]) expect(card).toContain(figure);
  });

  it("the pill is a badge and not a toggle: nothing on this page is a dead control", async () => {
    const markup = await renderPage();
    const card = heroCard(markup);
    expect(card).not.toContain("toggle");
    expect(card).not.toContain("<button");
    expect(card).not.toContain("<input");
  });

  it("Monday measures and Tuesday to Saturday each publish one page", async () => {
    const markup = await renderPage();
    const card = heroCard(markup);
    // Six cells: Monday's two counts, then five page titles.
    expect(card).toMatch(/landing\.hero\.week\.measured:400,12/);
    for (const n of [1, 2, 3, 4, 5]) expect(card).toContain(`landing.hero.page.${n}`);
    // Each published day says it is live, at the hour it went live.
    expect(card.match(/calendar\.stage\.live/g)).toHaveLength(5);
    expect(card.match(/07:00/g)).toHaveLength(5);
  });

  it("the line is the registered Recharts GrowthLine, climbing to the findable boundary", async () => {
    const markup = await renderPage();
    // Its accessible name is the score's own key, and it writes its
    // readings out as a list — which no image would carry.
    expect(markup).toMatch(/<figure[^>]*aria-label="overview\.tile\.score\.label"/);
    expect(markup).toMatch(/<ul class="sr-only"><li>/);
    // First and last reading of the eleven: the last is the head's number.
    expect(markup).toContain("<li>1 · 22</li>");
    expect(markup).toContain("<li>11 · 47</li>");
  });

  it("the AI answer names the example business, and names its engine", async () => {
    const markup = await renderPage();
    const card = heroCard(markup);
    expect(card).toContain("ai-answers.engine.ai-overview");
    // The sentence is one key, resolved with the business as its slot; the
    // card then draws the business out of that one resolved string rather
    // than writing the name a second time, which is why the emphasis
    // splits the line instead of sitting beside it.
    expect(card).toContain("landing.hero.ai.answer:");
    expect(card).toMatch(/<strong class="[^"]*text-primary[^"]*">Harbour Bike Repair<\/strong>/);
  });

  it("the work line says what each side does", async () => {
    const card = heroCard(await renderPage());
    expect(card).toContain("landing.hero.work.you");
    expect(card).toContain("landing.hero.work.reachkit");
  });

  it("the card says in writing that the business is an example", async () => {
    // The ruling put a named business on this page, so the line 5c removed
    // from the old frame comes back in the form this card needs.
    expect(await renderPage()).toContain("landing.hero.example");
  });

  it("the assurance line stands under the field", async () => {
    expect(await renderPage()).toContain("landing.hero.assurance");
  });
});

describe("S1 video block — ruling 4c: a frame, a play control and one written line", () => {
  it("the block renders before any asset exists", async () => {
    const markup = await renderPage();
    expect(markup).toContain('data-testid="landing-video"');
    expect(markup).toContain("landing.video.line");
    expect(markup).toContain("landing.video.caption");
  });

  it("the play control is drawn, not offered — it starts nothing yet", async () => {
    // A `<button>` here would be a control that does nothing, and REQ-001
    // c1 counts controls. The glyph is `aria-hidden` for the same reason.
    const markup = await renderPage();
    const at = markup.indexOf('data-testid="landing-video"');
    expect(at, "the video block did not render").toBeGreaterThan(-1);
    const block = markup.slice(at, markup.indexOf("</section>", at));
    expect(block).not.toContain("<button");
    // The play glyph is drawn inside a hidden disc, not offered.
    expect(block).toMatch(/<span[^>]*aria-hidden="true"[^>]*><svg/);
  });
});

describe("S1 sections — 01 why-care, 02 what-it-does, 03 how-to-start", () => {
  it("the three numbers render in order, in the mono face", async () => {
    const markup = await renderPage();
    const numbers = [...markup.matchAll(/class="font-mono">(\d\d)</g)].map((m) => m[1]);
    expect(numbers).toEqual(["01", "02", "03"]);
  });

  it("01 carries the live AI-answers matrix and its approved line", async () => {
    const markup = await renderPage();
    expect(markup).toContain('data-testid="landing-matrix"');
    expect(markup).toContain("landing.why.matrix.line");
    // Four rows — three rivals filled, the customer's own empty and ringed
    // — is the argument the section makes (§4.1's own drawing).
    // Issue 730: the report's own CSS grid, named by the card's title.
    expect(markup).toMatch(/role="table"[^>]*aria-label="ai-answers\.title"[^>]*data-testid="ai-matrix"/);
  });

  it("02 carries the live This-week card with its panel, and the panel offers nothing", async () => {
    const markup = await renderPage();
    expect(markup).toContain('data-testid="landing-week"');
    expect(markup).toContain("landing.week.page.line");
    // No control inside the panel: a stranger has no account to act in.
    const panel = markup.slice(markup.indexOf('data-testid="landing-week"'));
    const card = panel.slice(0, panel.indexOf("</section>"));
    expect(card).toContain('class="alert');
    expect(card).not.toMatch(/<button|<a\b/);
  });

  it("03 carries the three Step cards, titles and bodies from their own keys", async () => {
    const markup = await renderPage();
    for (const n of ["1", "2", "3"]) {
      expect(markup).toContain(`landing.step.eyebrow:${n}`);
      expect(markup).toContain(`landing.step.${n}.title`);
      expect(markup).toContain(`landing.step.${n}.body`);
    }
    expect(markup).toContain("landing.start.cancel");
  });

  it("the closing CTA is outline and focuses the field rather than submitting (SPEC §1, 2026-09-14)", async () => {
    const markup = await renderPage();
    const buttons = [...markup.matchAll(/<button\b[^>]*>/g)].map((m) => m[0]);
    const closing = buttons.filter((b) => !/type="submit"/.test(b));
    expect(closing).toHaveLength(1);
    expect(closing[0]).toMatch(/btn-outline btn-primary/);
    expect(closing[0]).toMatch(/type="button"/);
  });

  it("the hero section carries the id every CTA on the page names (REQ-099 c3)", async () => {
    expect(await renderPage()).toContain('id="landing-field"');
  });
});

// Issue #534: the page's layout is Tailwind utilities over the approved
// tokens. The defect it fixes was a class shared by name with the sign-in
// screen, whose `100svh` floor the landing inherited three times — so what
// is pinned here is the source (no idiom class, no viewport-height band),
// and that no screen declares the shared class now (#549 took /signin's).
describe("S1 layout — Tailwind utilities, no idiom class, no viewport band (#534)", () => {
  const read = (rel: string): string => readFileSync(path.resolve(import.meta.dirname, "../../..", rel), "utf8");

  it("page.tsx names no rk-* class", () => {
    expect(read("src/app/(public)/page.tsx")).not.toContain("rk-");
  });

  it("page.tsx draws no min-height or viewport-height band", () => {
    const source = read("src/app/(public)/page.tsx");
    expect(source).not.toMatch(/\bmin-h-|svh|\bh-screen|\d+vh\b/);
  });

  it("the hero h1 carries the set's display class", async () => {
    expect(await renderPage()).toMatch(/<h1 class="t-hero">landing\.headline<\/h1>/);
  });

  it("no screen declares the shared split class", () => {
    const sheet = read("src/ui/idiom/idiom.css");
    expect(sheet).not.toMatch(/^\.rk-split\b/m);
  });
});

// Issue #642 — `Canvas: LandingMobile`. What the artboard adds at 320 and
// 768: every numbered section says its own word beside its number, the
// video block is headed before its frame, and a step card names which of
// the three it is.
describe("Canvas: LandingMobile — the words the artboard heads each section with", () => {
  it("every numbered section names its own word", async () => {
    const markup = await renderPage();
    for (const key of ["landing.why.eyebrow", "landing.does.eyebrow", "landing.start.eyebrow"]) {
      expect(markup, key).toContain(key);
    }
  });

  it("the video block carries its eyebrow and its heading", async () => {
    const markup = await renderPage();
    expect(markup).toContain("landing.video.eyebrow");
    expect(markup).toContain("landing.video.heading");
  });

  it("each step says which of the three it is", async () => {
    const markup = await renderPage();
    for (const count of ["01/03", "02/03", "03/03"]) expect(markup, count).toContain(count);
  });
});
