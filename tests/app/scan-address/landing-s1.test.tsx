// tests/app/scan-address/landing-s1.test.tsx
//
// **UI-SPEC S1, the owner-approved screen set (2026-09-08) — issue #351.**
// `landing.test.tsx` beside this file holds REQ-001's own criteria (one
// field, one submit, no gate, the no-JavaScript path) and is unchanged by
// the redraw except where ruling 2b widened what a button on this page may
// be. This file holds what the approved set added: the hero component in
// its browser frame, the video frame ruling 4c put back, the three
// numbered sections with their live components, and the closing CTA.
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

describe("S1 hero — the product component in a browser frame (REQ-099 c4, ruling 5c)", () => {
  it("the frame renders, addressed to the app, over the specimen's own figures", async () => {
    const markup = await renderPage();
    expect(markup).toContain('data-testid="landing-shot"');
    expect(markup).toContain("landing.shot.address");
    // The Overview's own headline and its badge — the words the product
    // renders on the screen the frame is showing (REQ-099 c4).
    expect(markup).toContain("overview.head.rising");
    expect(markup).toContain("landing.shot.badge");
  });

  it("it is the registered GrowthLine over the specimen weeks, not a picture", async () => {
    const markup = await renderPage();
    // The chart's own accessible name is the Overview's tile label, and
    // its endpoint dot is the mark no image would carry.
    expect(markup).toMatch(/<svg[^>]*aria-label="overview\.tile\.searches\.label"/);
    expect(markup).toContain("<circle");
  });

  it("the three tiles are the set's three, each labelled by the Overview's own key", async () => {
    const markup = await renderPage();
    for (const key of [
      "overview.tile.score.label",
      "overview.tile.ai-answers.label",
      "overview.tile.pages.label",
    ]) {
      expect(markup).toContain(key);
    }
    // 62 ▲ 8 · 2/12 · 17 — every one inside `.num`, and every one the
    // specimen's, never the visitor's (ruling 5c).
    for (const figure of ["62", "8", "2", "/12", "17"]) {
      expect(markup).toContain(figure);
    }
  });

  // Issue #488: the set draws the tiles with `.stat-l` + `.stat-v` +
  // `.stat-row` — UI-SPEC §2's Stat — so they are the registered `Stat`,
  // and the landing's own second stat vocabulary is struck.
  it("the three tiles are the registered Stat, and rk-shot-tile-* is gone", async () => {
    const markup = await renderPage();
    const shot = markup.slice(markup.indexOf('data-testid="landing-shot"'));
    expect(shot.match(/class="stats"/g)).toHaveLength(3);
    expect(shot).toMatch(/class="stat-value num"/);
    const sheet = readFileSync(path.resolve(import.meta.dirname, "../../../src/ui/idiom/idiom.css"), "utf8");
    expect(markup).not.toContain("rk-shot-tile-");
    expect(sheet).not.toContain("rk-shot-tile-");
  });

  // The frame's figure is `--h1`, and S12's `.stat-value.num` rule (issue
  // #509) prints `--t-num-big` on the same element. Both are 0,2,0 unless
  // the frame's carries `.num` too, and the S12 rule lands later in the
  // sheet — so at equal weight the miniature would be drawn at the size of
  // the screen it is a picture of. This asserts the weight, not the order.
  it("the miniature's figure out-ranks S12's, so the frame keeps --h1", () => {
    const sheet = readFileSync(path.resolve(import.meta.dirname, "../../../src/ui/idiom/idiom.css"), "utf8");
    const rule = sheet.slice(sheet.indexOf(".rk-shot-tile .stat-value"));
    expect(rule.slice(0, rule.indexOf("{"))).toContain(".stat-value.num");
    expect(rule.slice(0, rule.indexOf("}"))).toContain("font-size: var(--h1)");
  });

  it("no source date and no example line ride with it (5c amends REQ-099 c8)", async () => {
    const markup = await renderPage();
    expect(markup).not.toContain("landing.hero.specimen.caption");
    expect(markup).not.toContain("report.measured-at");
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
    const numbers = [...markup.matchAll(/class="num">(\d\d)</g)].map((m) => m[1]);
    expect(numbers).toEqual(["01", "02", "03"]);
  });

  it("01 carries the live AI-answers matrix and its approved line", async () => {
    const markup = await renderPage();
    expect(markup).toContain('data-testid="landing-matrix"');
    expect(markup).toContain("landing.why.matrix.line");
    // Four rows — three rivals filled, the customer's own empty and ringed
    // — is the argument the section makes (§4.1's own drawing).
    expect(markup).toMatch(/<svg[^>]*aria-label="ai-answers\.title"/);
  });

  it("02 carries the live This-week card with its panel, and the panel offers nothing", async () => {
    const markup = await renderPage();
    expect(markup).toContain('data-testid="landing-week"');
    expect(markup).toContain("rk-panel");
    expect(markup).toContain("landing.week.page.line");
    // The specimen arm: no CTA inside the panel. A solid accent button a
    // visitor cannot use would also be a third solid (ruling 2b).
    const panel = markup.slice(markup.indexOf("rk-panel"));
    expect(panel.slice(0, panel.indexOf("</section>"))).not.toContain("rk-panel-cta");
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

  it("the closing CTA is the solid rank and focuses the field rather than submitting", async () => {
    const markup = await renderPage();
    const buttons = [...markup.matchAll(/<button\b[^>]*>/g)].map((m) => m[0]);
    const closing = buttons.filter((b) => !/type="submit"/.test(b));
    expect(closing).toHaveLength(1);
    expect(closing[0]).toMatch(/btn-primary/);
    expect(closing[0]).toMatch(/type="button"/);
  });

  it("the hero section carries the id every CTA on the page names (REQ-099 c3)", async () => {
    expect(await renderPage()).toContain('id="landing-field"');
  });
});

// Issue #534: the page's layout is Tailwind utilities over the approved
// tokens. The defect it fixes was a class shared by name with the sign-in
// screen, whose `100svh` floor the landing inherited three times — so what
// is pinned here is the source (no idiom class, no viewport-height band)
// and the one declaration left for the screen that still needs it.
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

  it("the sign-in split is declared once, in the sign-in's own section", () => {
    const sheet = read("src/ui/idiom/idiom.css");
    expect(sheet.match(/^\.rk-split \{/gm)).toHaveLength(1);
  });
});
