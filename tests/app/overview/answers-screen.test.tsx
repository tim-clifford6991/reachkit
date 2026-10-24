/** @vitest-environment jsdom */
// SPEC §4 · §6 (2026-09-20, #908), #918 — the AI answers tab as a reader
// meets it.
//
// **Rendering convention.** `tests/app/**` runs under the `node` project,
// whose environment has no `document`; this file declares `jsdom` for
// itself and renders with `react-dom/server`'s `renderToStaticMarkup`. The
// screen is server-rendered throughout — nothing on it is pressed — so
// there is no adapter and no client boundary to stand up.
//
// **`copy()` is not mocked.** Every assertion below is about what a reader
// sees, so the real registry has to be what renders.
import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { AnswerGrid } from "@/app/(account)/app/_overview/AnswerGrid";
import { assembleAnswers, ANSWER_MARKS } from "@/app/(account)/app/_overview/answers-model";
import { FIXTURE_ANSWERS_FACTS } from "@/app/(account)/app/_overview/answers-fixture";
import { MARK_COPY_KEY } from "@/app/(account)/app/_overview/answers-words";
import { copy } from "@/lib/presentation/copy";

const MODEL = assembleAnswers(FIXTURE_ANSWERS_FACTS);

function render(node: React.JSX.Element): Element {
  const container = document.createElement("div");
  container.innerHTML = renderToStaticMarkup(node);
  return container;
}

/** The grid draws the twelve alone: the pages' own questions are the tab's
 *  *Each page in AI answers* (board AppAI). */
const TRACKED = MODEL.questions.length;

const grid = (): Element => render(<AnswerGrid model={MODEL} />);

describe("the question × engine grid", () => {
  it("is a CSS grid and not a chart (docs/DESIGN.md rule 2)", () => {
    const table = grid().querySelector('[role="table"]');
    expect(table?.className).toContain("grid");
    expect(grid().querySelector("svg.recharts-surface")).toBeNull();
  });

  it("names every mark in a written legend; Not measured only where a cell is one", () => {
    const legend = grid().querySelector('[data-testid="answers-legend"]');
    for (const mark of ANSWER_MARKS) {
      expect(legend?.textContent, mark).toContain(copy(MARK_COPY_KEY[mark]));
    }
    const read = assembleAnswers({
      ...FIXTURE_ANSWERS_FACTS,
      weeks: [{ ...FIXTURE_ANSWERS_FACTS.weeks.at(-1)!, questions: MODEL.questions.map((q) => ({ ...q, marks: q.marks.map((m) => (m === "not_measured" ? "no_answer" : m)) })) }],
    });
    const items = [...(render(<AnswerGrid model={read} />).querySelector('[data-testid="answers-legend"]')?.children ?? [])].map((li) => li.textContent?.trim());
    expect(items).toEqual(["Links to this page", "Mentions you, no link", "Mentions someone else", "No answer"]);
  });

  it("the legend says the marks in DESIGN's words, and an unmeasured cell is never a zero or a no-answer", () => {
    const items = [...(grid().querySelector('[data-testid="answers-legend"]')?.children ?? [])].map((li) => li.textContent?.trim());
    expect(items).toEqual(["Links to this page", "Mentions you, no link", "Mentions someone else", "No answer", "Not measured"]);
    const unmeasured = [...grid().querySelectorAll('[role="cell"][data-mark="not_measured"]')];
    expect(unmeasured.length).toBeGreaterThan(0);
    for (const cell of unmeasured) {
      expect(cell.getAttribute("aria-label")).toContain("Not measured");
      expect(cell.getAttribute("aria-label")).not.toMatch(/\b0\b|No answer/);
    }
  });

  it("gives every mark its own written name, so none is colour alone", () => {
    const cells = [...grid().querySelectorAll('[role="cell"]')];
    expect(cells.length).toBe(TRACKED * MODEL.engines.length);
    for (const cell of cells) {
      const label = cell.getAttribute("aria-label") ?? "";
      const mark = cell.getAttribute("data-mark") ?? "";
      expect(label, mark).toContain(copy(MARK_COPY_KEY[mark as (typeof ANSWER_MARKS)[number]]));
      // The engine and the question are in the name too: a mark that said
      // only "Links to this page" would not say which page, or where.
      expect(label.length, mark).toBeGreaterThan(copy(MARK_COPY_KEY[mark as "no_answer"]).length);
    }
  });

  it("cuts no question off: a long one wraps and its row grows", () => {
    // `checks.ts` reports a clamp outside a scroll container as a clipped
    // value, and this grid sits in none — so nothing here is clamped, and
    // the longest question in the fixture is in the document whole.
    const longest = [...MODEL.questions].sort(
      (a, b) => b.wording.text.length - a.wording.text.length
    )[0];
    const el = grid();
    expect(el.textContent).toContain(longest?.wording.text);
    for (const header of el.querySelectorAll('[role="rowheader"] span')) {
      expect(header.className).not.toContain("truncate");
      expect(header.className).not.toContain("line-clamp");
    }
  });

  it("puts the customer's own page beside the question where there is one", () => {
    const withPages = MODEL.questions.filter((q) => q.page !== null);
    expect(withPages.length).toBeGreaterThan(0);
    const links = [...grid().querySelectorAll('[data-testid="answers-page"]')];
    expect(links).toHaveLength(withPages.length);
    expect(links[0]?.getAttribute("href")).toBe(withPages[0]?.page?.url);
  });

  it("never scrolls the page sideways, and hides no mark in a scroller", () => {
    // docs/DESIGN.md's no-overflow rule. Four columns from `sm` with the
    // question column the flexible one, one column below it — and no
    // horizontal scroller anywhere, which is the decision this screen
    // records: a mark off the right edge of a scroller is a mark a phone
    // never shows.
    const table = grid().querySelector('[role="table"]');
    expect(table?.className).toContain("grid-cols-1");
    expect(table?.className).toContain("minmax(0,40rem)");
    expect(grid().querySelectorAll('[class*="overflow-x"]')).toHaveLength(0);
  });

  it("names each engine once per shape — as a column head, or beside its mark", () => {
    const el = grid();
    // The head row belongs to the four-column shape and is not drawn on a
    // phone; each cell carries its engine's name there instead.
    expect(el.querySelector('[role="row"].hidden')?.className).toContain("sm:grid-cols-subgrid");
    const inCell = [...el.querySelectorAll('[role="cell"] span')].filter((s) =>
      s.className.includes("sm:hidden")
    );
    expect(inCell).toHaveLength(TRACKED * MODEL.engines.length);
  });

  it("draws the twelve and no page question: those are the pages' own card", () => {
    const el = grid();
    expect(MODEL.pageQuestions.length).toBeGreaterThan(0);
    expect(el.querySelectorAll('[data-testid="answers-row"]')).toHaveLength(MODEL.questions.length);
    for (const question of MODEL.pageQuestions) expect(el.textContent).not.toContain(question.wording.text);
    expect(el.querySelector("summary")?.textContent).toContain(copy("overview.answers.grid.lead", { of: String(MODEL.questions.length) }));
    expect(el.querySelector("details")?.hasAttribute("open")).toBe(false);
  });

  it("shows the search each question was phrased from, beside its wording", () => {
    // REQ-093 c3: the wording is model text and is admitted only on the
    // condition that the search it came from is shown with it.
    const first = MODEL.questions[0];
    expect(grid().textContent).toContain(copy("overview.answers.from", { search: first?.search ?? "" }));
  });
});

describe("what this tab does not draw", () => {
  it("states no rank position and no sentiment", () => {
    const html = renderToStaticMarkup(<AnswerGrid model={MODEL} />);
    expect(html).not.toMatch(/rank position/i);
    expect(html).not.toMatch(/sentiment/i);
  });
});
