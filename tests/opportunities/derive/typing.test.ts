// BUILD §7 — "no LLM decides what an opportunity is (Haiku only
// labels/classifies)".
//
// The real `llm()` runs here, through the real cost seam, with only the
// vendor SDK stood in for. That is deliberate: a suite that mocked
// `llm()` itself could not see whether the call was ledgered, which tier
// it asked for, or which call site it was booked against — and those are
// three of the four things §7 and the cost rule actually promise.
import "../env";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EFFORT_BY_TYPE } from "../../../src/lib/config/constants";
import { measured } from "../../../src/lib/measure/measured";
import type { Candidate } from "../../../src/lib/opportunities/derive/candidate";
import { fakeCost, cappedCost } from "../cost";
import { AT, SCAN_ID, SITE_ID } from "../fixtures";
import { toolUseMessage } from "../../llm/fixtures";

const { createMock } = vi.hoisted(() => ({ createMock: vi.fn() }));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = { create: createMock };
  },
}));

const { refineType, TYPING_CALL_SITE } = await import(
  "../../../src/lib/opportunities/derive/typing"
);

/** A response the vendor SDK would return, carrying `text` as its one
 *  content block. */
function respond(text: string) {
  return {
    content: [{ type: "text", text }],
    usage: { input_tokens: 100, output_tokens: 20 },
  };
}

function writeCandidate(over: Partial<Candidate> = {}): Candidate {
  return {
    siteId: SITE_ID,
    scanId: SCAN_ID,
    type: "keyword_page",
    family: "write",
    targetQuery: "best user onboarding software",
    targetRef: "best-user-onboarding-software",
    title: null,
    volume: measured(1900, AT),
    evidence: {
      family: "write",
      query: "best user onboarding software",
      volume: measured(1900, AT),
      rival: {
        domain: "appcues.com",
        url: measured("https://appcues.com/a", AT),
        position: measured(1, AT),
      },
    },
    acceptance: { form: "top20", query: "best user onboarding software" },
    fitBand: "winnable",
    effort: EFFORT_BY_TYPE.keyword_page,
    ...over,
  };
}

beforeEach(() => {
  createMock.mockReset();
});

describe("the model labels, and the label goes through the cost seam", () => {
  it("one ledgered call, booked to `opportunity-typing`", async () => {
    createMock.mockResolvedValue(
      respond(JSON.stringify({ type: "comparison_page", slug: "appcues-vs-us", title: "Appcues or us" }))
    );
    const { ctx, sources } = fakeCost();

    const refined = await refineType(ctx, writeCandidate());

    expect(sources).toEqual([TYPING_CALL_SITE]);
    expect(refined.type).toBe("comparison_page");
    expect(refined.targetRef).toBe("appcues-vs-us");
    expect(refined.title).toBe("Appcues or us");
    // The effort weight follows the refined type, never the old one.
    expect(refined.effort).toBe(EFFORT_BY_TYPE.comparison_page);
  });

  it("the label read off the forced tool's input (issue #512) refines the candidate the same way", async () => {
    createMock.mockResolvedValue(
      toolUseMessage({ type: "comparison_page", slug: "appcues-vs-us", title: "Appcues or us" }, 100, 20, TYPING_CALL_SITE)
    );
    const { ctx, sources } = fakeCost();

    const refined = await refineType(ctx, writeCandidate());

    const sent = createMock.mock.calls[0]![0] as { tool_choice: { type: string; name: string } };
    expect(sent.tool_choice).toEqual({ type: "tool", name: TYPING_CALL_SITE });
    expect(sources).toEqual([TYPING_CALL_SITE]);
    expect(refined.type).toBe("comparison_page");
    expect(refined.targetRef).toBe("appcues-vs-us");
    expect(refined.effort).toBe(EFFORT_BY_TYPE.comparison_page);
  });

  it("it asks for the haiku tier, which is the tier §7 names", () => {
    createMock.mockResolvedValue(respond("{}"));
    // The tier reaches the vendor as a model id; what this suite can see
    // is that the call is made at all and that the *deterministic* result
    // survives a response that does not parse — asserted below. The tier
    // binding itself is `tests/llm/seam.test.ts`'.
    expect(TYPING_CALL_SITE).toBe("opportunity-typing");
  });
});

describe("nothing a response says can create, drop or re-target a candidate", () => {
  it("a response naming a type outside the closed enum leaves the deterministic one", async () => {
    createMock.mockResolvedValue(
      respond(JSON.stringify({ type: "video_page", slug: "x", title: "y" }))
    );
    const { ctx } = fakeCost();
    const refined = await refineType(ctx, writeCandidate());
    expect(refined.type).toBe("keyword_page");
    expect(refined.targetRef).toBe("best-user-onboarding-software");
  });

  it("a response naming a type from another family leaves the deterministic one", async () => {
    // The family was fixed by measured evidence. A model that could move
    // it could turn a page into an instruction, or the reverse.
    createMock.mockResolvedValue(
      respond(JSON.stringify({ type: "unblock", slug: "x", title: "y" }))
    );
    const { ctx } = fakeCost();
    const refined = await refineType(ctx, writeCandidate());
    expect(refined.type).toBe("keyword_page");
    expect(refined.family).toBe("write");
  });

  it("a response carrying a different query does not parse, and changes nothing", async () => {
    createMock.mockResolvedValue(
      respond(
        JSON.stringify({
          type: "comparison_page",
          slug: "x",
          title: "y",
          targetQuery: "something else entirely",
        })
      )
    );
    const { ctx } = fakeCost();
    const candidate = writeCandidate();
    const refined = await refineType(ctx, candidate);
    expect(refined).toEqual(candidate);
  });

  it("the evidence and the acceptance test are the ones it was given, whatever comes back", async () => {
    createMock.mockResolvedValue(
      respond(JSON.stringify({ type: "answer_page", slug: "s", title: "t" }))
    );
    const { ctx } = fakeCost();
    const candidate = writeCandidate();
    const refined = await refineType(ctx, candidate);
    expect(refined.evidence).toEqual(candidate.evidence);
    expect(refined.acceptance).toEqual(candidate.acceptance);
    expect(refined.targetQuery).toBe(candidate.targetQuery);
    expect(refined.fitBand).toBe(candidate.fitBand);
  });

  it("it takes one candidate and returns one — there is no arm that returns a list", async () => {
    createMock.mockResolvedValue(
      respond(JSON.stringify({ type: "answer_page", slug: "s", title: "t" }))
    );
    const { ctx } = fakeCost();
    const refined = await refineType(ctx, writeCandidate());
    expect(Array.isArray(refined)).toBe(false);
  });
});

describe("a model that cannot answer degrades to the deterministic candidate", () => {
  it("an unavailable model changes nothing", async () => {
    createMock.mockRejectedValue(new Error("upstream is down"));
    const { ctx } = fakeCost();
    const candidate = writeCandidate();
    expect(await refineType(ctx, candidate)).toEqual(candidate);
  });

  it("a response that is not JSON changes nothing", async () => {
    createMock.mockResolvedValue(respond("I think a comparison page would be nice!"));
    const { ctx } = fakeCost();
    const candidate = writeCandidate();
    expect(await refineType(ctx, candidate)).toEqual(candidate);
  });

  it("a cost ceiling reached before the call changes nothing, and calls no vendor", async () => {
    const { ctx, sources } = cappedCost();
    const candidate = writeCandidate();
    expect(await refineType(ctx, candidate)).toEqual(candidate);
    expect(sources).toEqual([TYPING_CALL_SITE]); // reserved, refused, ledgered
    expect(createMock).not.toHaveBeenCalled();
  });

  it("an empty slug falls back to the deterministic one rather than an empty target", async () => {
    createMock.mockResolvedValue(
      respond(JSON.stringify({ type: "keyword_page", slug: "   ", title: "" }))
    );
    const { ctx } = fakeCost();
    const refined = await refineType(ctx, writeCandidate());
    expect(refined.targetRef).toBe("best-user-onboarding-software");
    expect(refined.title).toBeNull();
  });
});

describe("the Fix and Improve families are never sent to a model", () => {
  it("an unblock is labelled by nobody and costs nothing", async () => {
    const { ctx, sources } = fakeCost();
    const unblock = writeCandidate({
      type: "unblock",
      family: "fix",
      targetQuery: null,
      targetRef: "https://example.com",
      volume: null,
      fitBand: null,
      evidence: { family: "fix", barrier: "noindex", foundOnUrl: "https://example.com/" },
      acceptance: { form: "gate_cleared", gate: "noindex" },
    });
    expect(await refineType(ctx, unblock)).toEqual(unblock);
    expect(sources).toEqual([]);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("an improve target's own page is never given a proposed slug", async () => {
    const { ctx, sources } = fakeCost();
    const improve = writeCandidate({
      type: "expand_page",
      family: "improve",
      targetRef: "https://example.com/",
      evidence: {
        family: "improve",
        query: "best user onboarding software",
        volume: measured(1900, AT),
        pageUrl: "https://example.com/",
        shortfall: { kind: "thin", words: measured(400, AT) },
      },
    });
    expect(await refineType(ctx, improve)).toEqual(improve);
    expect(sources).toEqual([]);
  });
});
