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
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { ContentPlanItem } from "./synthesize";
import { installFixtures, resetFixtures } from "@/lib/scan/fixture-seam";
import { makeFixtureProvider } from "@/lib/dev/fixtures";

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

afterEach(() => resetFixtures());

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
    installFixtures(makeFixtureProvider());
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
    // A specific, cliché-free draft — the §11 scrub leaves it unchanged.
    const specific =
      "# Picking a habit tracker that sticks\n\nMost people quit their tracker by day 12. " +
      "The fix is fewer taps: a one-tap check-in beats a dashboard you have to configure.";
    const callModel = vi.fn().mockResolvedValue({
      text: specific,
      usage: { inputTokens: 10, outputTokens: 20 },
      stopReason: "end_turn",
    });
    vi.doMock("@/lib/llm/anthropic", () => ({ callModel }));

    const { generateContentDraft } = await import("./content-draft");
    const draft = await generateContentDraft(item());

    expect(draft.requiresEdit).toBe(true);
    expect(draft.markdown).toBe(specific.trim());
    expect(callModel).toHaveBeenCalledTimes(1);
  });

  test("a max_tokens cut-off is continued and stitched — never shipped truncated", async () => {
    const part1 = "# Email deliverability\n\nMajor ISPs offer feedback loops (F";
    const part2 = "BLs) that report spam complaints back to you. Register for each one.";
    const callModel = vi
      .fn()
      .mockResolvedValueOnce({ text: part1, usage: { inputTokens: 10, outputTokens: 20 }, stopReason: "max_tokens" })
      .mockResolvedValueOnce({ text: part2, usage: { inputTokens: 10, outputTokens: 20 }, stopReason: "end_turn" });
    vi.doMock("@/lib/llm/anthropic", () => ({ callModel }));

    const { generateContentDraft } = await import("./content-draft");
    const draft = await generateContentDraft(item());

    expect(callModel).toHaveBeenCalledTimes(2);
    expect(draft.markdown).toBe(part1 + part2);
    // The continuation prompt anchors on the tail of the cut-off text.
    const contPrompt = (callModel.mock.calls[1]![0] as { prompt: string }).prompt;
    expect(contPrompt).toContain("feedback loops (F");
    expect(contPrompt).toContain("Continue EXACTLY");
  });

  test("continuation stops after the safety cap even if the model keeps hitting max_tokens", async () => {
    const callModel = vi.fn().mockResolvedValue({
      text: "chunk. This is specific prose about SPF records and DNS lookups.",
      usage: { inputTokens: 10, outputTokens: 20 },
      stopReason: "max_tokens",
    });
    vi.doMock("@/lib/llm/anthropic", () => ({ callModel }));

    const { generateContentDraft } = await import("./content-draft");
    await generateContentDraft(item());
    // 1 initial + at most 2 continuations.
    expect(callModel).toHaveBeenCalledTimes(3);
  });
});

describe("scrubGenericTells — truncation guard", () => {
  test("a truncated rewrite never replaces the draft", async () => {
    // Cliché-laden long draft (≥2 tells → rewrite path taken).
    const original =
      "In today's fast-paced world, our seamless solution is a game-changer. " +
      "Leverage it to unlock effortless growth. ".repeat(20);
    // The rewrite comes back CUT OFF (max_tokens) — must be rejected.
    const callModel = vi.fn().mockResolvedValue({
      text: "A short truncated rewri",
      usage: { inputTokens: 10, outputTokens: 20 },
      stopReason: "max_tokens",
    });
    vi.doMock("@/lib/llm/anthropic", () => ({ callModel }));
    vi.doMock("@/lib/llm/embed", () => ({ callEmbed: vi.fn() }));
    vi.doMock("@/lib/scan/embeddings", () => ({
      insertEmbeddings: vi.fn(), deleteEmbeddingsForApp: vi.fn(), searchSimilar: vi.fn(),
    }));

    const { scrubGenericTells } = await import("@/lib/scan/algorithm-safety");
    const result = await scrubGenericTells(original);
    expect(result).toBe(original);
  });

  test("rewrite token budget scales with the draft size", async () => {
    const original =
      "In today's fast-paced world, leverage our seamless game-changer platform. ".repeat(400); // ~29k chars
    const callModel = vi.fn().mockResolvedValue({
      text: original.replace(/leverage|seamless|game-changer/gi, "specific"),
      usage: { inputTokens: 10, outputTokens: 20 },
      stopReason: "end_turn",
    });
    vi.doMock("@/lib/llm/anthropic", () => ({ callModel }));
    vi.doMock("@/lib/llm/embed", () => ({ callEmbed: vi.fn() }));
    vi.doMock("@/lib/scan/embeddings", () => ({
      insertEmbeddings: vi.fn(), deleteEmbeddingsForApp: vi.fn(), searchSimilar: vi.fn(),
    }));

    const { scrubGenericTells } = await import("@/lib/scan/algorithm-safety");
    await scrubGenericTells(original);
    const args = callModel.mock.calls[0]![0] as { maxTokens: number };
    // ~29k chars / 3 + headroom ≫ the old fixed 1024 cap.
    expect(args.maxTokens).toBeGreaterThan(9000);
    expect(args.maxTokens).toBeLessThanOrEqual(16000);
  });
});
