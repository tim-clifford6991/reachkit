/**
 * track_rank tool tests (TDD)
 * - fixture mode: returns a DETERMINISTIC non-empty ranks map for the given keywords
 *   (delegates to rankLookup, which uses fixtureRankMap when fixturesEnabled())
 * - charges the budget once (1 toolCall, 0 cents)
 * - tool metadata: name=track_rank, klass=D
 */
import { beforeEach, expect, test, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// Fixture mode — deterministic, non-empty ranks map, no network
// ---------------------------------------------------------------------------

test("track_rank returns a deterministic non-empty ranks map for the given keywords (fixtures)", async () => {
  vi.doMock("@/lib/config/env", () => ({ env: { useFixtures: true } }));
  // fetch must never be hit in fixtures mode
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);

  const keywords = ["habit tracker app", "daily habit tracker", "best habit tracker"];
  const target = "habitkit.com";

  const { trackRank } = await import("./track-rank");
  const { ScanBudget } = await import("@/lib/tools/registry");
  const budget = new ScanBudget({ maxToolCalls: 60, budgetCents: 150 });

  const out = await trackRank.run({ keywords, target }, { scanId: "s1", mode: "web", budget });

  // Non-empty: every distinct keyword gets a position
  expect(Object.keys(out.ranks).sort()).toEqual([...keywords].sort());
  for (const k of keywords) {
    const pos = out.ranks[k];
    expect(typeof pos).toBe("number");
    expect(pos).toBeGreaterThanOrEqual(1);
    expect(pos).toBeLessThanOrEqual(50);
  }
  expect(fetchMock).not.toHaveBeenCalled();

  // Deterministic: a second run with the same inputs yields an identical map
  vi.resetModules();
  vi.doMock("@/lib/config/env", () => ({ env: { useFixtures: true } }));
  const { trackRank: trackRank2 } = await import("./track-rank");
  const budget2 = new ScanBudget({ maxToolCalls: 60, budgetCents: 150 });
  const out2 = await trackRank2.run({ keywords, target }, { scanId: "s2", mode: "web", budget: budget2 });
  expect(out2.ranks).toEqual(out.ranks);
});

// ---------------------------------------------------------------------------
// Budget — charged exactly once
// ---------------------------------------------------------------------------

test("track_rank charges 1 tool call and 0 cents", async () => {
  vi.doMock("@/lib/config/env", () => ({ env: { useFixtures: true } }));

  const { trackRank } = await import("./track-rank");
  const { ScanBudget } = await import("@/lib/tools/registry");
  const budget = new ScanBudget({ maxToolCalls: 60, budgetCents: 150 });

  await trackRank.run(
    { keywords: ["habit tracker app"], target: "habitkit.com" },
    { scanId: "s3", mode: "web", budget },
  );

  expect(budget.callsMade).toBe(1);
  expect(budget.spentCents).toBe(0);
});

// ---------------------------------------------------------------------------
// Delegation — passes keywords/target straight to rankLookup, returns its map
// ---------------------------------------------------------------------------

test("track_rank returns whatever rankLookup yields", async () => {
  const rankLookup = vi.fn(
    async (_keywords: string[], _target: string): Promise<Record<string, number>> => ({
      "habit tracker app": 4,
      "best habit tracker": 17,
    }),
  );
  vi.doMock("@/lib/scan/adapters/dataforseo-rank", () => ({ rankLookup }));

  const { trackRank } = await import("./track-rank");
  const { ScanBudget } = await import("@/lib/tools/registry");
  const budget = new ScanBudget({ maxToolCalls: 60, budgetCents: 150 });

  const out = await trackRank.run(
    { keywords: ["habit tracker app", "best habit tracker"], target: "habitkit.com" },
    { scanId: "s4", mode: "web", budget },
  );

  expect(rankLookup).toHaveBeenCalledOnce();
  expect(rankLookup.mock.calls[0]?.[0]).toEqual(["habit tracker app", "best habit tracker"]);
  expect(rankLookup.mock.calls[0]?.[1]).toBe("habitkit.com");
  expect(out.ranks).toEqual({ "habit tracker app": 4, "best habit tracker": 17 });
});

// ---------------------------------------------------------------------------
// Tool metadata
// ---------------------------------------------------------------------------

test("track_rank has name=track_rank and klass=D", async () => {
  vi.doMock("@/lib/config/env", () => ({ env: { useFixtures: true } }));
  const { trackRank } = await import("./track-rank");
  expect(trackRank.name).toBe("track_rank");
  expect(trackRank.klass).toBe("D");
});
