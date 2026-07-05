/**
 * content-draft.test.ts — the Phase 1 content draft engine.
 *
 * Coverage:
 *   - buildContentDraftPrompt: pure, includes topic/keywords/depth + the
 *     "first draft the founder will edit" rule (No-auto).
 *   - generateContentDraft (fixtures): returns a labelled stub, requiresEdit true,
 *     no paid call.
 *   - generateContentDraft (live): returns the §11-scrubbed draft, always
 *     requiresEdit true.
 */
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { ContentPlanItem } from "./synthesize";

function item(overrides: Partial<ContentPlanItem> = {}): ContentPlanItem {
  return {
    topic: "How to pick a habit tracker that sticks",
    targetKeywords: ["best habit tracker", "habit tracker app"],
    estMonthlyVolume: 8100,
    intent: "informational",
    format: "guide",
    depthTarget: "1,500–2,500 words",
    buyerAngle: "For people who abandoned three apps already",
    competitorExemplars: [],
    brief: "Cover streaks, friction, and why most trackers fail by week two.",
    agentPrompt: "Write a practical guide grounded in retention data.",
    priority: "high",
    evidence: "keyword gap: best habit tracker (8100/mo)",
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetModules();
});

describe("buildContentDraftPrompt", () => {
  test("includes topic, keywords, depth and the edit-before-publish rule", async () => {
    const { buildContentDraftPrompt } = await import("./content-draft");
    const prompt = buildContentDraftPrompt(item());
    expect(prompt).toContain("How to pick a habit tracker that sticks");
    expect(prompt).toContain("best habit tracker");
    expect(prompt).toContain("1,500–2,500 words");
    expect(prompt.toLowerCase()).toContain("first draft");
    expect(prompt.toLowerCase()).toContain("do not keyword-stuff".toLowerCase());
  });
});

describe("generateContentDraft — fixtures mode", () => {
  test("returns a labelled stub, requiresEdit true, no paid call", async () => {
    vi.doMock("@/lib/dev/fixtures", () => ({ fixturesEnabled: () => true }));
    const callModel = vi.fn();
    vi.doMock("@/lib/llm/anthropic", () => ({ callModel }));

    const { generateContentDraft } = await import("./content-draft");
    const draft = await generateContentDraft(item());

    expect(draft.requiresEdit).toBe(true);
    expect(draft.markdown).toContain("How to pick a habit tracker that sticks");
    expect(callModel).not.toHaveBeenCalled();
  });
});

describe("generateContentDraft — live mode", () => {
  test("returns the scrubbed draft, always requiresEdit true", async () => {
    vi.doMock("@/lib/dev/fixtures", () => ({ fixturesEnabled: () => false }));
    // A specific, cliché-free draft — the §11 scrub leaves it unchanged.
    const specific =
      "# Picking a habit tracker that sticks\n\nMost people quit their tracker by day 12. " +
      "The fix is fewer taps: a one-tap check-in beats a dashboard you have to configure.";
    const callModel = vi.fn().mockResolvedValue({
      text: specific,
      usage: { inputTokens: 10, outputTokens: 20 },
    });
    vi.doMock("@/lib/llm/anthropic", () => ({ callModel }));

    const { generateContentDraft } = await import("./content-draft");
    const draft = await generateContentDraft(item());

    expect(draft.requiresEdit).toBe(true);
    expect(draft.markdown).toBe(specific.trim());
    expect(callModel).toHaveBeenCalledTimes(1);
  });
});
