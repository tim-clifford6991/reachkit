/**
 * Tests for §9.5 bounded agentic loops.
 * TDD: tests written before implementation.
 */
import { describe, expect, test, vi, beforeEach } from "vitest";
import { boundedLoop, weakestQuestion, competitorDiscoveryLoop } from "./loops";
import { ScanBudget } from "@/lib/tools/registry";
import type { ScanContext } from "@/lib/scan/pipeline";

// Top-level mocks (hoisted by Vitest)
vi.mock("@/lib/scan/tools/find-competitors", () => ({
  findCompetitors: {
    name: "find_competitors",
    klass: "D",
    run: vi.fn(),
  },
}));

vi.mock("@/lib/llm/embed", () => ({
  callEmbed: vi.fn(),
}));

vi.mock("@/lib/scan/embeddings", () => ({
  searchSimilar: vi.fn(),
}));

// ---------------------------------------------------------------------------
// boundedLoop — stop-rule: maxRounds
// ---------------------------------------------------------------------------
describe("boundedLoop — maxRounds stop-rule", () => {
  test("stops after maxRounds even if each round finds new items", async () => {
    const budget = new ScanBudget({ maxToolCalls: 100, budgetCents: 10_000 });
    let roundCount = 0;

    const result = await boundedLoop<string>(
      { maxRounds: 3, budget, key: (s) => s },
      async (_acc) => {
        roundCount++;
        // Each round yields one completely new item
        return [`item-${roundCount}`];
      },
    );

    expect(roundCount).toBe(3);
    expect(result).toHaveLength(3);
    expect(result).toContain("item-1");
    expect(result).toContain("item-2");
    expect(result).toContain("item-3");
  });
});

// ---------------------------------------------------------------------------
// boundedLoop — stop-rule: no-novelty (diminishing returns)
// ---------------------------------------------------------------------------
describe("boundedLoop — no-novelty stop-rule", () => {
  test("stops early when a round adds NO new item, before maxRounds", async () => {
    const budget = new ScanBudget({ maxToolCalls: 100, budgetCents: 10_000 });
    let roundCount = 0;
    const FIXED_ITEMS = ["a", "b", "c"];

    const result = await boundedLoop<string>(
      { maxRounds: 10, budget, key: (s) => s },
      async () => {
        roundCount++;
        // Always returns same items — second round adds nothing new
        return FIXED_ITEMS;
      },
    );

    // First round: 3 new items. Second round: 0 new items → stop.
    expect(roundCount).toBe(2);
    expect(result).toEqual(FIXED_ITEMS);
  });

  test("stops at round 1 if the very first round returns empty", async () => {
    const budget = new ScanBudget({ maxToolCalls: 100, budgetCents: 10_000 });
    let roundCount = 0;

    const result = await boundedLoop<string>(
      { maxRounds: 5, budget, key: (s) => s },
      async () => {
        roundCount++;
        return [];
      },
    );

    expect(roundCount).toBe(1);
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// boundedLoop — stop-rule: callCeiling
// ---------------------------------------------------------------------------
describe("boundedLoop — callCeiling stop-rule", () => {
  test("stops when budget.callsMade >= callCeiling before maxRounds", async () => {
    const budget = new ScanBudget({ maxToolCalls: 200, budgetCents: 10_000 });
    let roundCount = 0;

    const result = await boundedLoop<string>(
      { maxRounds: 10, budget, callCeiling: 3, key: (s) => s },
      async (_acc) => {
        roundCount++;
        // Each round charges 2 tool calls and returns one new item
        budget.charge({ toolCalls: 2, cents: 0 });
        return [`item-${roundCount}`];
      },
    );

    // Round 1: callsMade becomes 2 → not >= 3, continue.
    // Round 2: after round callsMade becomes 4 >= 3 → loop stops.
    // We stop checking BEFORE executing the next round, so roundCount <= 3.
    expect(roundCount).toBeLessThan(10);
    expect(result.length).toBe(roundCount);
  });

  test("stops immediately if budget.callsMade already >= callCeiling before first round", async () => {
    const budget = new ScanBudget({ maxToolCalls: 200, budgetCents: 10_000 });
    budget.charge({ toolCalls: 5, cents: 0 }); // pre-spend
    let roundCount = 0;

    const result = await boundedLoop<string>(
      { maxRounds: 5, budget, callCeiling: 3, key: (s) => s },
      async () => {
        roundCount++;
        return ["item"];
      },
    );

    expect(roundCount).toBe(0);
    expect(result).toHaveLength(0);
  });

  test("stops on BudgetExceededError from round, returns accumulated items without throwing", async () => {
    const budget = new ScanBudget({ maxToolCalls: 3, budgetCents: 10_000 });
    let roundCount = 0;

    const result = await boundedLoop<string>(
      { maxRounds: 10, budget, key: (s) => s },
      async (_acc) => {
        roundCount++;
        if (roundCount === 1) {
          budget.charge({ toolCalls: 2, cents: 0 });
          return ["item-1", "item-2"];
        }
        // Round 2 triggers BudgetExceededError (maxToolCalls is 3, already at 2, charging 5)
        budget.charge({ toolCalls: 5, cents: 0 }); // exceeds maxToolCalls: 3
        return ["item-3"];
      },
    );

    expect(roundCount).toBe(2);
    // Must not throw — returns items from round 1
    expect(result).toContain("item-1");
    expect(result).toContain("item-2");
    expect(result).not.toContain("item-3");
  });
});

// ---------------------------------------------------------------------------
// boundedLoop — de-duplication by key
// ---------------------------------------------------------------------------
describe("boundedLoop — de-duplication by key", () => {
  test("de-dupes items with same key across rounds", async () => {
    const budget = new ScanBudget({ maxToolCalls: 100, budgetCents: 10_000 });
    let roundCount = 0;

    const result = await boundedLoop<{ id: string; value: number }>(
      { maxRounds: 5, budget, key: (item) => item.id },
      async () => {
        roundCount++;
        if (roundCount === 1) return [{ id: "a", value: 1 }, { id: "b", value: 2 }];
        if (roundCount === 2) return [{ id: "b", value: 99 }, { id: "c", value: 3 }]; // "b" is duplicate
        // Round 3 returns no new items → stops
        return [{ id: "a", value: 0 }, { id: "b", value: 0 }, { id: "c", value: 0 }];
      },
    );

    // "a", "b" (first seen), "c" — no duplicate "b"
    const ids = result.map((i) => i.id);
    expect(ids).toContain("a");
    expect(ids).toContain("b");
    expect(ids).toContain("c");
    expect(ids.filter((id) => id === "b")).toHaveLength(1);
    // Original value of "b" preserved (first-seen wins)
    expect(result.find((i) => i.id === "b")?.value).toBe(2);
  });

  test("de-dupes within a single round result", async () => {
    const budget = new ScanBudget({ maxToolCalls: 100, budgetCents: 10_000 });

    const result = await boundedLoop<string>(
      { maxRounds: 1, budget, key: (s) => s },
      async () => ["x", "x", "y"],
    );

    expect(result.filter((s) => s === "x")).toHaveLength(1);
    expect(result).toContain("y");
  });
});

// ---------------------------------------------------------------------------
// weakestQuestion — pure coverage helper
// ---------------------------------------------------------------------------
describe("weakestQuestion", () => {
  test("returns the key with the lowest coverage score", () => {
    expect(weakestQuestion({
      whatYouOffer: 80,
      whoItsFor: 60,
      whereTheyAre: 40,
      whatToDo: 55,
    })).toBe("whereTheyAre");
  });

  test("handles all equal scores — returns a valid key", () => {
    const result = weakestQuestion({
      whatYouOffer: 50,
      whoItsFor: 50,
      whereTheyAre: 50,
      whatToDo: 50,
    });
    expect(["whatYouOffer", "whoItsFor", "whereTheyAre", "whatToDo"]).toContain(result);
  });

  test("handles zero coverage", () => {
    expect(weakestQuestion({
      whatYouOffer: 100,
      whoItsFor: 0,
      whereTheyAre: 50,
      whatToDo: 75,
    })).toBe("whoItsFor");
  });

  test("picks first key when multiple share minimum", () => {
    // Both whatYouOffer and whoItsFor are 10 — function should return one of them consistently
    const result = weakestQuestion({
      whatYouOffer: 10,
      whoItsFor: 10,
      whereTheyAre: 80,
      whatToDo: 90,
    });
    expect(["whatYouOffer", "whoItsFor"]).toContain(result);
  });
});

// ---------------------------------------------------------------------------
// competitorDiscoveryLoop — mocked integration
// ---------------------------------------------------------------------------
describe("competitorDiscoveryLoop — mocked integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("converges and returns ranked competitors", async () => {
    const { findCompetitors } = await import("@/lib/scan/tools/find-competitors");
    const { callEmbed } = await import("@/lib/llm/embed");
    const { searchSimilar } = await import("@/lib/scan/embeddings");

    vi.mocked(findCompetitors.run).mockResolvedValue({
      competitors: [
        { name: "Habitify", url: "https://habitify.me", source: "dataforseo_serp", rank: 1 },
        { name: "Streaks",  url: "https://streaksapp.com", source: "dataforseo_serp", rank: 2 },
      ],
      extras: {},
    });
    vi.mocked(callEmbed).mockResolvedValue([[0.1, 0.2, 0.3]]);
    vi.mocked(searchSimilar).mockResolvedValue([]);

    const budget = new ScanBudget({ maxToolCalls: 100, budgetCents: 10_000 });
    const ctx: ScanContext = {
      scanId: "test-scan",
      appId: "test-app",
      storeUrl: "https://habitkit.app",
      mode: "web",
      budget,
    };

    const result = await competitorDiscoveryLoop(ctx, "HabitKit", "https://habitkit.app", []);

    expect(Array.isArray(result)).toBe(true);
    // All results should be Competitor objects with required fields
    for (const c of result) {
      expect(c).toHaveProperty("name");
      expect(c).toHaveProperty("url");
      expect(c).toHaveProperty("source");
      expect(c).toHaveProperty("rank");
    }
  });

  test("stops early when a round adds no new competitors — no-novelty convergence", async () => {
    const { findCompetitors } = await import("@/lib/scan/tools/find-competitors");
    const { callEmbed } = await import("@/lib/llm/embed");
    const { searchSimilar } = await import("@/lib/scan/embeddings");

    // Always returns the same competitor — second round adds nothing new
    vi.mocked(findCompetitors.run).mockResolvedValue({
      competitors: [
        { name: "Habitify", url: "https://habitify.me", source: "dataforseo_serp", rank: 1 },
      ],
      extras: {},
    });
    vi.mocked(callEmbed).mockResolvedValue([[0.1, 0.2, 0.3]]);
    vi.mocked(searchSimilar).mockResolvedValue([]);

    const budget = new ScanBudget({ maxToolCalls: 100, budgetCents: 10_000 });
    const ctx: ScanContext = {
      scanId: "test-scan",
      appId: "test-app",
      storeUrl: "https://habitkit.app",
      mode: "web",
      budget,
    };

    const result = await competitorDiscoveryLoop(ctx, "HabitKit", "https://habitkit.app", []);

    // Should converge: first round finds Habitify, second round finds same Habitify (no novelty) → stops
    expect(Array.isArray(result)).toBe(true);
    const hosts = result.map((c) => new URL(c.url.includes("://") ? c.url : `https://${c.url}`).hostname.replace(/^www\./, ""));
    const uniqueHosts = new Set(hosts);
    expect(uniqueHosts.size).toBe(hosts.length); // de-duped result

    // findCompetitors.run should have been called twice (round 1 adds novelty, round 2 doesn't)
    expect(vi.mocked(findCompetitors.run).mock.calls.length).toBe(2);
  });
});
