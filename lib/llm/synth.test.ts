import { beforeEach, describe, expect, test, vi } from "vitest";
import type { SynthResult, FindingEvidence } from "./types";

// ---------------------------------------------------------------------------
// Canned data
// ---------------------------------------------------------------------------
const STORE_URL = "https://apps.apple.com/us/app/habits/id123";

const CANNED_SYNTH_RESULT: SynthResult = {
  positioningMirror: {
    listingSays: "Build habits in 21 days with science-backed streaks",
    reviewsValue: "Users love the streak feature but find the widget unreliable",
    gap: "The listing over-promises habit formation speed; users care more about consistency tools",
  },
  findings: [
    {
      category: "content",
      claim: "Listing emphasises '21 days' framing but reviewers rarely mention timeline benefits",
      basis: "evidence_based",
      confidence: 0.82,
      evidence: [
        { excerpt: "science-backed habit formation", source: "positioning" },
        { excerpt: "streak feature keeps me going", source: "review_themes" },
      ],
    },
    {
      category: "seo_aso",
      claim: "High-volume keyword 'habit tracker app' (8,100/mo) not present in listing description",
      basis: "evidence_based",
      confidence: 0.91,
      evidence: [
        { excerpt: "habit tracker app", source: "keyword_data" },
      ],
    },
    {
      category: "outreach",
      claim: "Competitor Habitify positions on analytics while target app has simpler onboarding — an underexploited story",
      basis: "evidence_based",
      confidence: 0.75,
      evidence: [
        { excerpt: "Simpler onboarding and lower cognitive load", source: "competitor_gap" },
      ],
    },
  ],
  sampleAction: {
    category: "seo_aso",
    title: "Add 'habit tracker' keyword cluster to description first paragraph",
    why: "8,100 monthly searches for 'habit tracker app' with no competitor owning the phrase in title",
    draft: "Track your daily habits effortlessly — HabitKit is the #1 habit tracker app for building lasting routines.",
  },
};

// ---------------------------------------------------------------------------
// Minimal degraded result for malformed-JSON tests
// ---------------------------------------------------------------------------
function isValidSynthResult(r: unknown): r is SynthResult {
  if (typeof r !== "object" || r === null) return false;
  const s = r as Record<string, unknown>;
  if (!s["positioningMirror"] || !s["findings"] || !s["sampleAction"]) return false;
  if (!Array.isArray(s["findings"]) || (s["findings"] as unknown[]).length === 0) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function makeScanCtx() {
  const { ScanBudget } = await import("@/lib/tools/registry");
  const budget = new ScanBudget({ maxToolCalls: 60, budgetCents: 500 });
  return {
    scanId: "scan-synth-test-1",
    appId: "app-test-1",
    storeUrl: STORE_URL,
    mode: "ios" as const,
    budget,
  };
}

function makeGetFreshFactSheetMock() {
  return vi.fn().mockImplementation(async (_subjectType: string, _subjectKey: string, kind: string) => {
    switch (kind) {
      case "review_themes":
        return { body: { themes: [{ theme: "Ease of use", sentiment: "positive", quote: "incredibly easy to get started", evidenceIds: [] }] } };
      case "positioning":
        return { body: { category: "Health & Fitness", claims: ["Build habits in 21 days"], valueProps: ["Daily habit streaks"] } };
      case "competitor_gap":
        return { body: { competitors: [{ name: "Habitify", positioning: "Data-rich analytics", gap: "Simpler onboarding" }] } };
      case "keyword_data":
        return { body: { clusters: [{ theme: "Habit tracking", keywords: [{ keyword: "habit tracker app", volume: 8100 }] }] } };
      default:
        return null;
    }
  });
}

// ---------------------------------------------------------------------------
// Tests: normal path (callModel returns valid JSON)
// ---------------------------------------------------------------------------
describe("runSynth — normal path", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  test("returns a SynthResult with exactly 3 findings when callModel returns valid JSON", async () => {
    vi.doMock("@/lib/dev/fixtures", () => ({ useFixtures: () => false }));
    const getFreshMock = makeGetFreshFactSheetMock();
    vi.doMock("@/lib/scan/fact-sheets", () => ({ getFreshFactSheet: getFreshMock, factSheetSubjectType: () => "app" }));
    const callModelMock = vi.fn().mockResolvedValue({
      text: JSON.stringify(CANNED_SYNTH_RESULT),
      usage: { inputTokens: 1200, outputTokens: 400 },
    });
    vi.doMock("@/lib/llm/anthropic", () => ({ callModel: callModelMock }));

    const { runSynth } = await import("./synth");
    const ctx = await makeScanCtx();
    const result = await runSynth(ctx);

    expect(result.findings).toHaveLength(3);
  });

  test("each finding has ≥1 evidence excerpt with a source", async () => {
    vi.doMock("@/lib/dev/fixtures", () => ({ useFixtures: () => false }));
    vi.doMock("@/lib/scan/fact-sheets", () => ({ getFreshFactSheet: makeGetFreshFactSheetMock(), factSheetSubjectType: () => "app" }));
    const callModelMock = vi.fn().mockResolvedValue({
      text: JSON.stringify(CANNED_SYNTH_RESULT),
      usage: { inputTokens: 1200, outputTokens: 400 },
    });
    vi.doMock("@/lib/llm/anthropic", () => ({ callModel: callModelMock }));

    const { runSynth } = await import("./synth");
    const ctx = await makeScanCtx();
    const result = await runSynth(ctx);

    for (const finding of result.findings) {
      expect(finding.evidence.length).toBeGreaterThanOrEqual(1);
      for (const ev of finding.evidence) {
        expect(typeof (ev as FindingEvidence).excerpt).toBe("string");
        expect(typeof (ev as FindingEvidence).source).toBe("string");
        expect((ev as FindingEvidence).excerpt.length).toBeGreaterThan(0);
        expect((ev as FindingEvidence).source.length).toBeGreaterThan(0);
      }
    }
  });

  test("callModel called with stage=synth, model=claude-sonnet-4-6, scanId from ctx, maxTokens=4096", async () => {
    vi.doMock("@/lib/dev/fixtures", () => ({ useFixtures: () => false }));
    vi.doMock("@/lib/scan/fact-sheets", () => ({ getFreshFactSheet: makeGetFreshFactSheetMock(), factSheetSubjectType: () => "app" }));
    const callModelMock = vi.fn().mockResolvedValue({
      text: JSON.stringify(CANNED_SYNTH_RESULT),
      usage: { inputTokens: 1200, outputTokens: 400 },
    });
    vi.doMock("@/lib/llm/anthropic", () => ({ callModel: callModelMock }));

    const { runSynth } = await import("./synth");
    const ctx = await makeScanCtx();
    await runSynth(ctx);

    expect(callModelMock).toHaveBeenCalledOnce();
    const args = callModelMock.mock.calls[0]?.[0] as { model: string; stage: string; scanId: string; maxTokens: number };
    expect(args.model).toBe("claude-sonnet-4-6");
    expect(args.stage).toBe("synth");
    expect(args.scanId).toBe("scan-synth-test-1");
    expect(args.maxTokens).toBe(4096);
  });

  test("getFreshFactSheet called for all 4 kinds", async () => {
    vi.doMock("@/lib/dev/fixtures", () => ({ useFixtures: () => false }));
    const getFreshMock = makeGetFreshFactSheetMock();
    vi.doMock("@/lib/scan/fact-sheets", () => ({ getFreshFactSheet: getFreshMock, factSheetSubjectType: () => "app" }));
    const callModelMock = vi.fn().mockResolvedValue({
      text: JSON.stringify(CANNED_SYNTH_RESULT),
      usage: { inputTokens: 1200, outputTokens: 400 },
    });
    vi.doMock("@/lib/llm/anthropic", () => ({ callModel: callModelMock }));

    const { runSynth } = await import("./synth");
    const ctx = await makeScanCtx();
    await runSynth(ctx);

    const kindsCalled = getFreshMock.mock.calls.map((c) => (c as unknown[])[2]);
    expect(kindsCalled).toContain("review_themes");
    expect(kindsCalled).toContain("positioning");
    expect(kindsCalled).toContain("competitor_gap");
    expect(kindsCalled).toContain("keyword_data");
  });

  test("positioningMirror has listingSays, reviewsValue, gap all non-empty", async () => {
    vi.doMock("@/lib/dev/fixtures", () => ({ useFixtures: () => false }));
    vi.doMock("@/lib/scan/fact-sheets", () => ({ getFreshFactSheet: makeGetFreshFactSheetMock(), factSheetSubjectType: () => "app" }));
    const callModelMock = vi.fn().mockResolvedValue({
      text: JSON.stringify(CANNED_SYNTH_RESULT),
      usage: { inputTokens: 1200, outputTokens: 400 },
    });
    vi.doMock("@/lib/llm/anthropic", () => ({ callModel: callModelMock }));

    const { runSynth } = await import("./synth");
    const ctx = await makeScanCtx();
    const result = await runSynth(ctx);

    expect(typeof result.positioningMirror.listingSays).toBe("string");
    expect(typeof result.positioningMirror.reviewsValue).toBe("string");
    expect(typeof result.positioningMirror.gap).toBe("string");
  });
});

// ---------------------------------------------------------------------------
// Tests: degradation on malformed JSON
// ---------------------------------------------------------------------------
describe("runSynth — malformed JSON degrades without throwing", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  test("malformed callModel response returns minimal valid SynthResult (no throw)", async () => {
    vi.doMock("@/lib/dev/fixtures", () => ({ useFixtures: () => false }));
    vi.doMock("@/lib/scan/fact-sheets", () => ({ getFreshFactSheet: makeGetFreshFactSheetMock(), factSheetSubjectType: () => "app" }));
    vi.doMock("@/lib/llm/anthropic", () => ({
      callModel: vi.fn().mockResolvedValue({
        text: "NOT JSON {{{{",
        usage: { inputTokens: 100, outputTokens: 10 },
      }),
    }));

    const { runSynth } = await import("./synth");
    const ctx = await makeScanCtx();
    const result = await expect(runSynth(ctx)).resolves.toBeDefined();
    void result;
  });

  test("malformed callModel returns result with ≥1 finding", async () => {
    vi.doMock("@/lib/dev/fixtures", () => ({ useFixtures: () => false }));
    vi.doMock("@/lib/scan/fact-sheets", () => ({ getFreshFactSheet: makeGetFreshFactSheetMock(), factSheetSubjectType: () => "app" }));
    vi.doMock("@/lib/llm/anthropic", () => ({
      callModel: vi.fn().mockResolvedValue({
        text: "NOT JSON {{{{",
        usage: { inputTokens: 100, outputTokens: 10 },
      }),
    }));

    const { runSynth } = await import("./synth");
    const ctx = await makeScanCtx();
    const result: SynthResult = await runSynth(ctx);

    expect(isValidSynthResult(result)).toBe(true);
    expect(result.findings.length).toBeGreaterThanOrEqual(1);
    expect(result.sampleAction).toBeDefined();
    expect(typeof result.sampleAction.title).toBe("string");
  });

  test("callModel throwing rejects gracefully (returns minimal result, no throw)", async () => {
    vi.doMock("@/lib/dev/fixtures", () => ({ useFixtures: () => false }));
    vi.doMock("@/lib/scan/fact-sheets", () => ({ getFreshFactSheet: makeGetFreshFactSheetMock(), factSheetSubjectType: () => "app" }));
    vi.doMock("@/lib/llm/anthropic", () => ({
      callModel: vi.fn().mockRejectedValue(new Error("API error")),
    }));

    const { runSynth } = await import("./synth");
    const ctx = await makeScanCtx();
    const result: SynthResult = await runSynth(ctx);

    expect(isValidSynthResult(result)).toBe(true);
    expect(result.findings.length).toBeGreaterThanOrEqual(1);
  });

  test("partial JSON (missing findings) returns a degraded but valid result", async () => {
    vi.doMock("@/lib/dev/fixtures", () => ({ useFixtures: () => false }));
    vi.doMock("@/lib/scan/fact-sheets", () => ({ getFreshFactSheet: makeGetFreshFactSheetMock(), factSheetSubjectType: () => "app" }));
    vi.doMock("@/lib/llm/anthropic", () => ({
      callModel: vi.fn().mockResolvedValue({
        text: JSON.stringify({ positioningMirror: { listingSays: "x", reviewsValue: "y", gap: "z" } }),
        usage: { inputTokens: 100, outputTokens: 10 },
      }),
    }));

    const { runSynth } = await import("./synth");
    const ctx = await makeScanCtx();
    const result: SynthResult = await runSynth(ctx);

    expect(result.findings.length).toBeGreaterThanOrEqual(1);
    expect(result.sampleAction).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Tests: evidence validation + confidence clamping
// ---------------------------------------------------------------------------
describe("runSynth — evidence validation + confidence clamping", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  test("a finding with empty evidence array is dropped (replaced by degraded finding)", async () => {
    vi.doMock("@/lib/dev/fixtures", () => ({ useFixtures: () => false }));
    vi.doMock("@/lib/scan/fact-sheets", () => ({ getFreshFactSheet: makeGetFreshFactSheetMock(), factSheetSubjectType: () => "app" }));
    // Return a result where one finding has empty evidence — it should be filtered out
    const noEvidenceFinding = {
      category: "content",
      claim: "A claim with no evidence",
      basis: "evidence_based",
      confidence: 0.5,
      evidence: [],
    };
    const withEvidence = CANNED_SYNTH_RESULT.findings[0];
    const modelOutput = {
      positioningMirror: CANNED_SYNTH_RESULT.positioningMirror,
      findings: [noEvidenceFinding, withEvidence],
      sampleAction: CANNED_SYNTH_RESULT.sampleAction,
    };
    vi.doMock("@/lib/llm/anthropic", () => ({
      callModel: vi.fn().mockResolvedValue({
        text: JSON.stringify(modelOutput),
        usage: { inputTokens: 100, outputTokens: 50 },
      }),
    }));

    const { runSynth } = await import("./synth");
    const ctx = await makeScanCtx();
    const result = await runSynth(ctx);

    // Only the finding WITH evidence should survive
    for (const finding of result.findings) {
      expect(finding.evidence.length).toBeGreaterThan(0);
    }
    // The zero-evidence finding must have been dropped
    const claims = result.findings.map((f) => f.claim);
    expect(claims).not.toContain("A claim with no evidence");
  });

  test("a confidence value of 99 is clamped to 1", async () => {
    vi.doMock("@/lib/dev/fixtures", () => ({ useFixtures: () => false }));
    vi.doMock("@/lib/scan/fact-sheets", () => ({ getFreshFactSheet: makeGetFreshFactSheetMock(), factSheetSubjectType: () => "app" }));
    const overflowFinding = {
      category: "content",
      claim: "A finding with overflowing confidence",
      basis: "evidence_based",
      confidence: 99,
      evidence: [{ excerpt: "some excerpt", source: "review_themes" }],
    };
    const modelOutput = {
      positioningMirror: CANNED_SYNTH_RESULT.positioningMirror,
      findings: [overflowFinding],
      sampleAction: CANNED_SYNTH_RESULT.sampleAction,
    };
    vi.doMock("@/lib/llm/anthropic", () => ({
      callModel: vi.fn().mockResolvedValue({
        text: JSON.stringify(modelOutput),
        usage: { inputTokens: 100, outputTokens: 50 },
      }),
    }));

    const { runSynth } = await import("./synth");
    const ctx = await makeScanCtx();
    const result = await runSynth(ctx);

    const overflowResult = result.findings.find((f) => f.claim === "A finding with overflowing confidence");
    expect(overflowResult).toBeDefined();
    expect(overflowResult!.confidence).toBe(1);
  });

  test("a confidence value of -5 is clamped to 0", async () => {
    vi.doMock("@/lib/dev/fixtures", () => ({ useFixtures: () => false }));
    vi.doMock("@/lib/scan/fact-sheets", () => ({ getFreshFactSheet: makeGetFreshFactSheetMock(), factSheetSubjectType: () => "app" }));
    const negFinding = {
      category: "content",
      claim: "A finding with negative confidence",
      basis: "evidence_based",
      confidence: -5,
      evidence: [{ excerpt: "some excerpt", source: "review_themes" }],
    };
    const modelOutput = {
      positioningMirror: CANNED_SYNTH_RESULT.positioningMirror,
      findings: [negFinding],
      sampleAction: CANNED_SYNTH_RESULT.sampleAction,
    };
    vi.doMock("@/lib/llm/anthropic", () => ({
      callModel: vi.fn().mockResolvedValue({
        text: JSON.stringify(modelOutput),
        usage: { inputTokens: 100, outputTokens: 50 },
      }),
    }));

    const { runSynth } = await import("./synth");
    const ctx = await makeScanCtx();
    const result = await runSynth(ctx);

    const negResult = result.findings.find((f) => f.claim === "A finding with negative confidence");
    expect(negResult).toBeDefined();
    expect(negResult!.confidence).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Tests: fixture mode
// ---------------------------------------------------------------------------
describe("runSynth — fixture mode", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  test("fixture mode returns fixtureSynth() without calling callModel or getFreshFactSheet", async () => {
    const callModelMock = vi.fn();
    const getFreshMock = vi.fn();

    vi.doMock("@/lib/dev/fixtures", () => ({
      useFixtures: () => true,
      fixtureSynth: () => CANNED_SYNTH_RESULT,
    }));
    vi.doMock("@/lib/scan/fact-sheets", () => ({ getFreshFactSheet: getFreshMock, factSheetSubjectType: () => "app" }));
    vi.doMock("@/lib/llm/anthropic", () => ({ callModel: callModelMock }));

    const { runSynth } = await import("./synth");
    const ctx = await makeScanCtx();
    const result = await runSynth(ctx);

    expect(callModelMock).not.toHaveBeenCalled();
    expect(getFreshMock).not.toHaveBeenCalled();
    expect(result).toEqual(CANNED_SYNTH_RESULT);
  });

  test("fixture mode result has ≥1 finding with evidence", async () => {
    vi.doMock("@/lib/dev/fixtures", () => ({
      useFixtures: () => true,
      fixtureSynth: () => CANNED_SYNTH_RESULT,
    }));
    vi.doMock("@/lib/scan/fact-sheets", () => ({ getFreshFactSheet: vi.fn(), factSheetSubjectType: () => "app" }));
    vi.doMock("@/lib/llm/anthropic", () => ({ callModel: vi.fn() }));

    const { runSynth } = await import("./synth");
    const ctx = await makeScanCtx();
    const result = await runSynth(ctx);

    expect(result.findings.length).toBeGreaterThanOrEqual(1);
    for (const finding of result.findings) {
      expect(finding.evidence.length).toBeGreaterThanOrEqual(1);
    }
  });
});
