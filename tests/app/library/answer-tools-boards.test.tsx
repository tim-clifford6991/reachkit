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
  return el ? words(el.text).join(" ") : "";
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
