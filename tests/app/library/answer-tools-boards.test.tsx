// `/answers/{slug}`, `/tools`, `/tools/meta-preview` and `/tools/on-page-check`
// against boards PubAnswer, PubTools, PubToolMeta and PubToolOnPage: every
// section the board draws above the shared Learn close, its strings on the
// page with the parity check's matcher, in the board's order. The board files
// are read here; no board string is copied into this test.
import "../../generate/env";
import { readFileSync } from "node:fs";
import type React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parse, type HTMLElement } from "node-html-parser";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { boardFile, compare, readAllow, segments, words } from "../../../scripts/design/parity.mjs";

vi.mock("@/app/(public)/_how/examples", () => ({
  readLiveExamples: async () => ({ report: null, page: null, founder: null }),
}));

type Render = () => Promise<unknown> | unknown;
const PAGES: readonly { board: string; render: Render }[] = [
  {
    board: "PubAnswer",
    render: async () =>
      (await import("@/app/(public)/answers/[question]/page")).default({
        params: Promise.resolve({ question: "free-seo-competitor-analysis-tool" }),
      }),
  },
  { board: "PubTools", render: async () => (await import("@/app/(public)/tools/page")).default() },
  {
    board: "PubToolMeta",
    render: async () => (await import("@/app/(public)/tools/meta-preview/page")).default({ searchParams: Promise.resolve({}) }),
  },
  {
    board: "PubToolOnPage",
    render: async () => (await import("@/app/(public)/tools/on-page-check/page")).default({ searchParams: Promise.resolve({}) }),
  },
];

/** The shared Learn close, held by tests/app/library/learn-close.test.tsx. */
const CLOSE = new Set(["weekly-h", "start-h", "after-h"]);

function label(section: HTMLElement): string {
  return section.getAttribute("aria-labelledby") ?? section.getAttribute("aria-label") ?? "";
}

/** Each section of the board's main, nested ones too, but not the shared close. */
function boardSections(board: string): HTMLElement[] {
  const root = parse(readFileSync(boardFile(board), "utf8"));
  return root.querySelectorAll("main section").filter((s) => !CLOSE.has(label(s)));
}

/** A section's own heading: the element its label names, else its first heading. */
function headingOf(section: HTMLElement): string {
  const id = section.getAttribute("aria-labelledby");
  const el = (id ? section.querySelector(`#${id}`) : null) ?? section.querySelector("h1, h2, h3");
  // Read as the parity reader reads it, so a `<wbr>` breaks the heading on the board and the page alike.
  return el ? words(segments(el.toString()).join(" ")).join(" ") : "";
}

const key = (text: string): string => words(text).join(" ");

describe.each(PAGES)("$board", ({ board, render }) => {
  let shipped: string[];
  beforeAll(async () => {
    shipped = segments(renderToStaticMarkup((await render()) as React.ReactElement));
  });

  for (const section of boardSections(board)) {
    it(`section "${label(section)}": every board string is on the page, sample data aside`, () => {
      const { missing } = compare(section.toString(), shipped, readAllow(board));
      expect(missing).toEqual([]);
    });
  }

  it("draws the board's sections in the board's order", () => {
    const top = parse(readFileSync(boardFile(board), "utf8"))
      .querySelectorAll("main > section")
      .filter((s) => !CLOSE.has(label(s)));
    const headings = top.map(headingOf).filter((h) => h !== "");
    expect(headings.length).toBeGreaterThanOrEqual(2);
    const at = headings.map((h) => shipped.findIndex((s) => key(s) === h));
    expect(at.every((i) => i >= 0), `${headings.join(" | ")} → ${at.join(", ")}`).toBe(true);
    expect([...at].sort((x, y) => x - y)).toEqual(at);
  });
});

describe("PubAnswer: the charts drawn to scale keep the caption true", () => {
  it("a row with no number draws a dashed track, and every other row its bar", async () => {
    const { ANSWERS } = await import("@/app/(public)/_library");
    const a = ANSWERS[0]!;
    const page = parse(renderToStaticMarkup((await PAGES[0]!.render()) as React.ReactElement));
    for (const chart of a.tiers.charts) {
      const figure = page.querySelector(`figure[aria-label="${chart.title}"]`)!;
      const unscaled = chart.rows.filter((row) => row.amount === null).length;
      expect(figure.querySelectorAll(".border-dashed"), chart.title).toHaveLength(unscaled);
      expect(figure.querySelectorAll(".recharts-responsive-container, .recharts-wrapper").length, chart.title).toBeGreaterThanOrEqual(
        chart.rows.length - unscaled
      );
    }
  });
});

describe("the tools read without sample captions, and each tool opens on its breadcrumb", () => {
  const TOOLS = PAGES.filter((p) => p.board !== "PubAnswer");
  const pageOf = async (render: Render) => parse(renderToStaticMarkup((await render()) as React.ReactElement));

  it.each(TOOLS)("$board: no example caption, and what a check costs only once, under a tool's field", async ({ board, render }) => {
    const { copy } = await import("@/lib/presentation/copy");
    const root = await pageOf(render);
    const text = segments(root.toString());
    const last = copy("tools.micro").split(" · ").at(-1)!;
    expect(text.filter((s) => /an example business/i.test(s))).toEqual([]);
    expect(text.filter((s) => s.includes(last))).toHaveLength(board === "PubTools" ? 0 : 1);
    expect(root.querySelectorAll('[data-testid="tool-form"] p').map((p) => segments(p.toString()).length)).toEqual(board === "PubTools" ? [] : [1]);
  });

  it("PubTools opens on its title, with no eyebrow above it", async () => {
    const root = await pageOf(TOOLS[0]!.render);
    expect(segments(root.querySelector("article")!.toString().split("<h1")[0]!)).toEqual([]);
  });

  it.each(TOOLS.filter((p) => p.board !== "PubTools"))("$board: the breadcrumb links Free tools, then names the tool", async ({ render }) => {
    const root = await pageOf(render);
    const crumbs = root.querySelector("article nav.breadcrumbs")!;
    expect(crumbs.querySelectorAll("a").map((a) => a.getAttribute("href"))).toEqual(["/tools"]);
    expect(segments(crumbs.toString())).toEqual([...segments(crumbs.querySelector("a")!.toString()), segments(root.querySelector("h1")!.toString())[0]]);
  });
});
