/**
 * algorithm-safety.test.ts — §11 algorithm-safety scan (Task 9)
 *
 * Coverage:
 *   - genericTellScore: flags cliché-laden drafts, passes specific ones
 *   - Outreach cap: 8 outreach → 5 (highest confidence)
 *   - Per-surface dedup: 2 actions citing the same host → 1
 *   - draftRequiresEdit forced true on every returned card
 *   - Fixture mode: generic draft not LLM-rewritten (callModel not called)
 *   - Fixture mode: draft embeddings inserted for this app (callEmbed + insertEmbeddings called)
 */

import { beforeEach, describe, expect, test, vi } from "vitest";
import type { ActionCard } from "@/lib/llm/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function makeScanCtx() {
  const { ScanBudget } = await import("@/lib/tools/registry");
  const budget = new ScanBudget({ maxToolCalls: 100, budgetCents: 5000 });
  return {
    scanId: "scan-algo-safety-test-1",
    appId: "app-algo-safety-test-1",
    storeUrl: "https://apps.apple.com/us/app/habitkit/id456",
    mode: "ios" as const,
    budget,
  };
}

/** Build a minimal valid ActionCard. */
function card(
  overrides: Partial<ActionCard> & { category: ActionCard["category"] },
): ActionCard {
  return {
    title: "Test action",
    why: "Because the evidence says so.",
    evidenceIds: [],
    evidence: [
      { excerpt: "the streak feature keeps me going", source: "review_themes", sourceType: "app_store_rss" },
      { excerpt: "habit tracker app volume 8100/mo", source: "keyword_data", sourceType: "dataforseo_keywords" },
    ],
    effortMin: 30,
    suggestedDeadline: "2026-07-15",
    expectedOutcome: { scoreComponent: "outreach", delta: 5 },
    draft: "Our app has a streak feature that users love.",
    draftRequiresEdit: true,
    verification: { method: "url", state: "pending" },
    basis: "evidence_based",
    confidence: 0.8,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// genericTellScore — pure deterministic, no mocks needed
// ---------------------------------------------------------------------------

describe("genericTellScore", () => {
  test("flags a cliché-laden draft", async () => {
    const { genericTellScore } = await import("./algorithm-safety");
    const draft =
      "In today's fast-paced world, look no further for a game-changer. " +
      "Leverage our seamless solution to unlock your potential and dive in effortlessly.";
    const score = genericTellScore(draft);
    expect(score).toBeGreaterThanOrEqual(2);
  });

  test("passes a specific, concrete draft", async () => {
    const { genericTellScore } = await import("./algorithm-safety");
    const draft =
      "Our Day-30 retention jumped from 31% to 47% after adding visual streak tracking. " +
      "Reviews now cite 'the streak feature keeps me going' as the top reason users stay. " +
      "If you tried Habitify and found the dashboards overwhelming, this is the anti-Habitify.";
    const score = genericTellScore(draft);
    expect(score).toBeLessThan(2);
  });

  test("empty draft scores 0", async () => {
    const { genericTellScore } = await import("./algorithm-safety");
    expect(genericTellScore("")).toBe(0);
  });

  test("case-insensitive matching — 'Leverage' is caught", async () => {
    const { genericTellScore } = await import("./algorithm-safety");
    const draft = "Leverage our platform to Unlock new possibilities.";
    const score = genericTellScore(draft);
    expect(score).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// Outreach cap: 8 outreach → 5 (highest confidence)
// ---------------------------------------------------------------------------

describe("algorithmSafety — outreach cap", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  test("8 outreach actions are trimmed to the 5 highest-confidence", async () => {
    vi.doMock("@/lib/dev/fixtures", () => ({ fixturesEnabled: () => true }));
    vi.doMock("@/lib/llm/embed", () => ({
      callEmbed: vi.fn().mockResolvedValue([]),
    }));
    vi.doMock("@/lib/scan/embeddings", () => ({
      insertEmbeddings: vi.fn().mockResolvedValue(undefined),
      deleteEmbeddingsForApp: vi.fn().mockResolvedValue(undefined),
      searchSimilar: vi.fn().mockResolvedValue([]),
    }));
    vi.doMock("@/lib/llm/anthropic", () => ({
      callModel: vi.fn(),
    }));

    const { algorithmSafety } = await import("./algorithm-safety");
    const ctx = await makeScanCtx();

    // 8 outreach cards with distinct confidences
    const outreachCards: ActionCard[] = Array.from({ length: 8 }, (_, i) =>
      card({
        category: "outreach",
        title: `Outreach card ${i}`,
        confidence: (i + 1) * 0.1, // 0.1, 0.2, ..., 0.8
        draft: `Specific draft mentioning our 47% Day-30 retention jump and real user quote: "keeps me going". Card ${i}.`,
        evidence: [
          { excerpt: `evidence ${i}a`, source: `source-${i}-a.com`, sourceType: "communities" },
          { excerpt: `evidence ${i}b`, source: `source-${i}-b.com`, sourceType: "youtube" },
        ],
      }),
    );

    const result = await algorithmSafety(ctx, outreachCards);
    const outreachResult = result.filter((c) => c.category === "outreach");

    expect(outreachResult).toHaveLength(5);
    // The 5 highest confidence values should be: 0.8, 0.7, 0.6, 0.5, 0.4
    const confidences = outreachResult.map((c) => c.confidence).sort((a, b) => b - a);
    expect(confidences[0]).toBeCloseTo(0.8);
    expect(confidences[4]).toBeCloseTo(0.4);
  });

  test("≤5 outreach cards are unchanged by the cap", async () => {
    vi.doMock("@/lib/dev/fixtures", () => ({ fixturesEnabled: () => true }));
    vi.doMock("@/lib/llm/embed", () => ({
      callEmbed: vi.fn().mockResolvedValue([]),
    }));
    vi.doMock("@/lib/scan/embeddings", () => ({
      insertEmbeddings: vi.fn().mockResolvedValue(undefined),
      deleteEmbeddingsForApp: vi.fn().mockResolvedValue(undefined),
      searchSimilar: vi.fn().mockResolvedValue([]),
    }));
    vi.doMock("@/lib/llm/anthropic", () => ({
      callModel: vi.fn(),
    }));

    const { algorithmSafety } = await import("./algorithm-safety");
    const ctx = await makeScanCtx();

    const threeOutreach: ActionCard[] = Array.from({ length: 3 }, (_, i) =>
      card({
        category: "outreach",
        title: `Outreach card ${i}`,
        confidence: 0.7,
        draft: `Specific draft with user quote "keeps me going". Card ${i}.`,
        evidence: [
          { excerpt: `e${i}a`, source: `host-${i}-a.com`, sourceType: "communities" },
          { excerpt: `e${i}b`, source: `host-${i}-b.com`, sourceType: "youtube" },
        ],
      }),
    );

    const result = await algorithmSafety(ctx, threeOutreach);
    const outreachResult = result.filter((c) => c.category === "outreach");
    expect(outreachResult).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// Per-surface dedup: 2 actions citing same host → 1
// ---------------------------------------------------------------------------

describe("algorithmSafety — per-surface dedup", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  test("two outreach actions sharing a source host → only the higher-confidence survives", async () => {
    vi.doMock("@/lib/dev/fixtures", () => ({ fixturesEnabled: () => true }));
    vi.doMock("@/lib/llm/embed", () => ({
      callEmbed: vi.fn().mockResolvedValue([]),
    }));
    vi.doMock("@/lib/scan/embeddings", () => ({
      insertEmbeddings: vi.fn().mockResolvedValue(undefined),
      deleteEmbeddingsForApp: vi.fn().mockResolvedValue(undefined),
      searchSimilar: vi.fn().mockResolvedValue([]),
    }));
    vi.doMock("@/lib/llm/anthropic", () => ({
      callModel: vi.fn(),
    }));

    const { algorithmSafety } = await import("./algorithm-safety");
    const ctx = await makeScanCtx();

    const sharedHost = "https://news.ycombinator.com/item?id=123";

    const cardA = card({
      category: "outreach",
      title: "HN outreach card A (higher confidence)",
      confidence: 0.85,
      draft: "Specific post mentioning our 47% Day-30 retention improvement.",
      evidence: [
        { excerpt: "Ask HN: best habit apps?", source: sharedHost, sourceType: "communities" },
        { excerpt: "keyword volume 8100", source: "keyword_data", sourceType: "dataforseo_keywords" },
      ],
    });
    const cardB = card({
      category: "outreach",
      title: "HN outreach card B (lower confidence)",
      confidence: 0.55,
      draft: "Another post mentioning our streak feature users love.",
      evidence: [
        { excerpt: "Show HN: habit tracker", source: sharedHost, sourceType: "communities" },
        { excerpt: "daily routine app", source: "keyword_data2", sourceType: "dataforseo_keywords" },
      ],
    });

    const result = await algorithmSafety(ctx, [cardA, cardB]);
    const outreachResult = result.filter((c) => c.category === "outreach");

    expect(outreachResult).toHaveLength(1);
    expect(outreachResult[0]?.title).toBe("HN outreach card A (higher confidence)");
  });

  test("two outreach actions with different hosts both survive", async () => {
    vi.doMock("@/lib/dev/fixtures", () => ({ fixturesEnabled: () => true }));
    vi.doMock("@/lib/llm/embed", () => ({
      callEmbed: vi.fn().mockResolvedValue([]),
    }));
    vi.doMock("@/lib/scan/embeddings", () => ({
      insertEmbeddings: vi.fn().mockResolvedValue(undefined),
      deleteEmbeddingsForApp: vi.fn().mockResolvedValue(undefined),
      searchSimilar: vi.fn().mockResolvedValue([]),
    }));
    vi.doMock("@/lib/llm/anthropic", () => ({
      callModel: vi.fn(),
    }));

    const { algorithmSafety } = await import("./algorithm-safety");
    const ctx = await makeScanCtx();

    const cardA = card({
      category: "outreach",
      title: "Reddit outreach",
      confidence: 0.8,
      draft: "Specific post for Reddit.",
      evidence: [
        { excerpt: "r/habittracking post", source: "https://reddit.com/r/habittracking", sourceType: "communities" },
        { excerpt: "streak keeps me going", source: "review_themes", sourceType: "app_store_rss" },
      ],
    });
    const cardB = card({
      category: "outreach",
      title: "HN outreach",
      confidence: 0.75,
      draft: "Specific post for Hacker News.",
      evidence: [
        { excerpt: "Ask HN thread", source: "https://news.ycombinator.com/item?id=456", sourceType: "communities" },
        { excerpt: "keyword data", source: "keyword_data", sourceType: "dataforseo_keywords" },
      ],
    });

    const result = await algorithmSafety(ctx, [cardA, cardB]);
    const outreachResult = result.filter((c) => c.category === "outreach");
    expect(outreachResult).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// draftRequiresEdit forced true
// ---------------------------------------------------------------------------

describe("algorithmSafety — draftRequiresEdit forced true", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  test("cards with draftRequiresEdit:false have it forced to true on output", async () => {
    vi.doMock("@/lib/dev/fixtures", () => ({ fixturesEnabled: () => true }));
    vi.doMock("@/lib/llm/embed", () => ({
      callEmbed: vi.fn().mockResolvedValue([]),
    }));
    vi.doMock("@/lib/scan/embeddings", () => ({
      insertEmbeddings: vi.fn().mockResolvedValue(undefined),
      deleteEmbeddingsForApp: vi.fn().mockResolvedValue(undefined),
      searchSimilar: vi.fn().mockResolvedValue([]),
    }));
    vi.doMock("@/lib/llm/anthropic", () => ({
      callModel: vi.fn(),
    }));

    const { algorithmSafety } = await import("./algorithm-safety");
    const ctx = await makeScanCtx();

    const badCard = card({
      category: "content",
      draftRequiresEdit: false as unknown as true, // bypass TS for test
    });

    const result = await algorithmSafety(ctx, [badCard]);
    expect(result.every((c) => c.draftRequiresEdit === true)).toBe(true);
  });

  test("all returned cards always have draftRequiresEdit true", async () => {
    vi.doMock("@/lib/dev/fixtures", () => ({ fixturesEnabled: () => true }));
    vi.doMock("@/lib/llm/embed", () => ({
      callEmbed: vi.fn().mockResolvedValue([]),
    }));
    vi.doMock("@/lib/scan/embeddings", () => ({
      insertEmbeddings: vi.fn().mockResolvedValue(undefined),
      deleteEmbeddingsForApp: vi.fn().mockResolvedValue(undefined),
      searchSimilar: vi.fn().mockResolvedValue([]),
    }));
    vi.doMock("@/lib/llm/anthropic", () => ({
      callModel: vi.fn(),
    }));

    const { algorithmSafety } = await import("./algorithm-safety");
    const ctx = await makeScanCtx();

    const cards = [
      card({ category: "content", draft: "Specific real-data draft." }),
      card({ category: "outreach", draft: "Another specific post." }),
      card({ category: "seo_aso", draft: null }),
    ];

    const result = await algorithmSafety(ctx, cards);
    for (const c of result) {
      expect(c.draftRequiresEdit).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Fixture mode: generic draft NOT LLM-rewritten (callModel not called)
// ---------------------------------------------------------------------------

describe("algorithmSafety — fixture mode (no LLM rewrite)", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  test("a generic draft is kept as-is (flagged but NOT rewritten) in fixture mode", async () => {
    vi.doMock("@/lib/dev/fixtures", () => ({ fixturesEnabled: () => true }));
    vi.doMock("@/lib/llm/embed", () => ({
      callEmbed: vi.fn().mockResolvedValue(
        Array.from({ length: 1 }, () => Array(1024).fill(0.01)),
      ),
    }));
    vi.doMock("@/lib/scan/embeddings", () => ({
      insertEmbeddings: vi.fn().mockResolvedValue(undefined),
      deleteEmbeddingsForApp: vi.fn().mockResolvedValue(undefined),
      searchSimilar: vi.fn().mockResolvedValue([]),
    }));
    const callModelMock = vi.fn();
    vi.doMock("@/lib/llm/anthropic", () => ({ callModel: callModelMock }));

    const { algorithmSafety } = await import("./algorithm-safety");
    const ctx = await makeScanCtx();

    // A clearly generic draft (score ≥ 2)
    const genericDraft =
      "In today's fast-paced world, look no further — our seamless solution will revolutionize how you track habits.";

    const badCard = card({ category: "content", draft: genericDraft });
    const result = await algorithmSafety(ctx, [badCard]);

    // callModel must NOT be called in fixture mode
    expect(callModelMock).not.toHaveBeenCalled();

    // The draft survives unchanged (fixture mode keeps it as-is)
    expect(result[0]?.draft).toBe(genericDraft);
  });

  test("fixture mode: draft embeddings are stored (deleteEmbeddingsForApp + insertEmbeddings called)", async () => {
    vi.doMock("@/lib/dev/fixtures", () => ({ fixturesEnabled: () => true }));

    const mockVec = Array(1024).fill(0.01);
    const callEmbedMock = vi.fn().mockResolvedValue([mockVec]);
    vi.doMock("@/lib/llm/embed", () => ({ callEmbed: callEmbedMock }));

    const insertMock = vi.fn().mockResolvedValue(undefined);
    const deleteMock = vi.fn().mockResolvedValue(undefined);
    vi.doMock("@/lib/scan/embeddings", () => ({
      insertEmbeddings: insertMock,
      deleteEmbeddingsForApp: deleteMock,
      searchSimilar: vi.fn().mockResolvedValue([]),
    }));
    vi.doMock("@/lib/llm/anthropic", () => ({ callModel: vi.fn() }));

    const { algorithmSafety } = await import("./algorithm-safety");
    const ctx = await makeScanCtx();

    const testCard = card({
      category: "content",
      draft: "Specific draft: our Day-30 retention improved by 47% after adding streak feature.",
    });

    await algorithmSafety(ctx, [testCard]);

    // deleteEmbeddingsForApp must be called before insertEmbeddings
    expect(deleteMock).toHaveBeenCalledWith(ctx.appId, "draft");
    // insertEmbeddings must be called with the draft embedding
    expect(insertMock).toHaveBeenCalledOnce();
    const insertArg = insertMock.mock.calls[0]?.[0] as Array<{
      subjectType: string;
      appId: string;
    }>;
    expect(insertArg[0]?.subjectType).toBe("draft");
    expect(insertArg[0]?.appId).toBe(ctx.appId);
  });
});

// ---------------------------------------------------------------------------
// Generic-tell: LLM rewrite attempted in live mode (mocked callModel)
// ---------------------------------------------------------------------------

describe("algorithmSafety — live mode generic-tell rewrite (mocked)", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  test("a generic draft triggers a Haiku rewrite; less-generic result is kept", async () => {
    vi.doMock("@/lib/dev/fixtures", () => ({ fixturesEnabled: () => false }));
    vi.doMock("@/lib/llm/embed", () => ({
      callEmbed: vi.fn().mockResolvedValue([Array(1024).fill(0.01)]),
    }));
    vi.doMock("@/lib/scan/embeddings", () => ({
      insertEmbeddings: vi.fn().mockResolvedValue(undefined),
      deleteEmbeddingsForApp: vi.fn().mockResolvedValue(undefined),
      searchSimilar: vi.fn().mockResolvedValue([]),
    }));

    const specificRewrite =
      "Our Day-30 retention improved by 47% after adding visual streak tracking. " +
      "The top review reads: 'the streak feature keeps me going'.";

    const callModelMock = vi.fn().mockResolvedValue({
      text: specificRewrite,
      usage: { inputTokens: 200, outputTokens: 80 },
    });
    vi.doMock("@/lib/llm/anthropic", () => ({ callModel: callModelMock }));

    const { algorithmSafety } = await import("./algorithm-safety");
    const ctx = await makeScanCtx();

    const genericDraft =
      "In today's fast-paced world, look no further — our seamless solution will revolutionize how you track habits effortlessly.";

    const testCard = card({ category: "content", draft: genericDraft });
    const result = await algorithmSafety(ctx, [testCard]);

    // callModel should have been called (the generic-tell rewrite attempt)
    expect(callModelMock).toHaveBeenCalled();

    // The specific rewrite has a lower generic score → should be kept
    const { genericTellScore } = await import("./algorithm-safety");
    const rewrittenScore = genericTellScore(specificRewrite);
    const originalScore = genericTellScore(genericDraft);
    expect(rewrittenScore).toBeLessThan(originalScore);
    expect(result[0]?.draft).toBe(specificRewrite);
  });

  test("if rewrite is MORE generic, the original draft is kept", async () => {
    vi.doMock("@/lib/dev/fixtures", () => ({ fixturesEnabled: () => false }));
    vi.doMock("@/lib/llm/embed", () => ({
      callEmbed: vi.fn().mockResolvedValue([Array(1024).fill(0.01)]),
    }));
    vi.doMock("@/lib/scan/embeddings", () => ({
      insertEmbeddings: vi.fn().mockResolvedValue(undefined),
      deleteEmbeddingsForApp: vi.fn().mockResolvedValue(undefined),
      searchSimilar: vi.fn().mockResolvedValue([]),
    }));

    // Rewrite is even more generic
    const worseRewrite =
      "In today's fast-paced world, our seamless, cutting-edge game-changer will effortlessly revolutionize and elevate your life.";

    const callModelMock = vi.fn().mockResolvedValue({
      text: worseRewrite,
      usage: { inputTokens: 200, outputTokens: 80 },
    });
    vi.doMock("@/lib/llm/anthropic", () => ({ callModel: callModelMock }));

    const { algorithmSafety, genericTellScore } = await import("./algorithm-safety");
    const ctx = await makeScanCtx();

    const genericDraft =
      "In today's fast-paced world, look no further — our seamless solution will revolutionize how you track habits.";

    const testCard = card({ category: "content", draft: genericDraft });
    const result = await algorithmSafety(ctx, [testCard]);

    // Original draft should be retained since rewrite is more generic
    const rewrittenScore = genericTellScore(worseRewrite);
    const originalScore = genericTellScore(genericDraft);
    expect(rewrittenScore).toBeGreaterThanOrEqual(originalScore);
    expect(result[0]?.draft).toBe(genericDraft);
  });
});

// ---------------------------------------------------------------------------
// seo_aso cards with null draft are unaffected by draft checks
// ---------------------------------------------------------------------------

describe("algorithmSafety — null draft cards are unaffected", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  test("seo_aso card with null draft passes through all checks unchanged", async () => {
    vi.doMock("@/lib/dev/fixtures", () => ({ fixturesEnabled: () => true }));
    vi.doMock("@/lib/llm/embed", () => ({
      callEmbed: vi.fn().mockResolvedValue([]),
    }));
    vi.doMock("@/lib/scan/embeddings", () => ({
      insertEmbeddings: vi.fn().mockResolvedValue(undefined),
      deleteEmbeddingsForApp: vi.fn().mockResolvedValue(undefined),
      searchSimilar: vi.fn().mockResolvedValue([]),
    }));
    vi.doMock("@/lib/llm/anthropic", () => ({ callModel: vi.fn() }));

    const { algorithmSafety } = await import("./algorithm-safety");
    const ctx = await makeScanCtx();

    const seoCard = card({ category: "seo_aso", draft: null });
    const result = await algorithmSafety(ctx, [seoCard]);

    expect(result).toHaveLength(1);
    expect(result[0]?.draft).toBeNull();
    expect(result[0]?.draftRequiresEdit).toBe(true);
  });
});
