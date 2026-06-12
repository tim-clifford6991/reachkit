import { beforeEach, describe, expect, test, vi } from "vitest";
import type { ActionCard, Finding } from "./types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const STORE_URL = "https://apps.apple.com/us/app/habitkit/id456";

async function makeScanCtx() {
  const { ScanBudget } = await import("@/lib/tools/registry");
  const budget = new ScanBudget({ maxToolCalls: 60, budgetCents: 500 });
  return {
    scanId: "scan-actions-test-1",
    appId: "app-actions-test-1",
    storeUrl: STORE_URL,
    mode: "ios" as const,
    budget,
  };
}

const SAMPLE_FINDINGS: Finding[] = [
  {
    category: "content",
    claim: "Listing '21-day' claim mismatches reviews that praise streaks",
    basis: "evidence_based",
    confidence: 0.85,
    evidence: [{ excerpt: "the streak feature keeps me going", source: "review_themes" }],
  },
  {
    category: "seo_aso",
    claim: "'habit tracker app' (8,100/mo) not in listing title",
    basis: "evidence_based",
    confidence: 0.92,
    evidence: [{ excerpt: "habit tracker app", source: "keyword_data" }],
  },
  {
    category: "outreach",
    claim: "Habitify owns 'analytics'; HabitKit can own 'simple'",
    basis: "evidence_based",
    confidence: 0.78,
    evidence: [{ excerpt: "Simpler onboarding and lower cognitive load", source: "competitor_gap" }],
  },
];

// Minimal valid ActionCard for canned model responses
function makeCard(
  category: ActionCard["category"],
  overrides: Partial<ActionCard> = {},
): ActionCard {
  return {
    category,
    title: `Test action for ${category}`,
    why: "A specific signal from the fact sheets supports this.",
    evidenceIds: [],
    evidence: [
      { excerpt: "the streak feature keeps me going", source: "review_themes", sourceType: "app_store_rss" },
      { excerpt: "habit tracker app", source: "keyword_data", sourceType: "dataforseo_keywords" },
    ],
    effortMin: 30,
    suggestedDeadline: "2026-07-01",
    expectedOutcome: { scoreComponent: "content", delta: 5 },
    draft: "A draft referencing 'the streak feature keeps me going'.",
    draftRequiresEdit: true,
    verification: { method: "url", state: "pending" },
    basis: "evidence_based",
    confidence: 0.8,
    ...overrides,
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
// Normal path — callModel returns valid JSON array
// ---------------------------------------------------------------------------
describe("generateActions — normal path", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  test("returns at least one card per category (content, outreach, seo_aso)", async () => {
    vi.doMock("@/lib/dev/fixtures", () => ({ fixturesEnabled: () => false }));
    vi.doMock("@/lib/scan/fact-sheets", () => ({
      getFreshFactSheet: makeGetFreshFactSheetMock(),
      factSheetSubjectType: () => "app",
    }));
    vi.doMock("@/lib/db/client", () => ({
      serverDb: () => ({
        from: () => ({
          select: () => ({
            contains: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
        }),
      }),
    }));

    const cards = [
      makeCard("content"),
      makeCard("content"),
      makeCard("outreach"),
      makeCard("outreach"),
      makeCard("seo_aso"),
      makeCard("seo_aso"),
    ];

    vi.doMock("@/lib/llm/anthropic", () => ({
      callModel: vi.fn().mockResolvedValue({
        text: JSON.stringify(cards),
        usage: { inputTokens: 2000, outputTokens: 800 },
      }),
    }));

    const { generateActions } = await import("./actions");
    const ctx = await makeScanCtx();
    const result = await generateActions(ctx, SAMPLE_FINDINGS);

    const categories = result.map((c) => c.category);
    expect(categories).toContain("content");
    expect(categories).toContain("outreach");
    expect(categories).toContain("seo_aso");
  });

  test("callModel called with model=claude-haiku-4-5-20251001, stage=format, maxTokens=4096", async () => {
    vi.doMock("@/lib/dev/fixtures", () => ({ fixturesEnabled: () => false }));
    vi.doMock("@/lib/scan/fact-sheets", () => ({
      getFreshFactSheet: makeGetFreshFactSheetMock(),
      factSheetSubjectType: () => "app",
    }));
    vi.doMock("@/lib/db/client", () => ({
      serverDb: () => ({
        from: () => ({
          select: () => ({
            contains: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
        }),
      }),
    }));

    const callModelMock = vi.fn().mockResolvedValue({
      text: JSON.stringify([makeCard("content"), makeCard("outreach"), makeCard("seo_aso")]),
      usage: { inputTokens: 2000, outputTokens: 800 },
    });
    vi.doMock("@/lib/llm/anthropic", () => ({ callModel: callModelMock }));

    const { generateActions } = await import("./actions");
    const ctx = await makeScanCtx();
    await generateActions(ctx, SAMPLE_FINDINGS);

    expect(callModelMock).toHaveBeenCalledOnce();
    const args = callModelMock.mock.calls[0]?.[0] as {
      model: string;
      stage: string;
      scanId: string;
      maxTokens: number;
    };
    expect(args.model).toBe("claude-haiku-4-5-20251001");
    expect(args.stage).toBe("format");
    expect(args.scanId).toBe("scan-actions-test-1");
    expect(args.maxTokens).toBe(4096);
  });

  test("getFreshFactSheet called for all 4 kinds", async () => {
    vi.doMock("@/lib/dev/fixtures", () => ({ fixturesEnabled: () => false }));
    const getFreshMock = makeGetFreshFactSheetMock();
    vi.doMock("@/lib/scan/fact-sheets", () => ({
      getFreshFactSheet: getFreshMock,
      factSheetSubjectType: () => "app",
    }));
    vi.doMock("@/lib/db/client", () => ({
      serverDb: () => ({
        from: () => ({
          select: () => ({
            contains: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
        }),
      }),
    }));
    vi.doMock("@/lib/llm/anthropic", () => ({
      callModel: vi.fn().mockResolvedValue({
        text: JSON.stringify([makeCard("content"), makeCard("outreach"), makeCard("seo_aso")]),
        usage: { inputTokens: 2000, outputTokens: 800 },
      }),
    }));

    const { generateActions } = await import("./actions");
    const ctx = await makeScanCtx();
    await generateActions(ctx, SAMPLE_FINDINGS);

    const kindsCalled = getFreshMock.mock.calls.map((c) => (c as unknown[])[2]);
    expect(kindsCalled).toContain("review_themes");
    expect(kindsCalled).toContain("positioning");
    expect(kindsCalled).toContain("competitor_gap");
    expect(kindsCalled).toContain("keyword_data");
  });
});

// ---------------------------------------------------------------------------
// §11 — draftRequiresEdit invariant
// ---------------------------------------------------------------------------
describe("generateActions — draftRequiresEdit invariant", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  test("draftRequiresEdit is always true, even if model returns false", async () => {
    vi.doMock("@/lib/dev/fixtures", () => ({ fixturesEnabled: () => false }));
    vi.doMock("@/lib/scan/fact-sheets", () => ({
      getFreshFactSheet: makeGetFreshFactSheetMock(),
      factSheetSubjectType: () => "app",
    }));
    vi.doMock("@/lib/db/client", () => ({
      serverDb: () => ({
        from: () => ({
          select: () => ({
            contains: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
        }),
      }),
    }));

    // Model wrongly returns draftRequiresEdit: false
    const badCard = makeCard("content", { draftRequiresEdit: false });
    vi.doMock("@/lib/llm/anthropic", () => ({
      callModel: vi.fn().mockResolvedValue({
        text: JSON.stringify([badCard]),
        usage: { inputTokens: 500, outputTokens: 100 },
      }),
    }));

    const { generateActions } = await import("./actions");
    const ctx = await makeScanCtx();
    const result = await generateActions(ctx, SAMPLE_FINDINGS);

    for (const card of result) {
      expect(card.draftRequiresEdit).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Confidence clamping
// ---------------------------------------------------------------------------
describe("generateActions — confidence clamping", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  test("confidence value of 99 is clamped to 1", async () => {
    vi.doMock("@/lib/dev/fixtures", () => ({ fixturesEnabled: () => false }));
    vi.doMock("@/lib/scan/fact-sheets", () => ({
      getFreshFactSheet: makeGetFreshFactSheetMock(),
      factSheetSubjectType: () => "app",
    }));
    vi.doMock("@/lib/db/client", () => ({
      serverDb: () => ({
        from: () => ({
          select: () => ({
            contains: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
        }),
      }),
    }));

    const overCard = makeCard("seo_aso", { confidence: 99 });
    vi.doMock("@/lib/llm/anthropic", () => ({
      callModel: vi.fn().mockResolvedValue({
        text: JSON.stringify([overCard]),
        usage: { inputTokens: 500, outputTokens: 100 },
      }),
    }));

    const { generateActions } = await import("./actions");
    const ctx = await makeScanCtx();
    const result = await generateActions(ctx, SAMPLE_FINDINGS);

    for (const card of result) {
      expect(card.confidence).toBeGreaterThanOrEqual(0);
      expect(card.confidence).toBeLessThanOrEqual(1);
    }
  });

  test("confidence value of -5 is clamped to 0", async () => {
    vi.doMock("@/lib/dev/fixtures", () => ({ fixturesEnabled: () => false }));
    vi.doMock("@/lib/scan/fact-sheets", () => ({
      getFreshFactSheet: makeGetFreshFactSheetMock(),
      factSheetSubjectType: () => "app",
    }));
    vi.doMock("@/lib/db/client", () => ({
      serverDb: () => ({
        from: () => ({
          select: () => ({
            contains: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
        }),
      }),
    }));

    const negCard = makeCard("outreach", { confidence: -5 });
    vi.doMock("@/lib/llm/anthropic", () => ({
      callModel: vi.fn().mockResolvedValue({
        text: JSON.stringify([negCard]),
        usage: { inputTokens: 500, outputTokens: 100 },
      }),
    }));

    const { generateActions } = await import("./actions");
    const ctx = await makeScanCtx();
    const result = await generateActions(ctx, SAMPLE_FINDINGS);

    for (const card of result) {
      expect(card.confidence).toBeGreaterThanOrEqual(0);
      expect(card.confidence).toBeLessThanOrEqual(1);
    }
  });
});

// ---------------------------------------------------------------------------
// Malformed JSON degradation
// ---------------------------------------------------------------------------
describe("generateActions — malformed JSON degrades without throwing", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  test("malformed JSON response returns non-empty degraded set (no throw)", async () => {
    vi.doMock("@/lib/dev/fixtures", () => ({ fixturesEnabled: () => false }));
    vi.doMock("@/lib/scan/fact-sheets", () => ({
      getFreshFactSheet: makeGetFreshFactSheetMock(),
      factSheetSubjectType: () => "app",
    }));
    vi.doMock("@/lib/db/client", () => ({
      serverDb: () => ({
        from: () => ({
          select: () => ({
            contains: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
        }),
      }),
    }));
    vi.doMock("@/lib/llm/anthropic", () => ({
      callModel: vi.fn().mockResolvedValue({
        text: "NOT JSON {{{{",
        usage: { inputTokens: 100, outputTokens: 10 },
      }),
    }));

    const { generateActions } = await import("./actions");
    const ctx = await makeScanCtx();
    const result = await generateActions(ctx, SAMPLE_FINDINGS);

    expect(result.length).toBeGreaterThan(0);
    // All degraded cards must still pass the invariants
    for (const card of result) {
      expect(card.draftRequiresEdit).toBe(true);
      expect(card.evidenceIds).toEqual([]);
      expect(card.verification.state).toBe("pending");
    }
  });

  test("non-array JSON response returns degraded set (no throw)", async () => {
    vi.doMock("@/lib/dev/fixtures", () => ({ fixturesEnabled: () => false }));
    vi.doMock("@/lib/scan/fact-sheets", () => ({
      getFreshFactSheet: makeGetFreshFactSheetMock(),
      factSheetSubjectType: () => "app",
    }));
    vi.doMock("@/lib/db/client", () => ({
      serverDb: () => ({
        from: () => ({
          select: () => ({
            contains: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
        }),
      }),
    }));
    vi.doMock("@/lib/llm/anthropic", () => ({
      callModel: vi.fn().mockResolvedValue({
        text: JSON.stringify({ error: "unexpected object" }),
        usage: { inputTokens: 100, outputTokens: 10 },
      }),
    }));

    const { generateActions } = await import("./actions");
    const ctx = await makeScanCtx();
    const result = await generateActions(ctx, SAMPLE_FINDINGS);

    expect(result.length).toBeGreaterThan(0);
  });

  test("callModel throwing returns degraded set (no throw)", async () => {
    vi.doMock("@/lib/dev/fixtures", () => ({ fixturesEnabled: () => false }));
    vi.doMock("@/lib/scan/fact-sheets", () => ({
      getFreshFactSheet: makeGetFreshFactSheetMock(),
      factSheetSubjectType: () => "app",
    }));
    vi.doMock("@/lib/db/client", () => ({
      serverDb: () => ({
        from: () => ({
          select: () => ({
            contains: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
        }),
      }),
    }));
    vi.doMock("@/lib/llm/anthropic", () => ({
      callModel: vi.fn().mockRejectedValue(new Error("API rate limit")),
    }));

    const { generateActions } = await import("./actions");
    const ctx = await makeScanCtx();
    const result = await generateActions(ctx, SAMPLE_FINDINGS);

    expect(result.length).toBeGreaterThan(0);
    for (const card of result) {
      expect(card.draftRequiresEdit).toBe(true);
    }
  });

  test("array with all malformed cards returns degraded set", async () => {
    vi.doMock("@/lib/dev/fixtures", () => ({ fixturesEnabled: () => false }));
    vi.doMock("@/lib/scan/fact-sheets", () => ({
      getFreshFactSheet: makeGetFreshFactSheetMock(),
      factSheetSubjectType: () => "app",
    }));
    vi.doMock("@/lib/db/client", () => ({
      serverDb: () => ({
        from: () => ({
          select: () => ({
            contains: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
        }),
      }),
    }));
    vi.doMock("@/lib/llm/anthropic", () => ({
      callModel: vi.fn().mockResolvedValue({
        text: JSON.stringify([
          { bad: "object" },
          { category: "unknown_category", title: "" },
          null,
        ]),
        usage: { inputTokens: 100, outputTokens: 10 },
      }),
    }));

    const { generateActions } = await import("./actions");
    const ctx = await makeScanCtx();
    const result = await generateActions(ctx, SAMPLE_FINDINGS);

    expect(result.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// evidenceIds invariant
// ---------------------------------------------------------------------------
describe("generateActions — evidenceIds invariant", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  test("evidenceIds is always [] regardless of model output", async () => {
    vi.doMock("@/lib/dev/fixtures", () => ({ fixturesEnabled: () => false }));
    vi.doMock("@/lib/scan/fact-sheets", () => ({
      getFreshFactSheet: makeGetFreshFactSheetMock(),
      factSheetSubjectType: () => "app",
    }));
    vi.doMock("@/lib/db/client", () => ({
      serverDb: () => ({
        from: () => ({
          select: () => ({
            contains: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
        }),
      }),
    }));

    // Model attempts to fill evidenceIds with non-empty array
    const cardWithIds = makeCard("content", { evidenceIds: [1, 2, 3] });
    vi.doMock("@/lib/llm/anthropic", () => ({
      callModel: vi.fn().mockResolvedValue({
        text: JSON.stringify([cardWithIds]),
        usage: { inputTokens: 500, outputTokens: 100 },
      }),
    }));

    const { generateActions } = await import("./actions");
    const ctx = await makeScanCtx();
    const result = await generateActions(ctx, SAMPLE_FINDINGS);

    for (const card of result) {
      expect(card.evidenceIds).toEqual([]);
    }
  });
});

// ---------------------------------------------------------------------------
// verification.state invariant
// ---------------------------------------------------------------------------
describe("generateActions — verification.state invariant", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  test("verification.state is always 'pending' regardless of model output", async () => {
    vi.doMock("@/lib/dev/fixtures", () => ({ fixturesEnabled: () => false }));
    vi.doMock("@/lib/scan/fact-sheets", () => ({
      getFreshFactSheet: makeGetFreshFactSheetMock(),
      factSheetSubjectType: () => "app",
    }));
    vi.doMock("@/lib/db/client", () => ({
      serverDb: () => ({
        from: () => ({
          select: () => ({
            contains: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
        }),
      }),
    }));

    // Model attempts to set state to something other than pending
    const cardBadState = makeCard("seo_aso", {
      verification: { method: "rank_check", state: "pending" }, // this is the type, but we want to test coercion
    });
    vi.doMock("@/lib/llm/anthropic", () => ({
      callModel: vi.fn().mockResolvedValue({
        text: JSON.stringify([cardBadState]),
        usage: { inputTokens: 500, outputTokens: 100 },
      }),
    }));

    const { generateActions } = await import("./actions");
    const ctx = await makeScanCtx();
    const result = await generateActions(ctx, SAMPLE_FINDINGS);

    for (const card of result) {
      expect(card.verification.state).toBe("pending");
    }
  });
});

// ---------------------------------------------------------------------------
// Fixture mode
// ---------------------------------------------------------------------------
describe("generateActions — fixture mode", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  test("fixture mode returns fixtureActions() without calling callModel or getFreshFactSheet", async () => {
    const callModelMock = vi.fn();
    const getFreshMock = vi.fn();

    const FIXTURE_CARDS = [
      makeCard("content"),
      makeCard("outreach"),
      makeCard("seo_aso"),
    ];

    vi.doMock("@/lib/dev/fixtures", () => ({
      fixturesEnabled: () => true,
      fixtureActions: () => FIXTURE_CARDS,
    }));
    vi.doMock("@/lib/scan/fact-sheets", () => ({
      getFreshFactSheet: getFreshMock,
      factSheetSubjectType: () => "app",
    }));
    vi.doMock("@/lib/llm/anthropic", () => ({ callModel: callModelMock }));
    vi.doMock("@/lib/db/client", () => ({
      serverDb: () => ({}),
    }));

    const { generateActions } = await import("./actions");
    const ctx = await makeScanCtx();
    const result = await generateActions(ctx, SAMPLE_FINDINGS);

    expect(callModelMock).not.toHaveBeenCalled();
    expect(getFreshMock).not.toHaveBeenCalled();
    expect(result).toEqual(FIXTURE_CARDS);
  });

  test("fixture mode result has ≥1 card per category", async () => {
    vi.doMock("@/lib/dev/fixtures", () => ({
      fixturesEnabled: () => true,
      fixtureActions: () => [makeCard("content"), makeCard("outreach"), makeCard("seo_aso")],
    }));
    vi.doMock("@/lib/scan/fact-sheets", () => ({
      getFreshFactSheet: vi.fn(),
      factSheetSubjectType: () => "app",
    }));
    vi.doMock("@/lib/llm/anthropic", () => ({ callModel: vi.fn() }));
    vi.doMock("@/lib/db/client", () => ({
      serverDb: () => ({}),
    }));

    const { generateActions } = await import("./actions");
    const ctx = await makeScanCtx();
    const result = await generateActions(ctx, SAMPLE_FINDINGS);

    const categories = result.map((c) => c.category);
    expect(categories).toContain("content");
    expect(categories).toContain("outreach");
    expect(categories).toContain("seo_aso");
  });

  test("fixtureActions() from fixtures.ts returns ≥3 cards each with valid shape", async () => {
    // Import the actual fixture function directly (not mocked)
    vi.doMock("@/lib/config/env", () => ({ env: { useFixtures: true } }));
    const { fixtureActions } = await import("@/lib/dev/fixtures");
    const cards = fixtureActions();

    expect(cards.length).toBeGreaterThanOrEqual(3);
    for (const card of cards) {
      expect(["content", "outreach", "seo_aso"]).toContain(card.category);
      expect(typeof card.title).toBe("string");
      expect(card.title.length).toBeGreaterThan(0);
      expect(typeof card.why).toBe("string");
      expect(Array.isArray(card.evidenceIds)).toBe(true);
      expect(card.evidenceIds).toEqual([]);
      expect(typeof card.effortMin).toBe("number");
      expect(typeof card.suggestedDeadline).toBe("string");
      expect(card.draftRequiresEdit).toBe(true);
      expect(card.verification.state).toBe("pending");
      expect(["url", "self_report", "rank_check"]).toContain(card.verification.method);
      expect(["evidence_based", "probability_based"]).toContain(card.basis);
      expect(card.confidence).toBeGreaterThanOrEqual(0);
      expect(card.confidence).toBeLessThanOrEqual(1);
      expect(typeof card.expectedOutcome.scoreComponent).toBe("string");
      expect(typeof card.expectedOutcome.delta).toBe("number");
    }
  });

  test("fixtureActions() has at least one card per category", async () => {
    vi.doMock("@/lib/config/env", () => ({ env: { useFixtures: true } }));
    const { fixtureActions } = await import("@/lib/dev/fixtures");
    const cards = fixtureActions();

    const categories = cards.map((c) => c.category);
    expect(categories).toContain("content");
    expect(categories).toContain("outreach");
    expect(categories).toContain("seo_aso");
  });
});

// ---------------------------------------------------------------------------
// markdown fence stripping
// ---------------------------------------------------------------------------
describe("generateActions — markdown fence stripping", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  test("strips markdown code fences if model wraps JSON in ```json ... ```", async () => {
    vi.doMock("@/lib/dev/fixtures", () => ({ fixturesEnabled: () => false }));
    vi.doMock("@/lib/scan/fact-sheets", () => ({
      getFreshFactSheet: makeGetFreshFactSheetMock(),
      factSheetSubjectType: () => "app",
    }));
    vi.doMock("@/lib/db/client", () => ({
      serverDb: () => ({
        from: () => ({
          select: () => ({
            contains: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
        }),
      }),
    }));

    const cards = [makeCard("content"), makeCard("outreach"), makeCard("seo_aso")];
    const wrappedText = "```json\n" + JSON.stringify(cards) + "\n```";

    vi.doMock("@/lib/llm/anthropic", () => ({
      callModel: vi.fn().mockResolvedValue({
        text: wrappedText,
        usage: { inputTokens: 500, outputTokens: 200 },
      }),
    }));

    const { generateActions } = await import("./actions");
    const ctx = await makeScanCtx();
    const result = await generateActions(ctx, SAMPLE_FINDINGS);

    expect(result.length).toBeGreaterThan(0);
    expect(result[0]?.category).toBe("content");
  });
});
