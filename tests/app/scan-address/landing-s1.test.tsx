// tests/app/scan-address/landing-s1.test.tsx
//
// **The landing in its 2026-09-24 order (SPEC §1, #1059; built by #1067).**
// `landing.test.tsx` beside this file holds REQ-001's own criteria (one
// field, one submit, no gate, the no-JavaScript path). This file holds the
// order and what each section carries: the hero and its *Inside ReachKit*
// preview, the eight steps, the four features, the three steps and the
// closing band. That the preview turns every 5s is proved in jsdom by
// `tests/ui/landing-inside-tabs.test.tsx`.
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
import { BATTERY, TRACKED_PROMPTS, VETO } from "@/lib/config/constants";
import { HARD_RULES } from "@/lib/generate/rules/types";

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

/** The preview card alone, bounded by the eight steps that follow it. */
function heroCard(markup: string): string {
  const from = markup.indexOf('data-testid="landing-inside"');
  const to = markup.indexOf('data-testid="landing-day"');
  expect(from).toBeGreaterThan(-1);
  expect(to).toBeGreaterThan(from);
  return markup.slice(from, to);
}

describe("SPEC §1 2026-09-24 — the landing in its approved order (#1067)", () => {
  it("hero → What happens every day → Why you should care → What to do next → the closing band", async () => {
    const markup = await renderPage();
    const order = [
      'id="landing-field"',
      'data-testid="landing-inside"',
      'data-testid="landing-day"',
      'id="why"',
      "landing.feature.ai.title",
      'id="how"',
      "landing.step.1.tag",
      "landing.close.heading",
    ].map((mark) => markup.indexOf(mark));
    expect(order.every((at) => at > -1), order.join(",")).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });
});

describe("Inside ReachKit — the hero preview (SPEC §1 2026-09-24)", () => {
  it("names its three tabs, and none of them is a score (SPEC §1, D22)", async () => {
    const card = heroCard(await renderPage());
    const tabs = [...card.matchAll(/role="tab"[^>]*>([^<]+)</g)].map((m) => m[1]);
    expect(tabs).toEqual([
      "landing.inside.tab.week",
      "landing.inside.tab.answers",
      "landing.inside.tab.page",
    ]);
  });

  it("the tabs are its only controls: no toggle, no field, no Read it or Stop", async () => {
    const card = heroCard(await renderPage());
    const buttons = [...card.matchAll(/<button\b[^>]*>/g)].map((m) => m[0]);
    expect(buttons).toHaveLength(3);
    for (const b of buttons) expect(b).toMatch(/role="tab"/);
    expect(card).not.toContain("toggle");
    expect(card).not.toContain("<input");
  });

  it("Your week: Monday measures and Tuesday to Saturday each publish one page", async () => {
    const card = heroCard(await renderPage());
    expect(card).toMatch(/landing\.hero\.autopilot:[^"<]+/);
    expect(card).toMatch(/landing\.hero\.week\.measured:400,12/);
    for (const n of [1, 2, 3, 4, 5]) expect(card).toContain(`landing.hero.page.${n}`);
    expect(card.match(/calendar\.stage\.live/g)).toHaveLength(5);
  });

  it("AI answers names the example business; Your page says when it goes live", async () => {
    const card = heroCard(await renderPage());
    expect(card).toContain("landing.inside.answers.head");
    expect(card).toMatch(/<strong class="[^"]*text-primary[^"]*">Harbour Bike Repair<\/strong>/);
    expect(card).toContain("landing.inside.answers.monday");
    expect(card).toContain("calendar.stage.your-review");
    expect(card).toContain("landing.inside.page.due:6h 12m");
  });

  it("says in writing that the business is an example", async () => {
    expect(heroCard(await renderPage())).toContain("landing.hero.example");
  });

  it("the assurance line stands under the field", async () => {
    expect(await renderPage()).toContain("landing.hero.assurance");
  });
});

describe("What happens every day — eight steps, their figures from the constants (issue 1396)", () => {
  it("draws eight steps in order and links to /how-it-works", async () => {
    const markup = await renderPage();
    const at = markup.indexOf('data-testid="landing-day"');
    const block = markup.slice(at, markup.indexOf("</section>", at));
    const titles = [...block.matchAll(/landing\.day\.(\d)\.title/g)].map((m) => m[1]);
    expect(titles).toEqual(["1", "2", "3", "4", "5", "6", "7", "8"]);
    expect(block).toContain('href="/how-it-works"');
  });

  it("each figure is the constant's: change the constant and the step says the new number", async () => {
    const markup = await renderPage();
    const prompts = Object.values(TRACKED_PROMPTS.SPLIT).reduce((sum, n) => sum + n, 0);
    expect(markup).toContain(`landing.day.2.line:${BATTERY.QUESTIONS},${prompts}`);
    expect(markup).toContain(`landing.day.3.line:${BATTERY.COMPETITORS_MAX}`);
    expect(markup).toContain(`landing.day.6.line:${HARD_RULES.length}`);
    expect(markup).toContain(`landing.day.7.line:${VETO.defaultHours}`);
  });
});

describe("Why you should care, What to do next, and the closing band", () => {
  it("four features, each a title and a line", async () => {
    const markup = await renderPage();
    for (const f of ["ai", "google", "fix", "daily"]) {
      expect(markup).toContain(`landing.feature.${f}.title`);
      expect(markup).toContain(`landing.feature.${f}.body`);
    }
  });

  it("three steps, each with its time", async () => {
    const markup = await renderPage();
    for (const n of ["1", "2", "3"]) {
      expect(markup).toContain(`landing.step.${n}.title`);
      expect(markup).toContain(`landing.step.${n}.body`);
      expect(markup).toContain(`landing.step.${n}.tag`);
    }
  });

  it("the closing band's one button is solid and returns to the field rather than submitting", async () => {
    const markup = await renderPage();
    const close = markup.slice(markup.indexOf("landing.close.heading"));
    const buttons = [...close.matchAll(/<button\b[^>]*>/g)].map((m) => m[0]);
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toMatch(/class="btn btn-primary"/);
    expect(buttons[0]).toMatch(/type="button"/);
    expect(close).toContain("landing.close.body");
    expect(close).toContain("landing.close.assurance");
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
});
