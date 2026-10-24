// @vitest-environment jsdom
// tests/app/how/icons.test.tsx
//
// `/how-it-works` draws the board's lucide icons in each section, in order,
// with Sparkles for AI and no icon on a FAQ question. The plumber arm is what
// the page renders; the software arm is drawn alongside and must use the same
// icons.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type React from "react";
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

const { default: HowItWorksPage } = await import("@/app/(public)/how-it-works/page");
const visuals = await import("@/app/(public)/_how/visuals");
const { EXAMPLES } = await import("@/app/(public)/_how/specimen");

const dom = (markup: string): Document => new DOMParser().parseFromString(markup, "text/html");
const page = dom(renderToStaticMarkup(HowItWorksPage()));

/** The lucide names drawn inside a node, in document order. */
function icons(root: ParentNode): string[] {
  return [...root.querySelectorAll("svg.lucide")].map(
    (svg) => [...svg.classList].filter((c) => c.startsWith("lucide-")).pop()?.slice("lucide-".length) ?? ""
  );
}

function within(selector: string): Element {
  const node = page.querySelector(selector);
  if (node === null) throw new Error(`no ${selector} on /how-it-works`);
  return node;
}

/** The figure in a section whose text contains a phrase. */
function figure(id: string, phrase: string): Element {
  const found = [...within(`#${id}`).querySelectorAll("figure")].find((f) => f.textContent?.includes(phrase));
  if (found === undefined) throw new Error(`no figure in #${id} reading ${phrase}`);
  return found;
}

const each = (n: number, names: readonly string[]): string[] => Array.from({ length: n }, () => names).flat();

/** The software arm draws the same icons as the plumber's. */
function sameIconsBothArms(draw: (e: (typeof EXAMPLES)["plumber"]) => React.JSX.Element): void {
  const drawn = (e: (typeof EXAMPLES)["plumber"]): string[] =>
    [...new Set(icons(dom(renderToStaticMarkup(draw(e))).body))].sort();
  expect(drawn(EXAMPLES.software)).toEqual(drawn(EXAMPLES.plumber));
}

const plumber = EXAMPLES.plumber;

describe("how it works draws its board icons in every section", () => {
  it("the two weeks: a tile per job and per page, a day off with a coffee", () => {
    const jobs = plumber.jobs.length - 1;
    expect(icons(figure("top", plumber.jobs[0]!))).toEqual([
      "user",
      ...each(jobs, ["wrench"]),
      "coffee",
      "sparkles",
      "search",
      ...each(plumber.live.length, ["file-text", "circle-check"]),
    ]);
    sameIconsBothArms(visuals.TwoWeeks);
  });

  it("the four steps: your business, the questions, the pages, the results", () => {
    const steps = [...within("#top").querySelectorAll("ol > li > a[href^='#']")];
    expect(steps.map((step) => icons(step)[0])).toEqual(["building-2", "message-square", "file-text", "trending-up"]);
  });

  it("the Google first page and the AI answer", () => {
    expect(icons(within("#competitors figure"))).toEqual([
      "search",
      "search",
      "circle-x",
      "sparkles",
      "sparkles",
      ...each(plumber.mentioned.length, ["link"]),
      "circle-x",
      "users",
    ]);
    sameIconsBothArms(visuals.WhoGetsThem);
  });

  it("the question list: a note on each pick, a ban on the one not asked", () => {
    expect(icons(within("#questions figure"))).toEqual([
      "message-square",
      ...plumber.questions.flatMap((q) => (q.reason === "off" ? ["ban", "x"] : ["info", "check"])),
    ]);
    sameIconsBothArms(visuals.QuestionList);
  });

  it("true to your business: a locked address, a link per source, the checks shielded", () => {
    const sources = plumber.page.paragraphs.flat().filter((part) => part.source !== null).length;
    expect(icons(within("#true figure"))).toEqual(["lock", ...each(sources, ["link"]), "ban", "shield-check"]);
    sameIconsBothArms(visuals.PageWithSources);
  });

  it("the week-1 goal: the trend, Google, the AI answer and its link", () => {
    expect(icons(figure("found", plumber.goal.search))).toEqual([
      "trending-up",
      "search",
      "circle-check",
      "sparkles",
      "link",
    ]);
    sameIconsBothArms(visuals.WhatWeWorkToward);
  });

  it("your part: a timer, the line, the plug, then edit and stop", () => {
    expect(icons(within("#you-do figure"))).toEqual(["timer", "link", "plug", "arrow-down", "pencil", "circle-stop"]);
    sameIconsBothArms(visuals.YourPart);
  });

  it("the compare: you, an agency, and ReachKit with sparkles", () => {
    const heads = [...within("#value").querySelectorAll("article h3")].map((h) => icons(h)[0] ?? "");
    expect(heads).toEqual(["user", "building-2", "sparkles"]);
  });
});

describe("how it works keeps one icon per concept", () => {
  it("how it works draws sparkles for AI, never bot", () => {
    expect(icons(page.body)).toContain("sparkles");
    expect(icons(page.body)).not.toContain("bot");
    for (const draw of [visuals.WhoGetsThem, visuals.WhatWeWorkToward]) {
      expect(icons(dom(renderToStaticMarkup(draw(EXAMPLES.software))).body)).not.toContain("bot");
    }
  });

  it("the FAQ summaries carry no icon", () => {
    const summaries = [...within("#faq").querySelectorAll("details > summary")];
    expect(summaries.length).toBeGreaterThan(0);
    for (const summary of summaries) expect(icons(summary)).toEqual([]);
  });
});
