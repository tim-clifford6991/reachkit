// tests/generate/rules/brief-rules.test.ts — issue 475, hard rules 8–12: a
// draft may state only what the brief handed the model.
import "../env";
import { describe, expect, it } from "vitest";
import {
  checkFirstBlockAnswers,
  checkInventedProvenance,
  checkInventedTest,
  checkNewQuestionHeading,
  checkTraceableNumerals,
  type BriefRuleInputs,
} from "../../../src/lib/generate/rules/brief";

const FACT = "Teams on the starter plan get 25 seats and unlimited projects for a flat monthly fee.";
const BRIEF: BriefRuleInputs = {
  facts: [FACT],
  headings: ["Which tool should a small team pick?", "What decides it"],
  queries: ["best tools for 50 people"],
};
const OPENING = "Pick the tool whose plan covers every person who opens it daily, then check the limits.";

describe("no_invented_test", () => {
  it("fails a test nobody ran, and passes the customer's own words", () => {
    expect(checkInventedTest({ markdown: "We tested all of them for a month.", brief: BRIEF })).toEqual({
      rule: "no_invented_test",
    });
    expect(checkInventedTest({ markdown: OPENING, brief: BRIEF })).toBeNull();
    const own = { ...BRIEF, facts: ["In our tests the starter plan synced every project in under a minute."] };
    expect(checkInventedTest({ markdown: own.facts[0]!, brief: own })).toBeNull();
  });
});

describe("no_invented_provenance", () => {
  it.each(["By Jordan Lee", "Last updated on 3 March.", "This case study shows the difference."])(
    "fails %j",
    (markdown) => {
      expect(checkInventedProvenance({ markdown, brief: BRIEF })).toEqual({ rule: "no_invented_provenance" });
    }
  );
});

describe("no_new_question_heading", () => {
  it("passes the outline's own question heading and fails one it did not have", () => {
    const outlined = `## Which tool should a small team pick?\n\n${OPENING}`;
    expect(checkNewQuestionHeading({ markdown: outlined, brief: BRIEF })).toBeNull();
    expect(
      checkNewQuestionHeading({ markdown: `${outlined}\n\n## How much does it cost\n\nIt varies.`, brief: BRIEF })
    ).toEqual({ rule: "no_new_question_heading" });
  });
});

describe("traceable_numerals", () => {
  it("passes a numeral a fact or the target carries, and a count below the floor", () => {
    const markdown = "The starter plan gets 25 seats. It suits teams of 50. Three steps, 2 checks.";
    expect(checkTraceableNumerals({ markdown, brief: BRIEF })).toBeNull();
  });

  it("fails a numeral nothing handed carries, unless it stands beside its source", () => {
    expect(checkTraceableNumerals({ markdown: "Most teams save 40 hours.", brief: BRIEF })).toEqual({
      rule: "traceable_numerals",
      detail: { rule: "traceable_numerals", figure: "40" },
    });
    expect(
      checkTraceableNumerals({ markdown: "Rivals list 40 seats ([pricing](https://rival.example/p)).", brief: BRIEF })
    ).toBeNull();
  });
});

describe("first_block_answers", () => {
  it("passes an opening paragraph inside the bound", () => {
    expect(checkFirstBlockAnswers({ markdown: `## Which tool?\n\n${OPENING}` })).toBeNull();
  });

  it.each([
    ["too short", "## Which tool?\n\nIt depends."],
    ["a question", `## Which tool?\n\n${OPENING.slice(0, -1)}?`],
    ["a list", `## Which tool?\n\n- ${OPENING}`],
    ["too long", `## Which tool?\n\n${"word ".repeat(80)}`],
  ])("fails an opening that is %s", (_why, markdown) => {
    expect(checkFirstBlockAnswers({ markdown })).toEqual({ rule: "first_block_answers" });
  });
});
