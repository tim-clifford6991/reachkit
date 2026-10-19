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
import { AnswerTiles } from "@/app/(account)/app/_overview/AnswerTiles";
import { assembleAnswers, ANSWER_MARKS } from "@/app/(account)/app/_overview/answers-model";
import { FIXTURE_ANSWERS_FACTS } from "@/app/(account)/app/_overview/answers-fixture";
import { MARK_COPY_KEY } from "@/app/(account)/app/_overview/answers-words";
import { copy } from "@/lib/presentation/copy";
import { PAGE_QUESTION_RETIRE_WEEKS } from "@/lib/config/constants";

const AT = FIXTURE_ANSWERS_FACTS.measuredAt ?? new Date(0);
const MODEL = assembleAnswers(FIXTURE_ANSWERS_FACTS, AT);

function render(node: React.JSX.Element): Element {
  const container = document.createElement("div");
  container.innerHTML = renderToStaticMarkup(node);
  return container;
}

/** Every row the grid draws: the twelve the market selected, and the page
 *  questions beside them (#919). The two are separate members of the model
 *  on purpose — the rate and this week's n of 12 count the first alone —
 *  and this is the count of what a reader actually meets. */
const TRACKED = MODEL.questions.length + MODEL.pageQuestions.length;

const tiles = (): Element => render(<AnswerTiles model={MODEL} />);
const grid = (): Element => render(<AnswerGrid model={MODEL} />);

describe("the two tiles", () => {
  it("states the four-week rate over the answers that were asked", () => {
    const el = tiles();
    expect(el.querySelector('[data-testid="answers-tile-rate-value"]')?.textContent).toBe(
      String(MODEL.rate.linked + MODEL.rate.named)
    );
    expect(el.textContent).toContain(
      copy("overview.answers.rate.of", {
        of: String(MODEL.rate.of.kind === "measured" ? MODEL.rate.of.value : 0),
      })
    );
  });

  it("says why four weeks, in one line", () => {
    expect(tiles().textContent).toContain("One week alone is too noisy to trust.");
  });

  it("counts named and linked apart", () => {
    expect(tiles().textContent).toContain(
      copy("overview.answers.rate.split", {
        linked: String(MODEL.rate.linked),
        named: String(MODEL.rate.named),
      })
    );
  });

  it("puts this week's count against the twelve and the goal, with no change beside it", () => {
    const el = tiles();
    expect(el.textContent).toContain(copy("overview.tile.ai-answers.of", { of: String(MODEL.week.of) }));
    expect(el.textContent).toContain(copy("overview.goal", { value: String(MODEL.week.goal) }));
    // REQ-041 c12: one reading of AI-answer movement, and this is not it.
    // The two delta glyphs are the registry's own marks; neither is drawn.
    expect(el.textContent).not.toContain(copy("overview.delta.up"));
    expect(el.textContent).not.toContain(copy("overview.delta.down"));
  });

  it("says which engine this week's count is from", () => {
    expect(tiles().textContent).toContain(
      copy("overview.answers.week.means", { engine: copy("ai-answers.engine.ai-overview") })
    );
  });
});

describe("the question × engine grid", () => {
  it("is a CSS grid and not a chart (docs/DESIGN.md rule 2)", () => {
    const table = grid().querySelector('[role="table"]');
    expect(table?.className).toContain("grid");
    expect(grid().querySelector("svg.recharts-surface")).toBeNull();
  });

  it("names every mark in a written legend, all five of them, always", () => {
    const legend = grid().querySelector('[data-testid="answers-legend"]');
    for (const mark of ANSWER_MARKS) {
      expect(legend?.textContent, mark).toContain(copy(MARK_COPY_KEY[mark]));
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
      // only "Links to you" would not say who to, or where.
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
    const withPages = [...MODEL.questions, ...MODEL.pageQuestions].filter((q) => q.page !== null);
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

  it("draws the published pages' own questions as rows, and states the cap they obey", () => {
    // SPEC §6 (2026-09-20, #919), board R4-06: "21 of 24 at most". The page
    // questions are rows of this one grid — they are tracked questions,
    // asked of the same three engines in the same pass — and the line under
    // the title is where the set's size and its ceiling are stated.
    const el = grid();
    expect(MODEL.pageQuestions.length).toBeGreaterThan(0);
    expect(el.querySelectorAll('[data-testid="answers-row"]')).toHaveLength(TRACKED);
    for (const question of MODEL.pageQuestions) {
      expect(el.textContent, "a page's own question is a row").toContain(question.wording.text);
    }
    expect(el.querySelector('[data-testid="answers-tracked"]')?.textContent).toBe(
      copy("overview.answers.grid.tracked", {
        tracked: String(TRACKED),
        max: String(MODEL.cap),
        weeks: String(PAGE_QUESTION_RETIRE_WEEKS),
      })
    );
  });

  it("counts the four-week rate and this week over the twelve, whatever the pages did", () => {
    // The rate and the n of 12 are published figures a customer has been
    // watching; neither moves because ReachKit published a page. The proof
    // is the denominator: the same facts with the page questions taken out
    // give the same two numbers.
    const withoutPages = assembleAnswers(
      {
        ...FIXTURE_ANSWERS_FACTS,
        weeks: FIXTURE_ANSWERS_FACTS.weeks.map(({ pageQuestions, ...week }) => {
          void pageQuestions;
          return week;
        }),
      },
      AT
    );
    expect(MODEL.rate).toEqual(withoutPages.rate);
    expect(MODEL.week).toEqual(withoutPages.week);
    expect(MODEL.tracked).toBe(TRACKED);
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
    const html = renderToStaticMarkup(
      <>
        <AnswerTiles model={MODEL} />
        <AnswerGrid model={MODEL} />
      </>
    );
    expect(html).not.toMatch(/rank position/i);
    expect(html).not.toMatch(/sentiment/i);
  });

  it("stands nothing in for the cards that wait on their own issues", () => {
    // *Also appearing for* and the cited-pages tile (#920), the
    // hosted-blog counts (#921) and a thirteenth question (#919) arrive
    // with those issues. A placeholder for an unbought measurement is a
    // claim, so this screen draws exactly three tiles (the pages cited,
    // issue 1551, the rate and the week) and one grid.
    expect(tiles().querySelectorAll("section")).toHaveLength(3);
    expect(grid().querySelectorAll("section")).toHaveLength(1);
  });
});

describe("a site with no measured pass", () => {
  const empty = assembleAnswers({ weeks: [], measuredAt: null }, AT);

  it("says so in words, and draws no grid of dashes", () => {
    const el = render(<AnswerGrid model={empty} />);
    expect(el.textContent).toContain(copy("overview.answers.empty"));
    expect(el.querySelectorAll('[role="cell"]')).toHaveLength(0);
  });

  it("shows each tile's written line where its number would stand, never a zero", () => {
    const el = render(<AnswerTiles model={empty} />);
    expect(el.querySelector('[data-testid="answers-tile-rate-value"]')).toBeNull();
    expect(el.querySelector('[data-testid="answers-tile-week-value"]')).toBeNull();
    expect(el.textContent).not.toContain("0");
  });
});
