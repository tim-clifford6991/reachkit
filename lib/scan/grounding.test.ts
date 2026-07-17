import { beforeEach, describe, expect, test, vi } from "vitest";

/**
 * INVARIANT #11 — grounding honesty. No synthesized field may assert evidence we
 * did not gather. When an input fact sheet is empty, the dependent field is
 * empty/absent — never a plausible synthesis.
 *
 * Shipped violation this guards against (scan 6d49d58e, 2026-07-16): a free scan
 * of the unlaunched reachkit.app — zero users, zero reviews anywhere — produced
 * `reviewsValue: "Users consistently praise ReachKit for being user-friendly…"`
 * and an `actualAudience` rendered under "Your page reads as", on a product whose
 * hero reads "Every claim grounded in your live page".
 *
 * Behavioral, not source-matching: empty sheet in → empty field out.
 */

const STORE_URL = "https://reachkit.app/";

// A synth JSON blob that INVENTS reviews + audience (what Sonnet actually did for
// reachkit.app). The guard must strip both when the review sheet is empty.
const FABRICATED = JSON.stringify({
  positioningMirror: {
    listingSays: "A discoverability engine for founders",
    reviewsValue: "Users consistently praise ReachKit for being user-friendly, easy and fun to use.",
    actualAudience: ["ease-seeking small founders", "support-sensitive early adopters"],
    gap: "The page over-promises",
  },
  findings: [
    { category: "content", claim: "x", basis: "evidence_based", confidence: 0.8, evidence: [{ excerpt: "e", source: "positioning" }] },
    { category: "seo_aso", claim: "y", basis: "evidence_based", confidence: 0.8, evidence: [{ excerpt: "e", source: "keyword_data" }] },
    { category: "outreach", claim: "z", basis: "evidence_based", confidence: 0.8, evidence: [{ excerpt: "e", source: "competitor_gap" }] },
  ],
  sampleAction: { category: "seo_aso", title: "t", why: "w", draft: "d" },
});

/** Fact-sheet mock with an EMPTY review sheet (the reachkit.app case). */
function emptyReviewSheetMock() {
  return vi.fn().mockImplementation(async (_subjectType: string, _subjectKey: string, kind: string) => {
    switch (kind) {
      case "review_themes":
        return { body: { themes: [] } }; // ← zero reviews
      case "positioning":
        return { body: { category: "SaaS", claims: ["Ship faster"], valueProps: ["One scan"] } };
      case "competitor_gap":
        return { body: { competitors: [] } };
      case "keyword_data":
        return { body: { clusters: [{ theme: "seo", keywords: [{ keyword: "seo tool", volume: 110000 }] }] } };
      default:
        return null;
    }
  });
}

async function makeScanCtx() {
  const { ScanBudget } = await import("@/lib/tools/registry");
  return {
    scanId: "scan-grounding-1",
    appId: "app-grounding-1",
    storeUrl: STORE_URL,
    mode: "web" as const,
    budget: new ScanBudget({ maxToolCalls: 60, budgetCents: 500 }),
  };
}

describe("grounding: empty review sheet → empty mirror (invariant #11)", () => {
  beforeEach(() => vi.resetModules());

  test("runSynth wipes an invented reviewsValue + actualAudience when the review sheet is empty", async () => {
    vi.doMock("@/lib/dev/fixtures", () => ({ fixturesEnabled: () => false }));
    vi.doMock("@/lib/scan/fact-sheets", () => ({ getFreshFactSheet: emptyReviewSheetMock(), factSheetSubjectType: () => "web" }));
    vi.doMock("@/lib/llm/anthropic", () => ({
      callModel: vi.fn().mockResolvedValue({ text: FABRICATED, usage: { inputTokens: 1, outputTokens: 1 } }),
    }));

    const { runSynth } = await import("@/lib/llm/synth");
    const result = await runSynth(await makeScanCtx());

    expect(result.positioningMirror.reviewsValue).toBe("");
    expect(result.positioningMirror.actualAudience ?? []).toEqual([]);
    // The invented sentence must not survive anywhere in the mirror.
    expect(JSON.stringify(result.positioningMirror)).not.toMatch(/consistently praise/);
  });

  test("a NON-empty review sheet keeps the synthesized reviewsValue (no over-correction)", async () => {
    const withReviews = vi.fn().mockImplementation(async (_s: string, _k: string, kind: string) => {
      if (kind === "review_themes") return { body: { themes: [{ theme: "Ease", sentiment: "positive", quote: "easy", evidenceIds: [] }] } };
      if (kind === "positioning") return { body: { category: "SaaS", claims: [], valueProps: [] } };
      if (kind === "competitor_gap") return { body: { competitors: [] } };
      if (kind === "keyword_data") return { body: { clusters: [] } };
      return null;
    });
    vi.doMock("@/lib/dev/fixtures", () => ({ fixturesEnabled: () => false }));
    vi.doMock("@/lib/scan/fact-sheets", () => ({ getFreshFactSheet: withReviews, factSheetSubjectType: () => "web" }));
    vi.doMock("@/lib/llm/anthropic", () => ({
      callModel: vi.fn().mockResolvedValue({ text: FABRICATED, usage: { inputTokens: 1, outputTokens: 1 } }),
    }));

    const { runSynth } = await import("@/lib/llm/synth");
    const result = await runSynth(await makeScanCtx());

    // Real reviews present → the synthesized value is kept.
    expect(result.positioningMirror.reviewsValue).toMatch(/consistently praise/);
  });
});
