// tests/generate/rules/battery.test.ts — `runHardRules`, BUILD §8's
// "enforced in code, not prompts".
//
// What this suite pins: every rule runs (not just the first), the order is
// `HARD_RULES`' order so a stored failure list is comparable across runs,
// the do-not-claim arm is delegated rather than re-implemented, and an
// unrun claim check never appears as a rule failure.
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
    rendered: renderOf(markdown),
    site: siteInputs(over),
    comparison: emptyComparison(),
    grounded: GROUNDED,
    sourceText: SOURCE_TEXT,
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
      "brand_gap",
      "no_hidden_text",
      "no_machine_address",
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

  it("the check reaches a model through `llm()` and never through the cost context directly", async () => {
    // `fakeCost().recordFetch` throws; a battery that spent any other way
    // than through `llm()` would fail here rather than go unexercised.
    await expect(run(CLEAN_MARKDOWN, { doNotClaim: ["something not stated"] })).resolves.toBeDefined();
    expect(llmMock).toHaveBeenCalledTimes(1);
  });
});

describe("an unrun claim check is a step that did not run, not a rule that failed", () => {
  it("does not appear in `failed`, and is handed back on the verdict for the caller to act on", async () => {
    llmMock.mockResolvedValue({ kind: "unmeasured", reason: "undeterminable", at: AT });
    const outcome = await run(CLEAN_MARKDOWN, { doNotClaim: ["something not stated"] });
    expect(outcome.claim.state).toBe("unrun");
    expect(outcome.passed === false && outcome.failed.some((f) => f.rule === "do_not_claim")).not.toBe(
      true
    );
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
