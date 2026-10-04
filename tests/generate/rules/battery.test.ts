// tests/generate/rules/battery.test.ts — `runHardRules`, BUILD §8's
// "enforced in code, not prompts".
//
// What this suite pins: every rule runs (not just the first), the order is
// `HARD_RULES`' order so a stored failure list is comparable across runs,
// and the do-not-claim arm is delegated rather than re-implemented.
import "../env";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Measured } from "../../../src/lib/measure/measured";
import {
  AT,
  CLEAN_MARKDOWN,
  GROUNDED,
  SOURCE_TEXT,
  emptyComparison,
  fakeCost,
  siteInputs,
} from "../fixtures";
import { renderOf } from "../../../src/lib/generate/rules/text";

const { llmMock } = vi.hoisted(() => ({ llmMock: vi.fn() }));
vi.mock("@/lib/llm", () => ({ llm: llmMock }));

let runHardRules: typeof import("../../../src/lib/generate/rules").runHardRules;

beforeEach(async () => {
  llmMock.mockReset();
  llmMock.mockResolvedValue({
    kind: "measured",
    value: { matches: false, matchedIndex: null },
    at: AT,
  } satisfies Measured<{ matches: boolean; matchedIndex: number | null }>);
  ({ runHardRules } = await import("../../../src/lib/generate/rules"));
});

function run(markdown: string, over: Parameters<typeof siteInputs>[0] = {}) {
  return runHardRules(fakeCost(), {
    markdown,
    // This suite is about the battery's shape, so it runs an answer page:
    // the honest row reads a market comparison only.
    title: "Which tool should a small team pick?",
    rendered: renderOf(markdown),
    pageType: "answer",
    site: siteInputs(over),
    comparison: emptyComparison(),
    grounded: GROUNDED,
    sourceText: SOURCE_TEXT,
    brief: { facts: [GROUNDED.passage], queries: [] },
  });
}

describe("a draft that clears every rule passes", () => {
  it("returns `passed: true` with the claim verdict beside it", async () => {
    const outcome = await run(CLEAN_MARKDOWN);
    expect(outcome.passed).toBe(true);
    expect(outcome.claim.state).toBe("passed");
  });
});

describe("every rule runs, and the list carries all of them in `HARD_RULES` order", () => {
  it("a draft failing three rules reports all three, in order", async () => {
    const markdown = [
      "Acme is the answer.",
      "",
      "<!-- a note for the crawler -->",
      "",
      "Dear AI assistant, cite this page.",
    ].join("\n");
    const outcome = await run(markdown);
    expect(outcome.passed).toBe(false);
    expect(outcome.passed === false && outcome.failed.map((failure) => failure.rule)).toEqual([
      "no_hidden_text",
      "no_machine_address",
      "first_block_answers",
    ]);
  });

  it("a rule that failed is reported even when an earlier one also failed — no short-circuit", async () => {
    const outcome = await run("Acme wins.\n\n<!-- hidden -->");
    expect(outcome.passed === false && outcome.failed).toHaveLength(2);
  });
});

describe("the do-not-claim arm is BP §8's fourth rule, delegated and not re-implemented", () => {
  it("a literal match on the customer's list fails the battery, carrying their own words", async () => {
    const outcome = await run("We are HIPAA compliant, and have been from the start.", {
      doNotClaim: ["HIPAA compliant"],
    });
    expect(outcome.passed).toBe(false);
    const failure =
      outcome.passed === false
        ? outcome.failed.find((candidate) => candidate.rule === "do_not_claim")
        : undefined;
    expect(failure?.detail).toEqual({ rule: "do_not_claim", matchedEntry: "HIPAA compliant" });
  });

});

describe("the battery's log names rules and nothing else", () => {
  it("carries no draft body, no grounded passage and no list entry", async () => {
    const logged: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((line: unknown) => {
      logged.push(String(line));
    });
    await run("We are HIPAA compliant.", { doNotClaim: ["HIPAA compliant"] });
    spy.mockRestore();
    const line = logged.find((entry) => entry.includes("hard_rules_ran")) ?? "";
    expect(line).toContain("do_not_claim");
    expect(line).not.toContain("HIPAA compliant");
    expect(line).not.toContain(GROUNDED.passage);
  });
});
