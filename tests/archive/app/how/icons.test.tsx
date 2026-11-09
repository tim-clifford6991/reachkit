// @vitest-environment jsdom
// tests/app/how/icons.test.tsx
//
// `/how-it-works` draws the board's lucide icons in each section, in order,
// with Sparkles for AI and no icon on a FAQ question. The software example is
// what the page renders; the plumber is drawn alongside and must use the same
// icons.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type React from "react";
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

const { default: HowItWorksPage } = await import("@/app/(public)/how-it-works/page");
const visuals = await import("@/app/(public)/_how/visuals");
const { EXAMPLES } = await import("@/app/(public)/_how/specimen");
const { copy } = await import("@/lib/presentation/copy");

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

/** Either example draws the same icons. */
function sameIconsBothArms(draw: (e: (typeof EXAMPLES)["plumber"]) => React.JSX.Element): void {
  const drawn = (e: (typeof EXAMPLES)["plumber"]): string[] =>
    [...new Set(icons(dom(renderToStaticMarkup(draw(e))).body))].sort();
  expect(drawn(EXAMPLES.software)).toEqual(drawn(EXAMPLES.plumber));
}

const shown = EXAMPLES.software;

describe("how it works draws its board icons in every section", () => {
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
      ...each(shown.mentioned.length, ["link"]),
      "circle-x",
    ]);
    sameIconsBothArms(visuals.WhoGetsThem);
  });

  it("the question list: a note on each pick, a ban on the one not asked", () => {
    expect(icons(within("#questions figure"))).toEqual([
      "message-square",
      ...shown.questions.flatMap((q) => (q.reason === "off" ? ["ban", "x"] : ["info", "check"])),
    ]);
    sameIconsBothArms(visuals.QuestionList);
  });

  it("true to your business: a locked address, a link per source, the checks shielded", () => {
    const sources = shown.page.paragraphs.flat().filter((part) => part.source !== null).length;
    expect(icons(within("#true figure"))).toEqual(["lock", ...each(sources, ["link"]), "ban", "shield-check"]);
    sameIconsBothArms(visuals.PageWithSources);
  });

  it("your part: a timer, the line, then edit and stop; the WordPress plug is switched off", () => {
    expect(icons(within("#you-do figure"))).toEqual(["timer", "link", "arrow-down", "pencil", "circle-stop"]);
    sameIconsBothArms(visuals.YourPart);
  });

  it("#research: Globe, a turned arrow per source and Pencil on the fix", () => {
    const read = figure("research", shown.business);
    expect(icons(read)).toEqual(["globe", ...each(6, ["arrow-right"]), "pencil"]);
    for (const arrow of read.querySelectorAll("svg.lucide-arrow-right")) expect(arrow.classList).toContain("rotate-180");
    expect(read.querySelector("svg.lucide-bot")).toBeNull();
    sameIconsBothArms(visuals.AsWeRead);
  });

  it("#research: the source arrows are muted below their line, and the fix badge pins top right of the facts on a wide card only", () => {
    const read = figure("research", shown.business);
    for (const arrow of read.querySelectorAll("svg.lucide-arrow-right")) expect(arrow.classList).toContain("text-base-content/50");
    const badge = read.querySelector("svg.lucide-pencil")?.closest(".badge");
    expect(badge?.textContent).toBe(copy("how.read.fix"));
    expect([...badge!.classList].filter((c) => /^(sm:)?(absolute|top-|right-)/.test(c))).toEqual(["sm:absolute", "sm:top-2", "sm:right-0"]);
    const frame = badge!.parentElement!;
    expect(frame.classList).toContain("relative");
    expect(frame.querySelector("dl")).not.toBeNull();
  });

  it("#true: the disclosure line opens with sparkles", () => {
    const disclosure = within('[data-testid="how-disclosure"]');
    expect(icons(disclosure)).toEqual(["sparkles"]);
    expect(disclosure.firstElementChild?.matches("svg.lucide-sparkles")).toBe(true);
    expect(disclosure.textContent).toBe(copy("how.disclosure"));
    expect(disclosure.querySelector("svg.lucide-bot")).toBeNull();
  });

  it("the compare: you, an agency, and ReachKit with sparkles", () => {
    const heads = [...within("#value").querySelectorAll("article h3")].map((h) => icons(h.parentElement!)[0] ?? "");
    expect(heads).toEqual(["user", "building-2", "sparkles"]);
  });
});

describe("how it works keeps one icon per concept", () => {
  it("how it works draws sparkles for AI, never bot", () => {
    expect(icons(page.body)).toContain("sparkles");
    expect(icons(page.body)).not.toContain("bot");
    expect(icons(dom(renderToStaticMarkup(visuals.WhoGetsThem(EXAMPLES.plumber))).body)).not.toContain("bot");
  });

  it("the FAQ summaries carry no icon", () => {
    const summaries = [...within("#faq").querySelectorAll("details > summary")];
    expect(summaries.length).toBeGreaterThan(0);
    for (const summary of summaries) expect(icons(summary)).toEqual([]);
  });
});
