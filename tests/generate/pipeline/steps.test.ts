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
import { GROUNDED, OUTLINE_ANSWER, draftAnswers, fakeCost, opportunity } from "../fixtures";
import { buildPromptInputs, DRAFT_PROMPT_KEYS } from "../../../src/lib/generate/voice/inputs";

const { llmMock } = vi.hoisted(() => ({ llmMock: vi.fn() }));
vi.mock("@/lib/llm", () => ({ llm: llmMock }));

let steps: typeof import("../../../src/lib/generate/pipeline/steps");
const { briefProjection } = await import("../../../src/lib/generate/pipeline/steps");

const AT = new Date("2026-09-06T00:00:00.000Z");

const BRIEF = { readerQuestion: "Which tool?", angle: "count the seats", mustCover: ["seats"], factIndexes: [0] };
const OUTLINE = { sections: [{ role: "answer" as const, heading: "Seats" }] };
const OPS = { title: "", description: "", order: [0], openings: [], insertFacts: [] };
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
  marketQuestion: true,
  profile: null,
});

const INPUTS = buildPromptInputs({
  businessName: "Acme",
  domain: "example.com",
  category: "project management software",
  voiceText: "Plain and direct.",
  opportunity: opportunity(),
  grounded: GROUNDED,
  links: [{ source: "site", purpose: "pricing", url: "https://example.com/pricing", label: "Pricing" }],
  profile: null,
});

beforeEach(async () => {
  llmMock.mockReset();
  steps = await import("../../../src/lib/generate/pipeline/steps");
});

function measured(value: unknown) {
  return { kind: "measured", value, at: AT };
}

describe("each step calls its own site at the tier §8 names", () => {
  it("brief and outline are nano; the draft's calls and the answerability pass are Haiku", async () => {
    llmMock.mockResolvedValueOnce(measured(BRIEF));
    llmMock.mockResolvedValueOnce(measured(OUTLINE_ANSWER));
    // The draft is written in turn: its frame, then its one section.
    llmMock.mockResolvedValueOnce(measured(draftAnswers()[0]));
    llmMock.mockResolvedValueOnce(measured({ sections: ["Count the seats."] }));
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
      [steps.STEP_CALL_SITES.sections, "haiku"],
      [steps.STEP_CALL_SITES.answerability, "haiku"],
    ]);
  });

  it("the call sites are distinct, so a cost report reads by step", () => {
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
      // `pageJob` and `frame` (issue 900) are fixed instruction text chosen
      // by the opportunity's type and by whether the target names the brand
      // — two known sentences, never a value of the customer's.
      // `profile` since #927: the brief chooses which products, audience and
      // promises the page speaks to, which is what makes the page this
      // business's rather than the market's.
      // `sitePages` since issue 1209: every page the site has published or
      // planned, so the brief takes an angle none of them already takes.
      // `marketFacts` since issue 1135: the second pool, chosen by index too.
      ["task", "cluster", "type", "target", "absorbedQueries", "facts", "marketFacts", "doNotClaim", "voice", "acceptance", "pageJob", "frame", "profile", "sitePages"].sort()
    );
    expect(input.voice).toBe("Plain and direct.");
    expect(input.facts).toEqual([GROUNDED.passage]);
  });

  it("an outline is six to ten questions over the blocks the type requires — anything else is not one", async () => {
    const six = OUTLINE_ANSWER.sections;
    const required = ["answer", "comparison", "business"] as const;
    const asked = async (sections: readonly { role: string; heading: string }[]) => {
      llmMock.mockResolvedValue(measured({ sections }));
      return steps.outline(fakeCost(), INPUTS, { brief: BRIEF, skeleton: required });
    };

    expect((await asked(six)).kind).toBe("measured");
    // Five sections, a required block absent, a heading that is not a question.
    expect((await asked(six.slice(0, 5))).kind).toBe("unmeasured");
    expect((await asked(six.map((s) => (s.role === "comparison" ? { ...s, role: "detail" } : s)))).kind).toBe("unmeasured");
    expect((await asked([{ role: "detail", heading: "The seat limit" }, ...six.slice(1)])).kind).toBe("unmeasured");

    // Twelve are cut to ten from the end, and never at the cost of a required block.
    const twelve = [
      ...six.filter((s) => s.role !== "business"),
      ...[1, 2, 3, 4, 5, 6].map((n) => ({ role: "detail", heading: `What about point ${n}?` })),
      { role: "business", heading: "How is it handled here?" },
    ];
    const cut = await asked(twelve);
    expect(cut.kind === "measured" && cut.value.sections).toHaveLength(10);
    expect(cut.kind === "measured" && cut.value.sections.at(-1)?.role).toBe("business");
  });

  it("carries the voice text verbatim and nothing derived from the customer", async () => {
    llmMock.mockResolvedValue(measured(OUTLINE_ANSWER));
    await steps.outline(fakeCost(), INPUTS, { brief: BRIEF, skeleton: ["answer"] });
    const input = llmMock.mock.calls[0]?.[1].input as Record<string, unknown>;
    expect(input.voice).toBe("Plain and direct.");
    // Every customer-scoped key in the request is a member of the closed
    // struct; the rest are this step's own task text and its upstream
    // artifacts, which carry nothing about the customer.
    const customerKeys = Object.keys(input).filter(
      // `pageJob` and `frame` join this list, not the allowed struct keys:
      // they are this step's own instruction text (issue 900), fixed
      // sentences carrying nothing of the customer's.
      (key) => !["task", "rules", "brief", "outline", "body", "blocks", "required", "facts", "pageJob", "frame"].includes(key)
    );
    const allowed = new Set([...Object.keys(DRAFT_PROMPT_KEYS), "voice"]);
    for (const key of customerKeys) expect(allowed.has(key)).toBe(true);
  });

  it("carries the grounded passage word for word", async () => {
    llmMock.mockResolvedValue(measured({ sections: ["Count the seats."] }));
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
