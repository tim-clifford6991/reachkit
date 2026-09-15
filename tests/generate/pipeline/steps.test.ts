// tests/generate/pipeline/steps.test.ts — BUILD §8's five-step pipeline,
// at the model seam.
//
// "brief (nano) → outline (nano) → grounded draft (Haiku) →
// answerability+SEO pass (Haiku) → claim check (nano)". The tiers are §8's
// and §6.3 prices the day against them, so a step on the wrong tier is a
// cost bug the price book cannot see: they are asserted here.
//
// Also asserted: `capHit()` is re-read before every step, and the prompt's
// whole knowledge of the customer is `DraftPromptInputs` — there is no
// second channel a derived profile could arrive through.
import "../env";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GROUNDED, fakeCost, opportunity } from "../fixtures";
import { buildPromptInputs, DRAFT_PROMPT_KEYS } from "../../../src/lib/generate/voice/inputs";

const { llmMock } = vi.hoisted(() => ({ llmMock: vi.fn() }));
vi.mock("@/lib/llm", () => ({ llm: llmMock }));

let steps: typeof import("../../../src/lib/generate/pipeline/steps");
const { briefProjection } = await import("../../../src/lib/generate/pipeline/steps");

const AT = new Date("2026-09-06T00:00:00.000Z");

const BRIEF = { readerQuestion: "Which tool?", angle: "count the seats", mustCover: ["seats"], factIndexes: [0] };
const OUTLINE = { sections: [{ role: "answer" as const, heading: "Seats" }] };
const OPS = { title: "", description: "", order: [0], firstBlock: "", insertFacts: [] };
const BODY = {
  title: "Which tool should a small team pick?",
  slug: "which-tool-small-team",
  description: "How to choose by seat count.",
  bodyMarkdown: "## Which tool?\n\nCount the seats.",
};

const PROJECTION = briefProjection({
  opportunity: opportunity(),
  facts: [GROUNDED.passage],
  doNotClaim: ["HIPAA compliant"],
  voice: "Plain and direct.",
});

const INPUTS = buildPromptInputs({
  businessName: "Acme",
  domain: "example.com",
  category: "project management software",
  voiceText: "Plain and direct.",
  opportunity: opportunity(),
  grounded: GROUNDED,
  links: [{ source: "site", purpose: "pricing", url: "https://example.com/pricing", label: "Pricing" }],
});

beforeEach(async () => {
  llmMock.mockReset();
  steps = await import("../../../src/lib/generate/pipeline/steps");
});

function measured(value: unknown) {
  return { kind: "measured", value, at: AT };
}

describe("each step calls its own site at the tier §8 names", () => {
  it("brief and outline are nano; draft and the answerability pass are Haiku", async () => {
    llmMock.mockResolvedValueOnce(measured(BRIEF));
    llmMock.mockResolvedValueOnce(measured({ headings: ["Seats"] }));
    llmMock.mockResolvedValueOnce(measured(BODY));
    llmMock.mockResolvedValueOnce(measured(OPS));

    const cost = fakeCost();
    await steps.brief(cost, PROJECTION);
    await steps.outline(cost, INPUTS, { brief: BRIEF, skeleton: ["answer"] });
    await steps.draft(cost, INPUTS, { brief: BRIEF, outline: OUTLINE, facts: [GROUNDED] });
    await steps.answerability(cost, INPUTS, { body: BODY, facts: [GROUNDED.passage] });

    expect(llmMock.mock.calls.map((call) => [call[1].site, call[1].tier])).toEqual([
      [steps.STEP_CALL_SITES.brief, "nano"],
      [steps.STEP_CALL_SITES.outline, "nano"],
      [steps.STEP_CALL_SITES.draft, "haiku"],
      [steps.STEP_CALL_SITES.answerability, "haiku"],
    ]);
  });

  it("the four call sites are distinct, so a cost report reads by step", () => {
    const sites = Object.values(steps.STEP_CALL_SITES);
    expect(new Set(sites).size).toBe(sites.length);
  });
});

describe("the prompt's whole knowledge of the customer is the closed struct", () => {
  it("the brief is handed the closed projection and nothing else (issue 475)", async () => {
    llmMock.mockResolvedValue(measured(BRIEF));
    await steps.brief(fakeCost(), PROJECTION);
    const input = llmMock.mock.calls[0]?.[1].input as Record<string, unknown>;
    expect(Object.keys(input).sort()).toEqual(
      ["task", "cluster", "type", "target", "absorbedQueries", "facts", "doNotClaim", "voice", "acceptance"].sort()
    );
    expect(input.voice).toBe("Plain and direct.");
    expect(input.facts).toEqual([GROUNDED.passage]);
  });

  it("an outline whose headings do not fit the type's skeleton is not an outline", async () => {
    llmMock.mockResolvedValue(measured({ headings: ["One", "Two"] }));
    const outcome = await steps.outline(fakeCost(), INPUTS, { brief: BRIEF, skeleton: ["answer", "detail", "evidence"] });
    expect(outcome.kind).toBe("unmeasured");
  });

  it("carries the voice text verbatim and nothing derived from the customer", async () => {
    llmMock.mockResolvedValue(measured({ headings: ["Seats"] }));
    await steps.outline(fakeCost(), INPUTS, { brief: BRIEF, skeleton: ["answer"] });
    const input = llmMock.mock.calls[0]?.[1].input as Record<string, unknown>;
    expect(input.voice).toBe("Plain and direct.");
    // Every customer-scoped key in the request is a member of the closed
    // struct; the rest are this step's own task text and its upstream
    // artifacts, which carry nothing about the customer.
    const customerKeys = Object.keys(input).filter(
      (key) => !["task", "rules", "brief", "outline", "body", "sections", "facts"].includes(key)
    );
    const allowed = new Set([...Object.keys(DRAFT_PROMPT_KEYS), "voice"]);
    for (const key of customerKeys) expect(allowed.has(key)).toBe(true);
  });

  it("carries the grounded passage word for word", async () => {
    llmMock.mockResolvedValue(measured(BODY));
    await steps.draft(fakeCost(), INPUTS, { brief: BRIEF, outline: OUTLINE, facts: [GROUNDED] });
    const input = llmMock.mock.calls[0]?.[1].input as { grounded: { passage: string } };
    expect(input.grounded.passage).toBe(GROUNDED.passage);
  });
});

describe("the ceiling is re-read before every step", () => {
  it("a step under a hit ceiling is `not_attempted` and makes no call", async () => {
    const outcome = await steps.draft(fakeCost({ capHit: () => true }), INPUTS, {
      brief: BRIEF,
      outline: OUTLINE,
      facts: [GROUNDED],
    });
    expect(outcome).toMatchObject({ kind: "unmeasured", reason: "not_attempted" });
    expect(llmMock).not.toHaveBeenCalled();
  });
});

describe("a model that did not answer degrades the step", () => {
  it("an `unmeasured` result is returned as it is, never coerced into a body", async () => {
    llmMock.mockResolvedValue({ kind: "unmeasured", reason: "undeterminable", at: AT });
    const outcome = await steps.answerability(fakeCost(), INPUTS, { body: BODY, facts: [GROUNDED.passage] });
    expect(outcome.kind).toBe("unmeasured");
  });
});
