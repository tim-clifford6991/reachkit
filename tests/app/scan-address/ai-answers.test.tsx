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

/** Counts non-overlapping occurrences — every needle here is a distinct key. */
function count(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

/** The `<th>` texts of the first table on the card, which is the engine
 *  table: the rival table follows it. */
function headers(html: string): string[] {
  return [...html.matchAll(/<th>([^<]*)<\/th>/g)].map((m) => m[1] ?? "");
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
      expect(html).toContain(`class="num min-w-0 break-words">${row.question.n}<`);
    }
  });

  it("says, in writing, that an engine named the customer — the state the one-column card renders as nothing", () => {
    expect(count(html, "ai-answers.engine.cell.cited")).toBe(FREE_SECTION.rows.length);
  });

  it("names no engine as never asked, because every one of them was", () => {
    expect(html).not.toContain("ai-answers.engine.not-measured");
  });

  it("adds no chart: the columns are §2.2's table, and §2.4's inventory stays closed at five", () => {
    expect(html).not.toContain("<svg");
  });
});

describe("§6.2 — the free report keeps one column, and never asked is never a miss", () => {
  const html = render(FREE_SECTION);

  it("draws a column only for the engine something actually asked", () => {
    expect(headers(html).slice(0, 2)).toEqual([
      "ai-answers.engine.column.question",
      "ai-answers.engine.ai-overview",
    ]);
    expect(headers(html)).not.toContain("ai-answers.engine.ai-mode");
    expect(headers(html)).not.toContain("ai-answers.engine.chatgpt");
  });

  it("names each engine it never asked once, beside the written line that says so", () => {
    expect(count(html, "ai-answers.engine.ai-mode")).toBe(1);
    expect(count(html, "ai-answers.engine.chatgpt")).toBe(1);
    expect(count(html, "ai-answers.engine.not-measured")).toBe(2);
  });

  it("states it neutrally — a question nobody asked is never the customer's problem (§2.5)", () => {
    const lines = [...html.matchAll(/<p class="flex flex-wrap items-center gap-2 text-xs">(.*?)<\/p>/g)];
    expect(lines).toHaveLength(2);
    for (const line of lines) expect(line[1]).not.toContain("badge-error");
  });

  it("counts the twelve rows' worth of cells once, not once per unasked engine", () => {
    // Twelve rows of "not measured" down two columns would read as
    // twenty-four places the customer lost. The two lines are the whole
    // statement.
    expect(count(html, "ai-answers.engine.not-measured")).toBe(2);
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

  it("leaves the three counts as Google's AI answers alone", () => {
    expect(html).toContain(
      `ai-answers.denominator(${FREE_SECTION.answeredSearches}|${FREE_SECTION.measuredSearches})`
    );
    expect(html).toContain(
      `ai-answers.customer-citations(${FREE_SECTION.customerCitations}|${FREE_SECTION.answeredSearches})`
    );
  });

  it("leaves the rival rows as the AI-Overview reading", () => {
    expect(html).toContain("ai-answers.matrix.column.domain");
    for (const rival of FREE_SECTION.rivals) expect(html).toContain(rival.domain);
  });
});
