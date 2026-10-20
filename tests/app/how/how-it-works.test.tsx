// tests/app/how/how-it-works.test.tsx
//
// `/how-it-works` (board *How it works*) and `/about` state only what the
// constants, the rules registry and the stored rows state. The "node"
// project, `renderToStaticMarkup`, the real registry.
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

import { BATTERY, CROSS_LINKS, PACE, TRACKED_PROMPTS, VETO, WEEK_PLAN } from "@/lib/config/constants";
import { HARD_RULES } from "@/lib/generate/rules/types";
import { COPY, copy, type CopyKey } from "@/lib/presentation/copy";
import type { LiveExamples } from "@/app/(public)/_how/examples";

const live = vi.hoisted(() => ({ now: { report: null, page: null, founder: null } as unknown }));
vi.mock("@/app/(public)/_how/examples", () => ({
  readLiveExamples: async () => live.now,
}));

const { default: HowItWorksPage } = await import("@/app/(public)/how-it-works/page");
const { default: AboutPage } = await import("@/app/(public)/about/page");
const { default: LandingPage } = await import("@/app/(public)/page");
const { CHECK_LINES, ENGINES_NAMED, ENGINES_NAMED_COUNT, HOW_FACTS, MODEL_DECIDED, checksIn } = await import(
  "@/app/(public)/_how/facts"
);
const { EXAMPLES } = await import("@/app/(public)/_how/specimen");

const NOTHING: LiveExamples = { report: null, page: null, founder: null };
const STORED: LiveExamples = {
  report: "listed.example",
  page: { title: "A page that is live", url: "https://content.example.com/a-page" },
  founder: { name: "Ada", place: "Lisbon" },
};

const html = renderToStaticMarkup(HowItWorksPage());

async function renderAbout(examples: LiveExamples): Promise<string> {
  live.now = examples;
  return renderToStaticMarkup(await AboutPage());
}

const text = (markup: string): string =>
  markup
    .replace(/<[^>]*>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ");
const count = (markup: string, needle: string): number => markup.split(needle).length - 1;

/** Each section's markup, by its id, in page order. */
function sections(): { id: string; markup: string }[] {
  const starts = [...html.matchAll(/<section id="([^"]+)"/g)];
  return starts.map((match, i) => ({
    id: match[1] ?? "",
    markup: html.slice(match.index, starts[i + 1]?.index ?? html.length),
  }));
}
const section = (id: string): string => sections().find((s) => s.id === id)?.markup ?? "";

describe("the head, the four steps and eleven sections in the board's order", () => {
  it("opens on the headline", () => {
    expect(html).toContain(`<h1 id="top-h" class="t-hero">${copy("how.headline")}</h1>`);
  });

  it("has the eleven anchors in order", () => {
    expect(sections().map((s) => s.id)).toEqual([
      "top",
      "research",
      "competitors",
      "questions",
      "pages",
      "true",
      "found",
      "you-do",
      "value",
      "faq",
      "start",
    ]);
  });

  it("the four-step strip opens the sections that tell each step", () => {
    const strip = section("top").slice(section("top").indexOf(copy("how.steps.title")));
    const cards = [...strip.matchAll(/<a [^>]*>/g)].map((m) => m[0]).filter((a) => a.includes('class="card '));
    const hrefs = cards.map((a) => /href="([^"]+)"/.exec(a)?.[1]);
    expect(hrefs).toEqual(["#research", "#questions", "#pages", "#found"]);
  });

  it("every anchor the landing links to is on the page", () => {
    const landing = renderToStaticMarkup(createElement(LandingPage, { searchParams: {} }));
    const ids = new Set([...landing.matchAll(/href="\/how-it-works#([^"]+)"/g)].map((m) => m[1]));
    expect(ids.size).toBeGreaterThan(0);
    for (const id of ids) expect(html).toContain(`<section id="${id}"`);
  });
});

describe("each section has a picture and a closed detail", () => {
  it("every section holds one *Show the detail*, and nothing on the page starts open", () => {
    const summary = `>${copy("how.detail")}</summary>`;
    for (const s of sections()) expect(count(s.markup, summary), s.id).toBe(1);
    expect(count(html, summary)).toBe(11);
    expect(html).not.toMatch(/<details[^>]*\sopen/);
  });

  it("every section draws a picture from daisyUI parts", () => {
    const PARTS = /class="[^"]*\b(card|mockup-browser|mockup-phone|stats|timeline|steps|collapse)\b/;
    const detail = new RegExp(`<details[^>]*><summary[^>]*>${copy("how.detail")}</summary>[\\s\\S]*?</details>`, "g");
    for (const s of sections()) expect(s.markup.replace(detail, ""), s.id).toMatch(PARTS);
  });

  it("draws no chart of its own: every svg is a lucide icon", () => {
    const svgs = [...html.matchAll(/<svg[^>]*>/g)].map((m) => m[0]);
    expect(svgs.length).toBeGreaterThan(0);
    for (const svg of svgs) expect(svg).toMatch(/class="lucide/);
  });
});

describe("the Plumber · Software switch, without JavaScript", () => {
  it("the server markup draws the plumber and not the software firm", () => {
    const shown = text(html);
    expect(shown).toContain(EXAMPLES.plumber.search);
    expect(shown).toContain(EXAMPLES.plumber.page.title);
    expect(shown).not.toContain(EXAMPLES.software.business);
    expect(shown).not.toContain(EXAMPLES.software.search);
    expect(count(html, 'aria-pressed="true"')).toBe(count(html, `>${copy("how.switch.plumber")}</button>`));
  });
});

describe("the calls to action", () => {
  it("the free scan appears four times: the head, after the week, the value and the start", () => {
    expect(count(html, 'data-testid="how-scan"')).toBe(4);
    for (const id of ["top", "pages", "value", "start"]) expect(count(section(id), 'data-testid="how-scan"'), id).toBe(1);
    expect(count(html, `>${copy("landing.start.cta")}`)).toBe(4);
  });

  it("the €49 checkout appears once, in the value section", () => {
    expect(count(html, copy("offer.start.priced"))).toBe(1);
    expect(count(section("value"), 'data-testid="how-checkout"')).toBe(1);
  });
});

describe("no figure is typed into copy", () => {
  it("no sentence of the two pages or the landing's eight steps holds a digit", () => {
    const typed = (Object.entries(COPY) as [CopyKey, string][])
      .filter(([key]) => /^(how|about|landing\.day)\./.test(key))
      .filter(([, value]) => /\d/.test(value))
      .map(([key]) => key);
    expect(typed).toEqual([]);
  });

  it("the page states the constants' figures, and leaves no slot unfilled", () => {
    const page = text(html);
    expect(page).not.toMatch(/\{[a-zA-Z]+\}/);
    expect(page).toContain(copy("how.measure.search", { searches: BATTERY.QUESTIONS }));
    expect(page).toContain(copy("how.week.detail.plan", { weekPages: WEEK_PLAN.days, newPages: PACE.NEW_PAGES_PER_WEEK }));
    expect(page).toContain(
      copy("how.control.window", { hours: VETO.defaultHours, min: VETO.minDays, max: VETO.maxDays })
    );
    expect(HOW_FACTS.prompts).toBe(Object.values(TRACKED_PROMPTS.SPLIT).reduce((sum, n) => sum + n, 0));
  });

  it("names as many AI answers as are asked", () => {
    expect(ENGINES_NAMED_COUNT).toBe(TRACKED_PROMPTS.ENGINES);
    expect(copy(ENGINES_NAMED).split(/,| and /).filter((name) => name.trim() !== "")).toHaveLength(
      TRACKED_PROMPTS.ENGINES
    );
  });

  it("the check count shown is the rules registry's (E10)", () => {
    const shown = text(section("true"));
    expect(shown).toContain(`up to ${HARD_RULES.length} checks`);
    expect(shown).toContain(`${HARD_RULES.length} checks passed`);
    expect(shown).toContain(
      copy("how.checks.count", { checks: HARD_RULES.length, coded: HARD_RULES.length - MODEL_DECIDED.length })
    );
  });

  it("the plain lines account for every check, and code runs all but the model's", () => {
    expect(CHECK_LINES.reduce((sum, line) => sum + checksIn(line), 0)).toBe(HARD_RULES.length);
    expect(MODEL_DECIDED).toHaveLength(1);
  });
});

describe("what the page says about itself", () => {
  it("says once that pages are written with an AI model, and names no version", () => {
    const page = text(html);
    expect(page.split(copy("how.disclosure"))).toHaveLength(2);
    expect(page).not.toMatch(/\b(opus|sonnet|haiku|gpt-|prompt)\b/i);
  });

  it("states the links a page carries in the constants' own figures", () => {
    const links = text(section("true"));
    expect(links).toContain(`${CROSS_LINKS.SITE_MIN} to ${CROSS_LINKS.SITE_MAX} links`);
    expect(links).toContain(`up to ${CROSS_LINKS.BACK_PAGES_MAX} of your earlier pages`);
  });

  it("still links every free report", () => {
    expect(section("start")).toContain('href="/scans"');
  });
});

describe("/about reads the founder from stored rows", () => {
  it("names the founder the byline names, and no one where there is none", async () => {
    const named = text(await renderAbout(STORED));
    expect(named).toContain(copy("about.who.founder.place", { name: "Ada", place: "Lisbon" }));
    const unnamed = await renderAbout(NOTHING);
    expect(text(unnamed)).not.toContain("built by");
    expect(unnamed).toContain('href="/imprint"');
    expect(unnamed).toContain('href="/how-it-works"');
  });
});
