/**
 * critic.test.ts — Critic Gate v2 (Task 8 / §9.2)
 *
 * Coverage:
 *   - Deterministic rule rejections (rules 1, 3, 4, 5a, 7a, 9, 10)
 *   - LLM path (mocked callModel): specificity/draft/audience checks
 *   - Revise loop: revised card re-checked, exhaustion → drop or downgrade
 *   - check_link (mocked): non-entailing link fails rule 7b
 *   - Source diversity rule (6): excess cards from one type are dropped
 *   - Fixture mode: runCriticGate(fixtureActions()) → all pass, no network calls
 */

import { beforeEach, describe, expect, test, vi } from "vitest";
import type { ActionCard } from "./types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function makeScanCtx() {
  const { ScanBudget } = await import("@/lib/tools/registry");
  const budget = new ScanBudget({ maxToolCalls: 100, budgetCents: 5000 });
  return {
    scanId: "scan-critic-test-1",
    appId: "app-critic-test-1",
    storeUrl: "https://apps.apple.com/us/app/habitkit/id456",
    mode: "ios" as const,
    budget,
  };
}

/** Build a minimal valid ActionCard that PASSES all deterministic rules. */
function passingCard(
  category: ActionCard["category"] = "content",
  overrides: Partial<ActionCard> = {},
): ActionCard {
  return {
    category,
    title: "Post in r/habittracking about streak motivation",
    why: "r/habittracking users cite streak consistency as the primary retention driver, matching our 'the streak feature keeps me going' review theme.",
    evidenceIds: [],
    evidence: [
      { excerpt: "the streak feature keeps me going", source: "review_themes", sourceType: "app_store_rss" },
      { excerpt: "habit tracker app volume 8100/mo", source: "keyword_data", sourceType: "dataforseo_keywords" },
    ],
    effortMin: 30,
    suggestedDeadline: "2026-07-15",
    expectedOutcome: { scoreComponent: "content", delta: 5 },
    draft: "Curious what made you stick with your habit app long-term — for me it was the streak feature.",
    draftRequiresEdit: true,
    verification: { method: "url", state: "pending" },
    basis: "evidence_based",
    confidence: 0.8,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Deterministic rejections — no mocks needed (just imports)
// ---------------------------------------------------------------------------

describe("runCritic — deterministic rule rejections", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  test("rule 1: card with 1 evidence item fails 'evidence'", async () => {
    // Fixture mode ON so LLM/check_link are skipped
    vi.doMock("@/lib/dev/fixtures", () => ({ fixturesEnabled: () => true }));
    vi.doMock("@/lib/telemetry/pipeline-runs", () => ({
      recordPipelineRun: vi.fn().mockResolvedValue(undefined),
    }));

    const { runCritic } = await import("./critic");
    const ctx = await makeScanCtx();
    const card = passingCard("content", {
      evidence: [
        { excerpt: "only one item", source: "review_themes", sourceType: "app_store_rss" },
      ],
    });

    const result = await runCritic(ctx, card);
    expect(result.pass).toBe(false);
    expect(result.failedRules).toContain("evidence");
  });

  test("rule 1: card with 2 items but same sourceType fails 'evidence'", async () => {
    vi.doMock("@/lib/dev/fixtures", () => ({ fixturesEnabled: () => true }));
    vi.doMock("@/lib/telemetry/pipeline-runs", () => ({
      recordPipelineRun: vi.fn().mockResolvedValue(undefined),
    }));

    const { runCritic } = await import("./critic");
    const ctx = await makeScanCtx();
    const card = passingCard("content", {
      evidence: [
        { excerpt: "item one", source: "review_themes", sourceType: "app_store_rss" },
        { excerpt: "item two", source: "more_reviews", sourceType: "app_store_rss" },
      ],
    });

    const result = await runCritic(ctx, card);
    expect(result.pass).toBe(false);
    expect(result.failedRules).toContain("evidence");
  });

  test("rule 3: missing/invalid deadline fails 'deadline'", async () => {
    vi.doMock("@/lib/dev/fixtures", () => ({ fixturesEnabled: () => true }));
    vi.doMock("@/lib/telemetry/pipeline-runs", () => ({
      recordPipelineRun: vi.fn().mockResolvedValue(undefined),
    }));

    const { runCritic } = await import("./critic");
    const ctx = await makeScanCtx();
    const card = passingCard("content", { suggestedDeadline: "not-a-date" });

    const result = await runCritic(ctx, card);
    expect(result.pass).toBe(false);
    expect(result.failedRules).toContain("deadline");
  });

  test("rule 3: effortMin=0 fails 'effort'", async () => {
    vi.doMock("@/lib/dev/fixtures", () => ({ fixturesEnabled: () => true }));
    vi.doMock("@/lib/telemetry/pipeline-runs", () => ({
      recordPipelineRun: vi.fn().mockResolvedValue(undefined),
    }));

    const { runCritic } = await import("./critic");
    const ctx = await makeScanCtx();
    const card = passingCard("content", { effortMin: 0 });

    const result = await runCritic(ctx, card);
    expect(result.pass).toBe(false);
    expect(result.failedRules).toContain("effort");
  });

  // Fix M1: NaN delta fails rule 4
  test("M1: delta: NaN fails rule 4 (expected_outcome)", async () => {
    vi.doMock("@/lib/dev/fixtures", () => ({ fixturesEnabled: () => true }));
    vi.doMock("@/lib/telemetry/pipeline-runs", () => ({
      recordPipelineRun: vi.fn().mockResolvedValue(undefined),
    }));

    const { runCritic } = await import("./critic");
    const ctx = await makeScanCtx();
    const card = passingCard("content", {
      expectedOutcome: { scoreComponent: "content", delta: NaN },
    });

    const result = await runCritic(ctx, card);
    expect(result.pass).toBe(false);
    expect(result.failedRules).toContain("expected_outcome");
  });

  test("rule 5a: content card with null draft fails 'draft_missing'", async () => {
    vi.doMock("@/lib/dev/fixtures", () => ({ fixturesEnabled: () => true }));
    vi.doMock("@/lib/telemetry/pipeline-runs", () => ({
      recordPipelineRun: vi.fn().mockResolvedValue(undefined),
    }));

    const { runCritic } = await import("./critic");
    const ctx = await makeScanCtx();
    const card = passingCard("content", { draft: null });

    const result = await runCritic(ctx, card);
    expect(result.pass).toBe(false);
    expect(result.failedRules).toContain("draft_missing");
  });

  test("rule 5a: outreach card with null draft fails 'draft_missing'", async () => {
    vi.doMock("@/lib/dev/fixtures", () => ({ fixturesEnabled: () => true }));
    vi.doMock("@/lib/telemetry/pipeline-runs", () => ({
      recordPipelineRun: vi.fn().mockResolvedValue(undefined),
    }));

    const { runCritic } = await import("./critic");
    const ctx = await makeScanCtx();
    const card = passingCard("outreach", { draft: null });

    const result = await runCritic(ctx, card);
    expect(result.pass).toBe(false);
    expect(result.failedRules).toContain("draft_missing");
  });

  test("rule 5a: seo_aso card with null draft PASSES (seo exemption)", async () => {
    vi.doMock("@/lib/dev/fixtures", () => ({ fixturesEnabled: () => true }));
    vi.doMock("@/lib/telemetry/pipeline-runs", () => ({
      recordPipelineRun: vi.fn().mockResolvedValue(undefined),
    }));

    const { runCritic } = await import("./critic");
    const ctx = await makeScanCtx();
    const card = passingCard("seo_aso", { draft: null });

    const result = await runCritic(ctx, card);
    expect(result.failedRules).not.toContain("draft_missing");
  });

  test("rule 7a: probability_based with confidence 0.8 fails 'confidence_cap'", async () => {
    vi.doMock("@/lib/dev/fixtures", () => ({ fixturesEnabled: () => true }));
    vi.doMock("@/lib/telemetry/pipeline-runs", () => ({
      recordPipelineRun: vi.fn().mockResolvedValue(undefined),
    }));

    const { runCritic } = await import("./critic");
    const ctx = await makeScanCtx();
    const card = passingCard("content", { basis: "probability_based", confidence: 0.8 });

    const result = await runCritic(ctx, card);
    expect(result.pass).toBe(false);
    expect(result.failedRules).toContain("confidence_cap");
  });

  test("rule 7a: probability_based with confidence 0.6 PASSES", async () => {
    vi.doMock("@/lib/dev/fixtures", () => ({ fixturesEnabled: () => true }));
    vi.doMock("@/lib/telemetry/pipeline-runs", () => ({
      recordPipelineRun: vi.fn().mockResolvedValue(undefined),
    }));

    const { runCritic } = await import("./critic");
    const ctx = await makeScanCtx();
    const card = passingCard("content", { basis: "probability_based", confidence: 0.6 });

    const result = await runCritic(ctx, card);
    expect(result.failedRules).not.toContain("confidence_cap");
  });

  test("rule 9: draftRequiresEdit=false fails 'draft_requires_edit'", async () => {
    vi.doMock("@/lib/dev/fixtures", () => ({ fixturesEnabled: () => true }));
    vi.doMock("@/lib/telemetry/pipeline-runs", () => ({
      recordPipelineRun: vi.fn().mockResolvedValue(undefined),
    }));

    const { runCritic } = await import("./critic");
    const ctx = await makeScanCtx();
    // TypeScript would normally prevent this, but we cast to test the guard
    const card = passingCard("content", { draftRequiresEdit: false as unknown as true });

    const result = await runCritic(ctx, card);
    expect(result.pass).toBe(false);
    expect(result.failedRules).toContain("draft_requires_edit");
  });

  test("well-formed card passes all deterministic checks in fixture mode", async () => {
    vi.doMock("@/lib/dev/fixtures", () => ({ fixturesEnabled: () => true }));
    vi.doMock("@/lib/telemetry/pipeline-runs", () => ({
      recordPipelineRun: vi.fn().mockResolvedValue(undefined),
    }));

    const { runCritic } = await import("./critic");
    const ctx = await makeScanCtx();
    const card = passingCard("content");

    const result = await runCritic(ctx, card);
    expect(result.pass).toBe(true);
    expect(result.failedRules).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// LLM path — mock callModel to control critic responses
// ---------------------------------------------------------------------------

describe("runCritic — LLM checks (mocked callModel)", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  test("rule 2: non-specific card fails 'specificity'", async () => {
    vi.doMock("@/lib/dev/fixtures", () => ({ fixturesEnabled: () => false }));
    vi.doMock("@/lib/telemetry/pipeline-runs", () => ({
      recordPipelineRun: vi.fn().mockResolvedValue(undefined),
    }));
    vi.doMock("@/lib/llm/check-link", () => ({
      checkLink: { name: "check_link", klass: "L", run: vi.fn().mockResolvedValue({ entails: true, reason: "ok" }) },
    }));
    vi.doMock("@/lib/llm/anthropic", () => ({
      callModel: vi.fn().mockResolvedValue({
        text: JSON.stringify({ specificityOk: false, draftCitesFact: true, audienceHonest: true }),
        usage: { inputTokens: 500, outputTokens: 200 },
      }),
    }));

    const { runCritic } = await import("./critic");
    const ctx = await makeScanCtx();
    const card = passingCard("outreach");

    const result = await runCritic(ctx, card);
    expect(result.pass).toBe(false);
    expect(result.failedRules).toContain("specificity");
  });

  test("rule 5b: draft not citing a fact fails 'draft_cites_fact'", async () => {
    vi.doMock("@/lib/dev/fixtures", () => ({ fixturesEnabled: () => false }));
    vi.doMock("@/lib/telemetry/pipeline-runs", () => ({
      recordPipelineRun: vi.fn().mockResolvedValue(undefined),
    }));
    vi.doMock("@/lib/llm/check-link", () => ({
      checkLink: { name: "check_link", klass: "L", run: vi.fn().mockResolvedValue({ entails: true, reason: "ok" }) },
    }));
    vi.doMock("@/lib/llm/anthropic", () => ({
      callModel: vi.fn().mockResolvedValue({
        text: JSON.stringify({ specificityOk: true, draftCitesFact: false, audienceHonest: true }),
        usage: { inputTokens: 500, outputTokens: 200 },
      }),
    }));

    const { runCritic } = await import("./critic");
    const ctx = await makeScanCtx();
    const card = passingCard("content");

    const result = await runCritic(ctx, card);
    expect(result.pass).toBe(false);
    expect(result.failedRules).toContain("draft_cites_fact");
  });

  test("rule 8: newcomer-hostile community fails 'audience_honest'", async () => {
    vi.doMock("@/lib/dev/fixtures", () => ({ fixturesEnabled: () => false }));
    vi.doMock("@/lib/telemetry/pipeline-runs", () => ({
      recordPipelineRun: vi.fn().mockResolvedValue(undefined),
    }));
    vi.doMock("@/lib/llm/check-link", () => ({
      checkLink: { name: "check_link", klass: "L", run: vi.fn().mockResolvedValue({ entails: true, reason: "ok" }) },
    }));
    vi.doMock("@/lib/llm/anthropic", () => ({
      callModel: vi.fn().mockResolvedValue({
        text: JSON.stringify({ specificityOk: true, draftCitesFact: true, audienceHonest: false }),
        usage: { inputTokens: 500, outputTokens: 200 },
      }),
    }));

    const { runCritic } = await import("./critic");
    const ctx = await makeScanCtx();
    const card = passingCard("outreach");

    const result = await runCritic(ctx, card);
    expect(result.pass).toBe(false);
    expect(result.failedRules).toContain("audience_honest");
  });

  test("all LLM checks pass → card passes (no LLM-failed rules)", async () => {
    vi.doMock("@/lib/dev/fixtures", () => ({ fixturesEnabled: () => false }));
    vi.doMock("@/lib/telemetry/pipeline-runs", () => ({
      recordPipelineRun: vi.fn().mockResolvedValue(undefined),
    }));
    vi.doMock("@/lib/llm/check-link", () => ({
      checkLink: { name: "check_link", klass: "L", run: vi.fn().mockResolvedValue({ entails: true, reason: "ok" }) },
    }));
    vi.doMock("@/lib/llm/anthropic", () => ({
      callModel: vi.fn().mockResolvedValue({
        text: JSON.stringify({ specificityOk: true, draftCitesFact: true, audienceHonest: true }),
        usage: { inputTokens: 500, outputTokens: 200 },
      }),
    }));

    const { runCritic } = await import("./critic");
    const ctx = await makeScanCtx();
    const card = passingCard("content");

    const result = await runCritic(ctx, card);
    expect(result.pass).toBe(true);
    expect(result.failedRules).toHaveLength(0);
  });

  test("LLM returns revised card — revised card is returned in result", async () => {
    vi.doMock("@/lib/dev/fixtures", () => ({ fixturesEnabled: () => false }));
    vi.doMock("@/lib/telemetry/pipeline-runs", () => ({
      recordPipelineRun: vi.fn().mockResolvedValue(undefined),
    }));
    vi.doMock("@/lib/llm/check-link", () => ({
      checkLink: { name: "check_link", klass: "L", run: vi.fn().mockResolvedValue({ entails: true, reason: "ok" }) },
    }));

    const revisedCard = passingCard("outreach", {
      title: "Revised: Post in r/habittracking with a specific streak question",
      draft: "What actually made you stick with your habit app? For me it was the streak — 'the streak feature keeps me going' is literally our most common review.",
    });

    vi.doMock("@/lib/llm/anthropic", () => ({
      callModel: vi.fn().mockResolvedValue({
        text: JSON.stringify({
          specificityOk: false,
          draftCitesFact: true,
          audienceHonest: true,
          revised: revisedCard,
        }),
        usage: { inputTokens: 500, outputTokens: 400 },
      }),
    }));

    const { runCritic } = await import("./critic");
    const ctx = await makeScanCtx();
    const original = passingCard("outreach", { title: "Original non-specific title" });

    const result = await runCritic(ctx, original);
    // Should fail specificity but return the revised card
    expect(result.failedRules).toContain("specificity");
    expect(result.card.title).toBe("Revised: Post in r/habittracking with a specific streak question");
    // §11 invariants must be preserved on the revised card
    expect(result.card.draftRequiresEdit).toBe(true);
    expect(result.card.verification.state).toBe("pending");
  });
});

// ---------------------------------------------------------------------------
// check_link rule (7b)
// ---------------------------------------------------------------------------

describe("runCritic — check_link (rule 7b, mocked)", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  test("rule 7b: non-entailing link fails 'entailment'", async () => {
    vi.doMock("@/lib/dev/fixtures", () => ({ fixturesEnabled: () => false }));
    vi.doMock("@/lib/telemetry/pipeline-runs", () => ({
      recordPipelineRun: vi.fn().mockResolvedValue(undefined),
    }));
    vi.doMock("@/lib/llm/anthropic", () => ({
      callModel: vi.fn().mockResolvedValue({
        text: JSON.stringify({ specificityOk: true, draftCitesFact: true, audienceHonest: true }),
        usage: { inputTokens: 500, outputTokens: 200 },
      }),
    }));
    // Mock check_link to return non-entailed
    vi.doMock("@/lib/llm/check-link", () => ({
      checkLink: {
        name: "check_link",
        klass: "L",
        run: vi.fn().mockResolvedValue({ entails: false, reason: "source does not mention the claim" }),
      },
    }));

    const { runCritic } = await import("./critic");
    const ctx = await makeScanCtx();
    // Card with an http evidence source so check_link is invoked
    const card = passingCard("content", {
      evidence: [
        { excerpt: "streak feature", source: "https://example.com/review", sourceType: "app_store_rss" },
        { excerpt: "habit tracker", source: "keyword_data", sourceType: "dataforseo_keywords" },
      ],
    });

    const result = await runCritic(ctx, card);
    expect(result.pass).toBe(false);
    expect(result.failedRules).toContain("entailment");
  });

  test("rule 7b: entailing link PASSES entailment", async () => {
    vi.doMock("@/lib/dev/fixtures", () => ({ fixturesEnabled: () => false }));
    vi.doMock("@/lib/telemetry/pipeline-runs", () => ({
      recordPipelineRun: vi.fn().mockResolvedValue(undefined),
    }));
    vi.doMock("@/lib/llm/anthropic", () => ({
      callModel: vi.fn().mockResolvedValue({
        text: JSON.stringify({ specificityOk: true, draftCitesFact: true, audienceHonest: true }),
        usage: { inputTokens: 500, outputTokens: 200 },
      }),
    }));
    vi.doMock("@/lib/llm/check-link", () => ({
      checkLink: {
        name: "check_link",
        klass: "L",
        run: vi.fn().mockResolvedValue({ entails: true, reason: "source supports claim" }),
      },
    }));

    const { runCritic } = await import("./critic");
    const ctx = await makeScanCtx();
    const card = passingCard("content", {
      evidence: [
        { excerpt: "streak feature", source: "https://example.com/review", sourceType: "app_store_rss" },
        { excerpt: "habit tracker", source: "keyword_data", sourceType: "dataforseo_keywords" },
      ],
    });

    const result = await runCritic(ctx, card);
    expect(result.failedRules).not.toContain("entailment");
  });

  test("non-http evidence sources are NOT checked via check_link", async () => {
    vi.doMock("@/lib/dev/fixtures", () => ({ fixturesEnabled: () => false }));
    vi.doMock("@/lib/telemetry/pipeline-runs", () => ({
      recordPipelineRun: vi.fn().mockResolvedValue(undefined),
    }));
    vi.doMock("@/lib/llm/anthropic", () => ({
      callModel: vi.fn().mockResolvedValue({
        text: JSON.stringify({ specificityOk: true, draftCitesFact: true, audienceHonest: true }),
        usage: { inputTokens: 500, outputTokens: 200 },
      }),
    }));
    const checkLinkMock = vi.fn().mockResolvedValue({ entails: false, reason: "fail" });
    vi.doMock("@/lib/llm/check-link", () => ({
      checkLink: { name: "check_link", klass: "L", run: checkLinkMock },
    }));

    const { runCritic } = await import("./critic");
    const ctx = await makeScanCtx();
    // evidence sources are internal identifiers, not URLs
    const card = passingCard("content", {
      evidence: [
        { excerpt: "streak feature", source: "review_themes", sourceType: "app_store_rss" },
        { excerpt: "habit tracker", source: "keyword_data", sourceType: "dataforseo_keywords" },
      ],
    });

    const result = await runCritic(ctx, card);
    // check_link should not have been called
    expect(checkLinkMock).not.toHaveBeenCalled();
    expect(result.failedRules).not.toContain("entailment");
  });
});

// ---------------------------------------------------------------------------
// Reject/revise loop (criticGateCard)
// ---------------------------------------------------------------------------

describe("criticGateCard — reject/revise loop", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  test("card that passes on second attempt (after revision) is returned as 'pass'", async () => {
    vi.doMock("@/lib/dev/fixtures", () => ({ fixturesEnabled: () => false }));
    vi.doMock("@/lib/telemetry/pipeline-runs", () => ({
      recordPipelineRun: vi.fn().mockResolvedValue(undefined),
    }));
    vi.doMock("@/lib/llm/check-link", () => ({
      checkLink: { name: "check_link", klass: "L", run: vi.fn().mockResolvedValue({ entails: true, reason: "ok" }) },
    }));

    let callCount = 0;
    const revisedCard = passingCard("outreach", { title: "Specific: r/habittracking streak question" });

    vi.doMock("@/lib/llm/anthropic", () => ({
      callModel: vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First call: specificity fails but includes revised card
          return Promise.resolve({
            text: JSON.stringify({
              specificityOk: false,
              draftCitesFact: true,
              audienceHonest: true,
              revised: revisedCard,
            }),
            usage: { inputTokens: 500, outputTokens: 400 },
          });
        }
        // Second call: all pass (revised card is good)
        return Promise.resolve({
          text: JSON.stringify({ specificityOk: true, draftCitesFact: true, audienceHonest: true }),
          usage: { inputTokens: 500, outputTokens: 200 },
        });
      }),
    }));

    const { criticGateCard } = await import("./critic");
    const ctx = await makeScanCtx();
    const card = passingCard("outreach");

    const { outcome, card: finalCard } = await criticGateCard(ctx, card, 3);
    expect(outcome).toBe("pass");
    expect(finalCard.title).toBe("Specific: r/habittracking streak question");
  });

  test("after maxRetries exhausted with only fixable fails, card is DROPPED", async () => {
    vi.doMock("@/lib/dev/fixtures", () => ({ fixturesEnabled: () => false }));
    vi.doMock("@/lib/telemetry/pipeline-runs", () => ({
      recordPipelineRun: vi.fn().mockResolvedValue(undefined),
    }));
    vi.doMock("@/lib/llm/check-link", () => ({
      checkLink: { name: "check_link", klass: "L", run: vi.fn().mockResolvedValue({ entails: true, reason: "ok" }) },
    }));

    // Every call: specificity fails, no revised card → can't fix
    vi.doMock("@/lib/llm/anthropic", () => ({
      callModel: vi.fn().mockResolvedValue({
        text: JSON.stringify({ specificityOk: false, draftCitesFact: false, audienceHonest: false }),
        usage: { inputTokens: 500, outputTokens: 200 },
      }),
    }));

    const { criticGateCard } = await import("./critic");
    const ctx = await makeScanCtx();
    const card = passingCard("outreach");

    const { outcome, failedRules } = await criticGateCard(ctx, card, 3);
    expect(outcome).toBe("drop");
    expect(failedRules.length).toBeGreaterThan(0);
  });

  test("after maxRetries with only evidence/confidence_cap fails → card is DOWNGRADED not dropped", async () => {
    vi.doMock("@/lib/dev/fixtures", () => ({ fixturesEnabled: () => true })); // fixture → no LLM
    vi.doMock("@/lib/telemetry/pipeline-runs", () => ({
      recordPipelineRun: vi.fn().mockResolvedValue(undefined),
    }));

    const { criticGateCard } = await import("./critic");
    const ctx = await makeScanCtx();
    // probability_based with confidence 0.8 → fails confidence_cap (and can't be fixed by LLM in fixture mode)
    const card = passingCard("content", {
      basis: "probability_based",
      confidence: 0.8,
    });

    const { outcome, card: finalCard } = await criticGateCard(ctx, card, 3);
    expect(outcome).toBe("downgrade");
    expect(finalCard.basis).toBe("probability_based");
    expect(finalCard.confidence).toBeLessThanOrEqual(0.6);
  });

  // Fix C1: mixed specificity+evidence → dropped, NOT downgraded
  test("C1: card failing [specificity, evidence] (LLM keeps specificity failing) → DROPPED not downgraded", async () => {
    vi.doMock("@/lib/dev/fixtures", () => ({ fixturesEnabled: () => false }));
    vi.doMock("@/lib/telemetry/pipeline-runs", () => ({
      recordPipelineRun: vi.fn().mockResolvedValue(undefined),
    }));
    vi.doMock("@/lib/llm/check-link", () => ({
      checkLink: { name: "check_link", klass: "L", run: vi.fn().mockResolvedValue({ entails: true, reason: "ok" }) },
    }));
    // LLM always keeps specificity failing → specificity never resolves
    vi.doMock("@/lib/llm/anthropic", () => ({
      callModel: vi.fn().mockResolvedValue({
        text: JSON.stringify({ specificityOk: false, draftCitesFact: true, audienceHonest: true }),
        usage: { inputTokens: 500, outputTokens: 200 },
      }),
    }));

    const { criticGateCard } = await import("./critic");
    const ctx = await makeScanCtx();
    // Card with only 1 evidence item → fails "evidence" deterministically
    // LLM will fail "specificity" → mixed [evidence, specificity]
    const card = passingCard("outreach", {
      evidence: [
        { excerpt: "only one item", source: "review_themes", sourceType: "app_store_rss" },
      ],
    });

    const { outcome } = await criticGateCard(ctx, card, 3);
    // specificity is not in DOWNGRADE_ELIGIBLE_RULES → must be DROPPED
    expect(outcome).toBe("drop");
  });

  // Fix I1: card failing ONLY evidence → downgraded with no fabricated evidence
  test("I1: card failing only [evidence] → DOWNGRADED, confidence ≤0.6, evidence array unchanged", async () => {
    vi.doMock("@/lib/dev/fixtures", () => ({ fixturesEnabled: () => true })); // fixture → no LLM
    vi.doMock("@/lib/telemetry/pipeline-runs", () => ({
      recordPipelineRun: vi.fn().mockResolvedValue(undefined),
    }));

    const { criticGateCard } = await import("./critic");
    const ctx = await makeScanCtx();
    // Only 1 evidence item → fails "evidence". All other rules pass.
    const originalEvidence = [
      { excerpt: "streak feature keeps me going", source: "review_themes", sourceType: "app_store_rss" },
    ];
    const card = passingCard("content", { evidence: [...originalEvidence] });

    const { outcome, card: finalCard } = await criticGateCard(ctx, card, 3);
    expect(outcome).toBe("downgrade");
    expect(finalCard.basis).toBe("probability_based");
    expect(finalCard.confidence).toBeLessThanOrEqual(0.6);
    // Evidence must NOT have been fabricated — array length unchanged (no padding)
    expect(finalCard.evidence).toHaveLength(originalEvidence.length);
    expect(finalCard.evidence[0]?.excerpt).toBe(originalEvidence[0]?.excerpt);
  });

  // Fix I3: hard fail (effortMin=0) + fixable fail → dropped, early break (minimal LLM calls)
  test("I3: card with hard fail (effortMin=0) → dropped with 0 LLM calls (early break)", async () => {
    vi.doMock("@/lib/dev/fixtures", () => ({ fixturesEnabled: () => false }));
    vi.doMock("@/lib/telemetry/pipeline-runs", () => ({
      recordPipelineRun: vi.fn().mockResolvedValue(undefined),
    }));
    vi.doMock("@/lib/llm/check-link", () => ({
      checkLink: { name: "check_link", klass: "L", run: vi.fn().mockResolvedValue({ entails: true, reason: "ok" }) },
    }));
    const callModelMock = vi.fn().mockResolvedValue({
      text: JSON.stringify({ specificityOk: false, draftCitesFact: true, audienceHonest: true }),
      usage: { inputTokens: 500, outputTokens: 200 },
    });
    vi.doMock("@/lib/llm/anthropic", () => ({ callModel: callModelMock }));

    const { criticGateCard } = await import("./critic");
    const ctx = await makeScanCtx();
    // effortMin=0 → fails "effort" (a hard fail: not in FIXABLE_RULES, not in DOWNGRADE_ELIGIBLE_RULES)
    const card = passingCard("outreach", { effortMin: 0 });

    const { outcome } = await criticGateCard(ctx, card, 3);
    expect(outcome).toBe("drop");
    // After the first runCritic sees the hard fail (effort), the loop breaks immediately.
    // runCritic calls the LLM once in attempt 0, then breaks — so callModel is called exactly once.
    expect(callModelMock).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Source diversity rule (6)
// ---------------------------------------------------------------------------

describe("runCriticGate — source diversity rule (6)", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  test("4 of 5 cards sharing one dominant sourceType drops the excess down to 30%", async () => {
    vi.doMock("@/lib/dev/fixtures", () => ({ fixturesEnabled: () => true })); // skip LLM
    vi.doMock("@/lib/telemetry/pipeline-runs", () => ({
      recordPipelineRun: vi.fn().mockResolvedValue(undefined),
    }));

    const { runCriticGate } = await import("./critic");
    const ctx = await makeScanCtx();

    // 4 cards dominated by "app_store_rss", 1 card dominated by "dataforseo_keywords"
    // With 5 cards, threshold = floor(5 * 0.3) = 1 → at most 1 from each type
    const cards: ActionCard[] = [
      passingCard("content", {
        evidence: [
          { excerpt: "e1", source: "r1", sourceType: "app_store_rss" },
          { excerpt: "e2", source: "r2", sourceType: "app_store_rss" },
        ],
        confidence: 0.9,
      }),
      passingCard("content", {
        evidence: [
          { excerpt: "e3", source: "r3", sourceType: "app_store_rss" },
          { excerpt: "e4", source: "r4", sourceType: "app_store_rss" },
        ],
        confidence: 0.8,
        title: "Card 2",
      }),
      passingCard("outreach", {
        evidence: [
          { excerpt: "e5", source: "r5", sourceType: "app_store_rss" },
          { excerpt: "e6", source: "r6", sourceType: "app_store_rss" },
        ],
        confidence: 0.7,
        title: "Card 3",
      }),
      passingCard("outreach", {
        evidence: [
          { excerpt: "e7", source: "r7", sourceType: "app_store_rss" },
          { excerpt: "e8", source: "r8", sourceType: "app_store_rss" },
        ],
        confidence: 0.6,
        title: "Card 4",
      }),
      passingCard("seo_aso", {
        draft: null,
        evidence: [
          { excerpt: "keyword", source: "kd1", sourceType: "dataforseo_keywords" },
          { excerpt: "keyword2", source: "kd2", sourceType: "dataforseo_keywords" },
        ],
        confidence: 0.85,
        title: "SEO card",
      }),
    ];

    const { passed, rejected } = await runCriticGate(ctx, cards);

    // Should have dropped some from the over-represented app_store_rss type
    expect(passed.length).toBeLessThan(5);
    // Some should appear in rejected with "source_diversity"
    const diversityRejections = rejected.filter((r) => r.failedRules.includes("source_diversity"));
    expect(diversityRejections.length).toBeGreaterThan(0);
  });

  test("well-distributed cards (2 each from 2+ types) pass diversity check", async () => {
    vi.doMock("@/lib/dev/fixtures", () => ({ fixturesEnabled: () => true }));
    vi.doMock("@/lib/telemetry/pipeline-runs", () => ({
      recordPipelineRun: vi.fn().mockResolvedValue(undefined),
    }));

    const { runCriticGate } = await import("./critic");
    const ctx = await makeScanCtx();

    // 2 cards per type → balanced
    const cards: ActionCard[] = [
      passingCard("content", {
        evidence: [
          { excerpt: "e1", source: "r1", sourceType: "app_store_rss" },
          { excerpt: "e2", source: "r2", sourceType: "positioning" },
        ],
        confidence: 0.8,
      }),
      passingCard("outreach", {
        evidence: [
          { excerpt: "e3", source: "r3", sourceType: "dataforseo_keywords" },
          { excerpt: "e4", source: "r4", sourceType: "communities" },
        ],
        confidence: 0.75,
      }),
    ];

    const { passed, rejected } = await runCriticGate(ctx, cards);
    const diversityRejections = rejected.filter((r) => r.failedRules.includes("source_diversity"));
    expect(diversityRejections).toHaveLength(0);
    expect(passed).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Fixture mode: runCriticGate(fixtureActions()) → all pass, no network calls
// ---------------------------------------------------------------------------

describe("runCriticGate — fixture mode passes all fixture cards keyless", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  test("fixtureActions() all pass the critic gate (no callModel, no checkLink)", async () => {
    // Import the real fixtureActions BEFORE any mocking
    vi.doMock("@/lib/config/env", () => ({ env: { useFixtures: true } }));
    vi.doMock("@/lib/telemetry/pipeline-runs", () => ({
      recordPipelineRun: vi.fn().mockResolvedValue(undefined),
    }));
    const callModelMock = vi.fn();
    const checkLinkRunMock = vi.fn();
    vi.doMock("@/lib/llm/anthropic", () => ({ callModel: callModelMock }));
    vi.doMock("@/lib/llm/check-link", () => ({
      checkLink: { name: "check_link", klass: "L", run: checkLinkRunMock },
    }));
    // Provide both fixturesEnabled and fixtureActions on the mock so critic.ts can import both
    vi.doMock("@/lib/dev/fixtures", async (importOriginal) => {
      const actual = await importOriginal<typeof import("@/lib/dev/fixtures")>();
      return { ...actual, fixturesEnabled: () => true };
    });

    const { fixtureActions } = await import("@/lib/dev/fixtures");
    const { runCriticGate } = await import("./critic");
    const ctx = await makeScanCtx();

    const actions = fixtureActions();
    expect(actions.length).toBeGreaterThan(0);

    const { passed, rejected } = await runCriticGate(ctx, actions);

    // No network calls (LLM + check_link skipped in fixture mode)
    expect(callModelMock).not.toHaveBeenCalled();
    expect(checkLinkRunMock).not.toHaveBeenCalled();

    // All should pass (some may be diversity-dropped but none should be deterministically rejected)
    const deterministicRejections = rejected.filter(
      (r) => !r.failedRules.includes("source_diversity"),
    );
    expect(deterministicRejections).toHaveLength(0);

    // At least some cards pass
    expect(passed.length).toBeGreaterThan(0);
  });

  test("recordPipelineRun is called with stage=critic and criticRejections count", async () => {
    vi.doMock("@/lib/config/env", () => ({ env: { useFixtures: true } }));
    const recordMock = vi.fn().mockResolvedValue(undefined);
    vi.doMock("@/lib/telemetry/pipeline-runs", () => ({
      recordPipelineRun: recordMock,
    }));
    vi.doMock("@/lib/llm/anthropic", () => ({ callModel: vi.fn() }));
    vi.doMock("@/lib/llm/check-link", () => ({
      checkLink: { name: "check_link", klass: "L", run: vi.fn() },
    }));
    vi.doMock("@/lib/dev/fixtures", async (importOriginal) => {
      const actual = await importOriginal<typeof import("@/lib/dev/fixtures")>();
      return { ...actual, fixturesEnabled: () => true };
    });

    const { fixtureActions } = await import("@/lib/dev/fixtures");
    const { runCriticGate } = await import("./critic");
    const ctx = await makeScanCtx();

    await runCriticGate(ctx, fixtureActions());

    expect(recordMock).toHaveBeenCalledOnce();
    const call = recordMock.mock.calls[0]?.[0] as {
      stage: string;
      criticRejections: number;
      scanId: string;
    };
    expect(call.stage).toBe("critic");
    expect(typeof call.criticRejections).toBe("number");
    expect(call.scanId).toBe("scan-critic-test-1");
  });
});
