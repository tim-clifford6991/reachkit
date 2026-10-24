// SPEC §6 (2026-09-20, #908), #918 — the AI tab's grid model, decided
// without a browser: the latest pass's questions, in its own order, with no
// rank and no sentiment to render.
import { describe, expect, it } from "vitest";
import { fromStored } from "@/lib/presentation/generated";
import {
  assembleAnswers,
  type AnswerMark,
  type AnswerQuestion,
  type AnswersFacts,
} from "@/app/(account)/app/_overview/answers-model";

const AT = new Date("2026-08-31T06:00:00.000Z");

/** One question, with the three engine marks it is handed. */
function question(n: number, marks: readonly AnswerMark[]): AnswerQuestion {
  return {
    n,
    wording: fromStored("questions.wording", `Question ${n}?`),
    search: `search ${n}`,
    marks,
    page: null,
  };
}

/** A window of weeks, each one a list of per-question mark triples. */
function facts(weeks: readonly (readonly (readonly AnswerMark[])[])[]): AnswersFacts {
  return {
    weeks: weeks.map((week, w) => ({
      weekStart: new Date(AT.getTime() - (weeks.length - 1 - w) * 7 * 86_400_000),
      questions: week.map((marks, i) => question(i + 1, marks)),
    })),
    measuredAt: AT,
  };
}

describe("the grid", () => {
  it("draws the latest pass's questions, in the pass's own order", () => {
    const model = assembleAnswers(
      facts([
        [["links_to_you", "no_answer", "no_answer"]],
        [["names_others", "no_answer", "no_answer"], ["links_to_you", "no_answer", "no_answer"]],
      ]));
    expect(model.questions.map((q) => q.n)).toEqual([1, 2]);
    expect(model.questions[0]?.marks[0]).toBe("names_others");
  });

  it("states no rank position and no sentiment, because it holds neither", () => {
    // SPEC §4, 2026-09-20: "'AI rank position' and sentiment are never
    // shown." A field that does not exist cannot be rendered by mistake.
    const model = assembleAnswers(facts([[["links_to_you", "no_answer", "no_answer"]]]));
    const members = Object.keys(model.questions[0] ?? {});
    expect(members).not.toContain("position");
    expect(members).not.toContain("rank");
    expect(members).not.toContain("sentiment");
  });
});
