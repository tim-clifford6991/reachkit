// tests/app/scan-address/ai-answers.test.tsx
//
// BUILD §6.2's three answer columns on §4.1 module 2's left card (issue
// #157). The data has been measured and stored since #128/#159; this is
// the suite over the layout that draws it — which engines get a column,
// what a cell says, and what the free report says about the two engines it
// never asked.
//
// **Rendering convention**: `tests/app/**` runs under Vitest's `node`
// project, so this renders with `react-dom/server`'s `renderToStaticMarkup`
// and mocks `copy()` to `(key) => key`, exactly as `report-view.test.tsx`
// does. Every one of these keys is `TODO(copy)` today; asserting the key is
// what stays true when the owner writes the sentence.
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";

vi.mock("@/lib/presentation/copy", () => ({
  copy: (key: string, vars?: Record<string, string>) =>
    vars === undefined ? key : `${key}(${Object.values(vars).join("|")})`,
}));

import { AiAnswersCard } from "@/app/(public)/scan/[domain]/_modules/ai-answers";
import { FIXTURE_REPORT } from "@/app/(public)/scan/[domain]/_fixture/states";
import type { AiAnswersSection, AnswerCell, EngineCell } from "@/lib/scan/report";

const FREE_SECTION = FIXTURE_REPORT.aiAnswers as AiAnswersSection;

const ANSWERED_NAMING: AnswerCell = { kind: "answered", citedDomains: ["example.com"], namesCustomer: true };
const ANSWERED_NOT_YOU: AnswerCell = { kind: "answered", citedDomains: ["rival.com"], namesCustomer: false };
const NO_ANSWER: AnswerCell = { kind: "no_answer" };
const NOT_ASKED: AnswerCell = { kind: "unmeasured", reason: "not_attempted" };

/** The free fixture's own rows, with the two battery engines filled in —
 *  what a deep or weekly pass stores (§6.2's "ChatGPT std + AI Mode std +
 *  AI-Overview piggyback"). The AI-Overview column stays the row's own
 *  `cell`, which is the one thing `matrix.ts` never lets drift. */
function withBattery(
  aiMode: (index: number) => AnswerCell,
  chatgpt: (index: number) => AnswerCell
): AiAnswersSection {
  return {
    ...FREE_SECTION,
    rows: FREE_SECTION.rows.map((row, index) => ({
      ...row,
      engines: [
        { engine: "ai_overview", cell: row.cell },
        { engine: "ai_mode", cell: aiMode(index) },
        { engine: "chatgpt", cell: chatgpt(index) },
      ] as readonly EngineCell[],
    })),
  };
}

function render(section: AiAnswersSection): string {
  return renderToStaticMarkup(
    React.createElement(AiAnswersCard, { section, measuredOn: "6 Sep 2026" })
  );
}

/** The two counts the card writes beside a rival's row, read the same way
 *  the card reads them, so this file asserts the drawing carries the
 *  figure rather than transcribing a second copy of it. */
function citedCount(cells: readonly AnswerCell[]): number {
  return cells.filter((c) => c.kind === "answered" && c.citedDomains.length > 0).length;
}

function answeredCount(cells: readonly AnswerCell[]): number {
  return cells.filter((c) => c.kind === "answered").length;
}

/** The card's own drawing, as markup. `role="img"` is `ChartFrame`'s and
 *  only a registered chart carries it — the card head's decorative chip is
 *  an `<svg>` too (issue #352's lucide glyph) and is not a chart. */
const CHART_ROOT = 'role="img"';

function chart(html: string): string {
  const start = html.indexOf(CHART_ROOT);
  expect(start, "the card drew no chart").toBeGreaterThan(-1);
  return html.slice(start, html.indexOf("</svg>", start));
}

/** Counts non-overlapping occurrences — every needle here is a distinct key. */
function count(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

/** The `<th>` texts of the first table on the card, which is the engine
 *  table: the rival table follows it.
 *
 *  The tag may carry attributes — the registered `Table` gives its headers
 *  `whitespace-normal wrap-anywhere` since #307, so that a label can fold
 *  and stop setting its column's minimum width — so the pattern reads the
 *  text and not the markup around it. */
function headers(html: string): string[] {
  return [...html.matchAll(/<th[^>]*>([^<]*)<\/th>/g)].map((m) => m[1] ?? "");
}

describe("§6.2 — the paid battery is drawn as three answer columns", () => {
  const html = render(withBattery(() => ANSWERED_NOT_YOU, () => ANSWERED_NAMING));

  it("gives each engine its own column, in the order the rows carry them", () => {
    const engineHeaders = headers(html).slice(0, 4);
    expect(engineHeaders).toEqual([
      "ai-answers.engine.column.question",
      "ai-answers.engine.ai-overview",
      "ai-answers.engine.ai-mode",
      "ai-answers.engine.chatgpt",
    ]);
  });

  it("labels every column in writing, so identity is never colour-alone (§2.4)", () => {
    for (const key of [
      "ai-answers.engine.ai-overview",
      "ai-answers.engine.ai-mode",
      "ai-answers.engine.chatgpt",
    ]) {
      expect(html).toContain(key);
    }
  });

  it("draws one row per question, each numbered in the mono utility (§2.3)", () => {
    for (const row of FREE_SECTION.rows) {
      expect(html).toContain(`class="num min-w-0">${row.question.n}<`);
    }
  });

  it("says, in writing, that an engine named the customer — the state the one-column card renders as nothing", () => {
    expect(count(html, "ai-answers.engine.cell.cited")).toBe(FREE_SECTION.rows.length);
  });

  it("names no engine as never asked, because every one of them was", () => {
    expect(html).not.toContain("ai-answers.engine.not-measured");
  });

  it("adds no chart of its own: the columns are §2.2's table, and §2.4's inventory stays closed at five", () => {
    // The card draws exactly one chart — §4.1's own dot matrix, which is
    // one of the five (issue #352) — and the answer columns are not a
    // sixth: every engine state below is a cell of a `<table>`.
    expect(count(html, CHART_ROOT)).toBe(1);
    expect(html).toContain("<table");
    expect(html.indexOf("<table")).toBeGreaterThan(html.indexOf(CHART_ROOT));
  });
});

describe("§6.2 — the free report has no second reading to draw, and never asked is never a miss", () => {
  const html = render(FREE_SECTION);

  it("draws no engine table at all: the AI-Overview reading is already the matrix and the questions list", () => {
    // #165 draws the battery engines "as a second reading **beside**" the
    // AI-Overview one. The free path asks no battery engine (§6.2), so the
    // only column there could be is the AI-Overview column — twelve rows
    // restating, badge for badge, the twelve questions below the divider,
    // and the bulk of why this card stood three times its neighbour's
    // height (issue #352). Where a battery *did* run, the table above
    // proves the columns are drawn.
    expect(headers(html)).toEqual([]);
    expect(html).not.toContain("<table");
  });

  it("names no engine it never asked, because it draws no table for them to sit beneath", () => {
    // #165 puts a never-asked engine on "one line **beneath the table**".
    // With no second reading there is no table, and the approved free
    // report draws neither line: twelve questions, their answers, and the
    // one written line saying what was measured. An engine nobody asked is
    // not a place the customer lost, and on this card it is not a sentence
    // either.
    expect(count(html, "ai-answers.engine.ai-mode")).toBe(0);
    expect(count(html, "ai-answers.engine.chatgpt")).toBe(0);
    expect(count(html, "ai-answers.engine.not-measured")).toBe(0);
  });

  it("says nothing about a question in red that nobody asked (§2.5)", () => {
    // The only `bad`-toned badge on the free card is the `not you` on a
    // question that was answered and did not name the customer.
    expect(count(html, "badge-error")).toBe(count(html, "ai-answers.question.not-you"));
  });

  it("still draws §4.1's matrix over the reading it does have", () => {
    // The AI-Overview reading has not gone anywhere — it is the chart, the
    // three counts and the questions list. What went is a table that said
    // it a fourth time.
    expect(count(html, CHART_ROOT)).toBe(1);
    expect(chart(html)).toContain(FREE_SECTION.ownDomain);
  });
});

describe("the cell vocabulary — four states, two of which are not misses", () => {
  it("an engine that served no answer takes the neutral badge, never the bad one (§6.2)", () => {
    const html = render(withBattery(() => NO_ANSWER, () => NO_ANSWER));
    expect(count(html, "ai-answers.question.no-answer")).toBeGreaterThanOrEqual(
      FREE_SECTION.rows.length * 2
    );
  });

  it("a question a ceiling stopped the pass reaching keeps its column and says so per cell", () => {
    // AI Mode answered the first question and nothing after it: the column
    // is drawn, and the eleven rows it never reached carry the written
    // line rather than vanishing.
    const html = render(
      withBattery(
        (index) => (index === 0 ? ANSWERED_NOT_YOU : NOT_ASKED),
        () => ANSWERED_NOT_YOU
      )
    );
    expect(headers(html)).toContain("ai-answers.engine.ai-mode");
    expect(count(html, "ai-answers.engine.not-measured")).toBe(FREE_SECTION.rows.length - 1);
  });
});

describe("what the columns deliberately do not move", () => {
  const html = render(withBattery(() => ANSWERED_NAMING, () => ANSWERED_NAMING));

  it("leaves the counts as Google's AI answers alone", () => {
    // The denominator line is the card's own sentence; the customer's
    // citation count is the matrix row beside their name, `0/9`, which is
    // where REQ-008 c3's sibling rule puts it on this card too — once.
    expect(html).toContain(
      `ai-answers.denominator(${FREE_SECTION.answeredSearches}|${FREE_SECTION.measuredSearches})`
    );
    expect(chart(html)).toContain(
      `${FREE_SECTION.customerCitations}/${FREE_SECTION.answeredSearches}`
    );
  });

  it("leaves the rival rows as the AI-Overview reading", () => {
    // They are §4.1's matrix rows now rather than a two-column table of
    // ratios (issue #352), and they are still that reading: one row per
    // rival, direct-labelled with its own name and its own count, drawn
    // from `section.rivals` — which the battery never touches.
    const matrix = chart(html);
    for (const rival of FREE_SECTION.rivals) {
      expect(matrix).toContain(rival.domain);
      expect(matrix).toContain(`${citedCount(rival.cells)}/${answeredCount(rival.cells)}`);
    }
    expect(matrix).toContain(FREE_SECTION.ownDomain);
  });
});
