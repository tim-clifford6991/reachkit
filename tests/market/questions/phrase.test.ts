// tests/market/questions/phrase.test.ts — BUILD §6.7 step 4, issue #26
// (WO-075's `## Test plan`).
//
// No network: `@/lib/llm` is stubbed whole. The two things this file exists
// to make structural — the model cannot move a question's search, and a
// failed phrasing degrades to a template rather than dropping a question —
// are each written so that deleting the behaviour fails a named test.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ZodType } from "zod";
import { SERP_LOCATION } from "../../../src/lib/config/constants.ts";
import type { CostContext } from "../../../src/lib/costs/index.ts";
import type { SelectedSearch } from "../../../src/lib/market/questions/select.ts";
import type { Question } from "../../../src/lib/market/questions/phrase.ts";

interface RecordedLlmCall {
  site: string;
  input: unknown;
  schema: ZodType<unknown>;
  tier: string;
}

const { llmMock } = vi.hoisted(() => ({ llmMock: vi.fn() }));
vi.mock("@/lib/llm", () => ({ llm: llmMock }));

let phraseQuestions: typeof import("../../../src/lib/market/questions/phrase.ts").phraseQuestions;
let templateQuestion: typeof import("../../../src/lib/market/questions/phrase.ts").templateQuestion;
let PHRASE_TASK: string;

beforeEach(async () => {
  llmMock.mockReset();
  vi.spyOn(console, "log").mockImplementation(() => {});
  ({ phraseQuestions, templateQuestion, PHRASE_TASK } = await import("../../../src/lib/market/questions/phrase.ts"));
});

const AT = new Date("2026-09-05T00:00:00.000Z");

function selection(): SelectedSearch[] {
  return [
    { keyword: "best user onboarding software", volume: 2400, intent: "decision", score: 10.1, rank: 1 },
    { keyword: "appcues vs userpilot", volume: 720, intent: "decision", score: 8.5, rank: 2 },
    { keyword: "user onboarding software", volume: 3600, intent: "solution", score: 10.6, rank: 3 },
  ];
}

function modelWordings(texts: Record<string, string>) {
  return {
    kind: "measured" as const,
    at: AT,
    value: { questions: Object.entries(texts).map(([id, text]) => ({ id, text })) },
  };
}

function fakeCostContext(): CostContext {
  return {
    cap: "FREE",
    async recordFetch() {
      throw new Error("phraseQuestions must call llm(), not CostContext.recordFetch directly");
    },
    capHit: () => false,
    spentCents: () => 0,
    degraded: () => false,
  };
}

describe("phraseQuestions — the one nano call it issues", () => {
  it("phraseQuestions/issues-exactly-one-nano-call — one llm() invocation, site 'question-phrasing', tier 'nano', with the caller's own CostContext", async () => {
    llmMock.mockResolvedValueOnce(modelWordings({}));
    const c = fakeCostContext();

    await phraseQuestions(c, { selected: selection() });

    expect(llmMock).toHaveBeenCalledTimes(1);
    expect(llmMock.mock.calls[0]![0]).toBe(c);
    const call = llmMock.mock.calls[0]![1] as RecordedLlmCall;
    expect(call.site).toBe("question-phrasing");
    expect(call.tier).toBe("nano");
  });

  it("phraseQuestions/sends-the-task-and-the-keywords — the model sees the fixed task, then the ids and the keywords and nothing else — no volume, no intent, no rank, no score", async () => {
    llmMock.mockResolvedValueOnce(modelWordings({}));

    await phraseQuestions(fakeCostContext(), { selected: selection() });

    const call = llmMock.mock.calls[0]![1] as RecordedLlmCall;
    const input = call.input as { task: unknown; keywords: unknown };
    expect(Object.keys(input)).toEqual(["task", "keywords"]);
    expect(input.task).toBe(PHRASE_TASK);
    expect(input.keywords).toEqual([
      { id: "q1", keyword: "best user onboarding software" },
      { id: "q2", keyword: "appcues vs userpilot" },
      { id: "q3", keyword: "user onboarding software" },
    ]);
    const json = JSON.stringify(call.input);
    for (const leaked of ["volume", "intent", "score", "rank", "2400"]) {
      expect(json).not.toContain(leaked);
    }
  });

  it("phraseQuestions/task-says-what-a-question-is — one per keyword, a buyer's words, no brand or superlative the keyword lacks, one sentence with a question mark, the market's language (issue #519)", () => {
    for (const clause of [
      "one question per keyword",
      "in the buyer's own words",
      "standing for that search and no other",
      "Name no brand, product or company the keyword does not itself name",
      'add no "best" or "top" the keyword does not carry',
      "one sentence and ends with a question mark",
      `${SERP_LOCATION.language}, as searched on Google in ${SERP_LOCATION.location}`,
    ]) {
      expect(PHRASE_TASK).toContain(clause);
    }
  });

  it("phraseQuestions/schema-rejects-a-returned-keyword — a response carrying a keyword per element does not parse", async () => {
    llmMock.mockResolvedValueOnce(modelWordings({}));
    await phraseQuestions(fakeCostContext(), { selected: selection() });
    const { schema } = llmMock.mock.calls[0]![1] as RecordedLlmCall;

    // The list rides inside `questions` (issue #512): a forced tool's input
    // is an object, so the bare array itself no longer parses.
    expect(schema.safeParse({ questions: [{ id: "q1", text: "What's the best?" }] }).success).toBe(true);
    expect(schema.safeParse([{ id: "q1", text: "What's the best?" }]).success).toBe(false);
    expect(
      schema.safeParse({ questions: [{ id: "q1", text: "What's the best?", keyword: "something else" }] })
        .success
    ).toBe(false);
    expect(schema.safeParse({ questions: [{ id: "q1", text: "x", volume: 900 }] }).success).toBe(false);
    expect(schema.safeParse({ questions: [{ id: "q1" }] }).success).toBe(false);
  });

  it("spends nothing on an empty selection — zero, and no model call", async () => {
    const result = await phraseQuestions(fakeCostContext(), { selected: [] });

    expect(llmMock).not.toHaveBeenCalled();
    expect(result.kind).toBe("zero");
    expect((result as { value: Question[] }).value).toEqual([]);
  });
});

describe("phraseQuestions — the wording never moves the search", () => {
  it("phraseQuestions/wording-never-moves-the-search — every returned question carries the input SelectedSearch by reference", async () => {
    const selected = selection();
    llmMock.mockResolvedValueOnce(
      modelWordings({
        q1: "What's the best user onboarding software?",
        q2: "Appcues or Userpilot — which should I pick?",
        q3: "Which user onboarding software should I use?",
      })
    );

    const result = await phraseQuestions(fakeCostContext(), { selected });

    const questions = (result as { value: Question[] }).value;
    expect(questions).toHaveLength(3);
    for (const [index, question] of questions.entries()) {
      expect(question.search).toBe(selected[index]);
      expect(question.phrasing).toBe("model");
    }
    expect(questions.map((q) => q.id)).toEqual(["q1", "q2", "q3"]);
  });

  it("a model wording for an id it was never given changes nothing — the unanswered questions take the template", async () => {
    const selected = selection();
    llmMock.mockResolvedValueOnce(
      modelWordings({ q9: "A question about a search that was never selected" })
    );

    const result = await phraseQuestions(fakeCostContext(), { selected });

    const questions = (result as { value: Question[] }).value;
    expect(questions.map((q) => q.search.keyword)).toEqual(selected.map((s) => s.keyword));
    expect(questions.every((q) => q.phrasing === "template")).toBe(true);
    expect(JSON.stringify(questions.map((q) => q.text))).not.toContain("never selected");
  });
});

describe("phraseQuestions — a failed phrasing degrades, it never drops (the denominator)", () => {
  it("phraseQuestions/failure-degrades-never-drops (a) the model omits one id", async () => {
    const selected = selection();
    llmMock.mockResolvedValueOnce(
      modelWordings({ q1: "What's the best one?", q3: "Which software?" })
    );

    const result = await phraseQuestions(fakeCostContext(), { selected });

    const questions = (result as { value: Question[] }).value;
    expect(questions).toHaveLength(selected.length);
    expect(questions.map((q) => q.phrasing)).toEqual(["model", "template", "model"]);
    expect(questions[1]!.text).toBe(templateQuestion("appcues vs userpilot"));
  });

  it("phraseQuestions/failure-degrades-never-drops (b) the model returns nothing parseable for any id", async () => {
    const selected = selection();
    llmMock.mockResolvedValueOnce(modelWordings({ q1: "   ", q2: "", q3: "  " }));

    const result = await phraseQuestions(fakeCostContext(), { selected });

    const questions = (result as { value: Question[] }).value;
    expect(questions).toHaveLength(selected.length);
    expect(questions.every((q) => q.phrasing === "template")).toBe(true);
    expect(questions.every((q) => q.text.length > 0)).toBe(true);
  });

  it("phraseQuestions/failure-degrades-never-drops (c) llm() returns unmeasured — every question is a template, and the set is still measured", async () => {
    const selected = selection();
    llmMock.mockResolvedValueOnce({ kind: "unmeasured", reason: "undeterminable", at: AT });

    const result = await phraseQuestions(fakeCostContext(), { selected });

    expect(result.kind).toBe("measured");
    const questions = (result as { value: Question[] }).value;
    expect(questions).toHaveLength(selected.length);
    expect(questions.every((q) => q.phrasing === "template")).toBe(true);
  });

  it("a capped call is not an exception either — the questions exist, so the set is measured", async () => {
    llmMock.mockResolvedValueOnce({ kind: "unmeasured", reason: "not_attempted", at: AT });

    const result = await phraseQuestions(fakeCostContext(), { selected: selection() });

    expect(result.kind).toBe("measured");
    expect((result as { value: Question[] }).value).toHaveLength(3);
  });
});

describe("templateQuestion — BUILD §6.7 step 4's mechanical forms over the keyword", () => {
  it.each([
    ["best user onboarding software", "What's the best user onboarding software?"],
    ["appcues vs userpilot", "Appcues or userpilot — which should I pick?"],
    ["userpilot alternatives", "What are the alternatives to userpilot?"],
    ["top 10 onboarding tools", "What are the top onboarding tools?"],
    ["how to onboard new users", "How do I onboard new users?"],
    ["what is user onboarding", "What is user onboarding?"],
    ["user onboarding checklist", "User onboarding checklist?"],
  ])("words %s as %s", (keyword, expected) => {
    expect(templateQuestion(keyword)).toBe(expected);
  });

  it("is total — every keyword has a template form, so no phrasing failure can remove a question", () => {
    for (const keyword of ["", "   ", "!!!", "a", "one two three four five"]) {
      expect(templateQuestion(keyword).length).toBeGreaterThan(0);
    }
  });
});

describe("phraseQuestions — observability (BP-025 `## NFR budget`: phrasing fallbacks)", () => {
  it("logs the question count and the fallback count, and never a wording", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    llmMock.mockResolvedValueOnce(modelWordings({ q1: "WORDING-MARKER-4b21" }));

    await phraseQuestions(fakeCostContext(), { selected: selection() });

    const logged = JSON.parse(logSpy.mock.calls.at(-1)![0] as string) as Record<string, unknown>;
    expect(logged.event).toBe("question_phrasing");
    expect(logged.questions).toBe(3);
    expect(logged.fallbacks).toBe(2);
    expect(JSON.stringify(logged)).not.toContain("WORDING-MARKER-4b21");
  });
});
