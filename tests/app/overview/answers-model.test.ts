// SPEC §6 (2026-09-20, #908), #918 — what the AI answers tab states,
// decided without a browser.
//
// The model is pure over its facts, so the four rules worth holding are
// held here rather than read off a render: the four-week rate's
// denominator, named and linked counted apart, this week's n of 12 counted
// from one engine, and REQ-004 — a reading nobody took never becomes a
// zero.
import { describe, expect, it } from "vitest";
import { fromStored } from "@/lib/presentation/generated";
import { ANSWER_RATE_WEEKS, BATTERY, GOAL_VALUES } from "@/lib/config/constants";
import {
  assembleAnswers,
  FULL_WINDOW,
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

describe("the four-week rate", () => {
  it("counts answers that named or linked the site over the answers that were asked", () => {
    const model = assembleAnswers(
      facts([
        [["links_to_you", "names_others", "no_answer"]],
        [["names_you", "names_others", "names_others"]],
      ]),
      AT
    );
    // Six cells, all of them asked; two of them reached the site.
    expect(model.rate.of.kind === "measured" && model.rate.of.value).toBe(6);
    expect(model.rate.value.kind === "measured" && model.rate.value.value).toBe(2);
  });

  it("leaves an unmeasured cell out of the denominator — it is never a miss", () => {
    const measured = assembleAnswers(facts([[["links_to_you", "names_others", "names_others"]]]), AT);
    const partial = assembleAnswers(facts([[["links_to_you", "not_measured", "not_measured"]]]), AT);
    expect(measured.rate.of.kind === "measured" && measured.rate.of.value).toBe(3);
    // The same one answer reached the site; two cells nobody read cannot
    // make that a worse week than the one in which all three were read.
    expect(partial.rate.of.kind === "measured" && partial.rate.of.value).toBe(1);
    expect(partial.rate.value.kind === "measured" && partial.rate.value.value).toBe(1);
  });

  it("keeps an answer that served nothing in the denominator — it was asked", () => {
    const model = assembleAnswers(facts([[["no_answer", "no_answer", "links_to_you"]]]), AT);
    expect(model.rate.of.kind === "measured" && model.rate.of.value).toBe(3);
    expect(model.rate.value.kind === "measured" && model.rate.value.value).toBe(1);
  });

  it("counts named and linked apart, and the two add up to the rate", () => {
    const model = assembleAnswers(
      facts([[["links_to_you", "names_you", "names_others"], ["links_to_you", "no_answer", "names_you"]]]),
      AT
    );
    expect(model.rate.linked).toBe(2);
    expect(model.rate.named).toBe(2);
    expect(model.rate.value.kind === "measured" && model.rate.value.value).toBe(
      model.rate.linked + model.rate.named
    );
  });

  it("shrinks its denominator, not its window, when a site has fewer passes", () => {
    // One pass of three engines is three answers asked, against the
    // window's own 12 × 3 × 4. The sentence beside the figure describes the
    // window; the denominator describes the measurement.
    const one = assembleAnswers(facts([[["links_to_you", "no_answer", "no_answer"]]]), AT);
    expect(one.rate.of.kind === "measured" && one.rate.of.value).toBe(3);
    expect(FULL_WINDOW.weeks).toBe(ANSWER_RATE_WEEKS);
    expect(FULL_WINDOW.questions * FULL_WINDOW.engines * FULL_WINDOW.weeks).toBe(144);
  });

  it("a window nobody could read is unmeasured, and never a zero", () => {
    const none = assembleAnswers({ weeks: [], measuredAt: null }, AT);
    expect(none.rate.value.kind).toBe("unmeasured");
    expect(none.rate.of.kind).toBe("unmeasured");
    const unread = assembleAnswers(facts([[["not_measured", "not_measured", "not_measured"]]]), AT);
    expect(unread.rate.value.kind).toBe("unmeasured");
  });

  it("a window that was read and named nobody is a measured zero, not a dash", () => {
    const model = assembleAnswers(facts([[["names_others", "names_others", "no_answer"]]]), AT);
    expect(model.rate.value.kind).toBe("zero");
    expect(model.rate.of.kind === "measured" && model.rate.of.value).toBe(3);
  });
});

describe("this week's n of 12", () => {
  it("counts the latest pass alone, from Google's AI Overview column", () => {
    const model = assembleAnswers(
      facts([
        // Last week: every question linked. It must not reach this tile.
        [["links_to_you", "names_others", "names_others"], ["links_to_you", "names_others", "names_others"]],
        // This week: one question's AI Overview named the site; the second
        // was reached only by the engines that are not counted from.
        [["names_you", "names_others", "names_others"], ["names_others", "links_to_you", "links_to_you"]],
      ]),
      AT
    );
    expect(model.week.value.kind === "measured" && model.week.value.value).toBe(1);
    expect(model.week.engine).toBe("ai_overview");
  });

  it("carries the twelve and the goal, and no change at all (REQ-041 c12)", () => {
    const model = assembleAnswers(facts([[["links_to_you", "no_answer", "no_answer"]]]), AT);
    expect(model.week.of).toBe(BATTERY.QUESTIONS);
    expect(model.week.goal).toBe(GOAL_VALUES.ai_answers);
    expect(Object.keys(model.week)).not.toContain("delta");
  });

  it("is unmeasured where the latest pass never reached that column", () => {
    const model = assembleAnswers(facts([[["not_measured", "links_to_you", "links_to_you"]]]), AT);
    expect(model.week.value.kind).toBe("unmeasured");
  });
});

describe("the grid", () => {
  it("draws the latest pass's questions, in the pass's own order", () => {
    const model = assembleAnswers(
      facts([
        [["links_to_you", "no_answer", "no_answer"]],
        [["names_others", "no_answer", "no_answer"], ["links_to_you", "no_answer", "no_answer"]],
      ]),
      AT
    );
    expect(model.questions.map((q) => q.n)).toEqual([1, 2]);
    expect(model.questions[0]?.marks[0]).toBe("names_others");
  });

  it("states no rank position and no sentiment, because it holds neither", () => {
    // SPEC §4, 2026-09-20: "'AI rank position' and sentiment are never
    // shown." A field that does not exist cannot be rendered by mistake.
    const model = assembleAnswers(facts([[["links_to_you", "no_answer", "no_answer"]]]), AT);
    const members = Object.keys(model.questions[0] ?? {});
    expect(members).not.toContain("position");
    expect(members).not.toContain("rank");
    expect(members).not.toContain("sentiment");
  });
});
