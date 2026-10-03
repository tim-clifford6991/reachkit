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
  it("fails a case study, and no longer a byline or a date — those are the page's own since 2026-09-29", () => {
    expect(checkInventedProvenance({ markdown: "This case study shows the difference.", brief: BRIEF })).toEqual({
      rule: "no_invented_provenance",
    });
    for (const markdown of ["By Jordan Lee", "Last updated on 3 March."]) {
      expect(checkInventedProvenance({ markdown, brief: BRIEF })).toBeNull();
    }
  });
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
  it.each([
    [39, false],
    [40, true],
    [60, true],
    [61, false],
  ])("a short-answer box of %i words answers: %s", (words, answers) => {
    const markdown = `:::answer\n${"word ".repeat(words).trim()}.\n:::\n\n## Which tool?\n\n${OPENING}`;
    expect(checkFirstBlockAnswers({ markdown }) === null).toBe(answers);
  });

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

// Issue 1187: each of these stopped a stored draft or a kept evaluation
// draft that had done nothing the rule exists to stop.
describe("what the phrase rules no longer stop", () => {
  it.each([
    "Pages written by a person who can interview you.",
    "Every page is written from your facts and published on your domain.",
    "By subscribing you ask us to begin at once.",
    "Look for case studies on the vendor's own site.",
  ])("no_invented_provenance passes %j", (markdown) => {
    expect(checkInventedProvenance({ markdown, brief: { ...BRIEF, facts: [] } })).toBeNull();
  });

  it("no_invented_test passes a cited article's title, and still fails the page's own claim beside a link", () => {
    const cited = "Rankability, [We tested 15 best AI SEO tools. Here are the winners.](https://rival.example/tested)";
    expect(checkInventedTest({ markdown: cited, brief: BRIEF })).toBeNull();
    expect(
      checkInventedTest({ markdown: "We tested all of them, per [our notes](https://example.com/n).", brief: BRIEF })
    ).toEqual({ rule: "no_invented_test" });
    expect(checkInventedTest({ markdown: "A hands-on tool for small teams.", brief: BRIEF })).toBeNull();
  });
});

describe("what traceable_numerals no longer stops", () => {
  it("a link's label with a full stop inside it still sources its figure", () => {
    const markdown = "Rivals list 40 seats, per [We counted 40. Here is how.](https://rival.example/p)";
    expect(checkTraceableNumerals({ markdown, brief: BRIEF })).toBeNull();
  });

  it("a figure cited beside a link may be repeated without one; a different figure may not", () => {
    const cited = "Cited pages are quoted [up to 40% more](https://study.example/geo).";
    expect(checkTraceableNumerals({ markdown: `${cited}\n\nSo 40% is the figure to remember.`, brief: BRIEF })).toBeNull();
    expect(checkTraceableNumerals({ markdown: `${cited}\n\nOthers say 60%.`, brief: BRIEF })?.rule).toBe(
      "traceable_numerals"
    );
  });

  it("a year and a name with digits in it are not figures", () => {
    const markdown = "Since 2019 the firm has held ISO27001, and its GA4 export is free.";
    expect(checkTraceableNumerals({ markdown, brief: BRIEF })).toBeNull();
  });
});

describe("first_block_answers and the short-answer box", () => {
  const sixty = `${"answer ".repeat(59)}end.`;
  it("passes an answer of 60 words past 320 characters, inside its `:::answer` fence", () => {
    expect(sixty.length).toBeGreaterThan(320);
    expect(checkFirstBlockAnswers({ markdown: `# Which tool?\n\n:::answer\n${sixty}\n:::\n\nMore.` })).toBeNull();
  });
});
