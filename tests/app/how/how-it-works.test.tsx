// tests/app/how/how-it-works.test.tsx
//
// SPEC §1 (2026-10-10, issue 1396): `/how-it-works` and `/about` state only
// what the constants and the stored rows state. The "node" project,
// `renderToStaticMarkup`, the real registry.
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

import { BATTERY, PACE, TRACKED_PROMPTS, VETO } from "@/lib/config/constants";
import { HARD_RULES } from "@/lib/generate/rules/types";
import { COPY, copy, type CopyKey } from "@/lib/presentation/copy";
import type { LiveExamples } from "@/app/(public)/_how/examples";

const live = vi.hoisted(() => ({ now: { report: null, page: null, founder: null } as unknown }));
vi.mock("@/app/(public)/_how/examples", () => ({
  readLiveExamples: async () => live.now,
}));

const { default: HowItWorksPage } = await import("@/app/(public)/how-it-works/page");
const { default: AboutPage } = await import("@/app/(public)/about/page");
const { CHECK_LINES, ENGINES_NAMED, ENGINES_NAMED_COUNT, HOW_FACTS, MODEL_DECIDED, checksIn } = await import(
  "@/app/(public)/_how/facts"
);

const NOTHING: LiveExamples = { report: null, page: null, founder: null };
const STORED: LiveExamples = {
  report: "listed.example",
  page: { title: "A page that is live", url: "https://content.example.com/a-page" },
  founder: { name: "Ada", place: "Lisbon" },
};

async function render(Page: () => Promise<React.JSX.Element>, examples: LiveExamples): Promise<string> {
  live.now = examples;
  return renderToStaticMarkup(await Page());
}

const text = (html: string): string => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");

describe("no figure is typed into copy", () => {
  it("no sentence of the two pages or the landing's eight steps holds a digit", () => {
    const typed = (Object.entries(COPY) as [CopyKey, string][])
      .filter(([key]) => /^(how|about|landing\.day)\./.test(key))
      .filter(([, value]) => /\d/.test(value))
      .map(([key]) => key);
    expect(typed).toEqual([]);
  });

  it("the page states the constants' figures, and leaves no slot unfilled", async () => {
    const page = text(await render(HowItWorksPage, NOTHING));
    expect(page).not.toMatch(/\{[a-zA-Z]+\}/);
    expect(page).toContain(copy("how.measure.search", { searches: BATTERY.QUESTIONS }));
    expect(page).toContain(copy("how.choose.pace", { newPages: PACE.NEW_PAGES_PER_WEEK }));
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

  it("the plain lines account for every check, and code runs all but the model's", async () => {
    expect(CHECK_LINES.reduce((sum, line) => sum + checksIn(line), 0)).toBe(HARD_RULES.length);
    const page = text(await render(HowItWorksPage, NOTHING));
    expect(page).toContain(
      copy("how.checks.count", { checks: HARD_RULES.length, coded: HARD_RULES.length - MODEL_DECIDED.length })
    );
    expect(MODEL_DECIDED).toHaveLength(1);
  });
});

describe("what the page says about itself", () => {
  it("says once that pages are written with an AI model, and names no version", async () => {
    const page = text(await render(HowItWorksPage, NOTHING));
    expect(page.split(copy("how.disclosure"))).toHaveLength(2);
    expect(page).not.toMatch(/\b(opus|sonnet|haiku|gpt-|prompt)\b/i);
  });

  it("marks what is not built yet as coming", async () => {
    const html = await render(HowItWorksPage, NOTHING);
    const links = html.slice(html.indexOf('id="links"'), html.indexOf('id="control"'));
    expect(links.indexOf(copy("how.links.coming"))).toBeLessThan(links.indexOf(copy("how.links.coming.deep")));
  });
});

describe("the live examples and the founder are stored rows", () => {
  it("links the listed report and the live page", async () => {
    const html = await render(HowItWorksPage, STORED);
    expect(html).toContain('href="/scan/listed.example"');
    expect(html).toContain('href="https://content.example.com/a-page"');
  });

  it("draws neither where none is stored, and still links the gallery", async () => {
    const html = await render(HowItWorksPage, NOTHING);
    expect(html).not.toContain('href="/scan/');
    expect(html).not.toContain(copy("how.examples.page"));
    expect(html).toContain('href="/scans"');
  });

  it("/about names the founder the byline names, and no one where there is none", async () => {
    const named = text(await render(AboutPage, STORED));
    expect(named).toContain(copy("about.who.founder.place", { name: "Ada", place: "Lisbon" }));
    const unnamed = await render(AboutPage, NOTHING);
    expect(text(unnamed)).not.toContain("built by");
    expect(unnamed).toContain('href="/imprint"');
    expect(unnamed).toContain('href="/how-it-works"');
  });
});
