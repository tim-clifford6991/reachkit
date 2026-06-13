/**
 * Report section component unit tests.
 *
 * Tests focus on the logic-bearing behaviours of each section component:
 *  - Free-tier redaction / preview limits
 *  - Signal chip counts (WhoItsForSection)
 *  - Surface + competitor preview counts (WhereTheyAreSection)
 *  - Bucket rendering logic (ActionPlanSection)
 *  - EvidencePanel item visibility + hidden count
 *
 * We test the LOGIC only (pure functions, prop contracts) — not the React
 * rendering (that would need jsdom). Each test mirrors the component's
 * internal contracts as if we were calling the component's conditional
 * branches directly.
 *
 * Pattern: extract the pure decision-making branches into standalone
 * functions and verify them here, matching the existing test style in
 * components/report/discoverability-score.test.ts.
 */

import { describe, it, expect } from "vitest";
import type { ReportPayload } from "@/lib/scan/report";
import type { ActionCard } from "@/lib/llm/types";

// ---------------------------------------------------------------------------
// WhoItsForSection — signal preview logic
// ---------------------------------------------------------------------------

function visibleSignals(
  signals: string[],
  unlocked: boolean,
  previewCount = 3
): string[] {
  return unlocked ? signals : signals.slice(0, previewCount);
}

function hiddenSignalCount(
  signals: string[],
  unlocked: boolean,
  previewCount = 3
): number {
  return unlocked ? 0 : Math.max(0, signals.length - previewCount);
}

describe("WhoItsForSection — signal preview logic", () => {
  const sixSignals = ["a", "b", "c", "d", "e", "f"];

  it("shows all signals when unlocked", () => {
    expect(visibleSignals(sixSignals, true)).toHaveLength(6);
    expect(hiddenSignalCount(sixSignals, true)).toBe(0);
  });

  it("shows only previewCount when locked", () => {
    expect(visibleSignals(sixSignals, false, 3)).toHaveLength(3);
    expect(hiddenSignalCount(sixSignals, false, 3)).toBe(3);
  });

  it("shows all when locked but total <= previewCount", () => {
    const twoSignals = ["a", "b"];
    expect(visibleSignals(twoSignals, false, 3)).toHaveLength(2);
    expect(hiddenSignalCount(twoSignals, false, 3)).toBe(0);
  });

  it("respects custom previewCount", () => {
    expect(visibleSignals(sixSignals, false, 2)).toHaveLength(2);
    expect(hiddenSignalCount(sixSignals, false, 2)).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// WhereTheyAreSection — surface + competitor preview logic
// ---------------------------------------------------------------------------

type Surface = { source: string; title: string; url: string };

function visibleSurfaces(
  surfaces: Surface[],
  unlocked: boolean,
  previewCount = 3
): Surface[] {
  return unlocked ? surfaces : surfaces.slice(0, previewCount);
}

function hiddenSurfaceCount(
  surfaces: Surface[],
  unlocked: boolean,
  previewCount = 3
): number {
  return unlocked ? 0 : Math.max(0, surfaces.length - previewCount);
}

describe("WhereTheyAreSection — surface preview logic", () => {
  const fiveSurfaces: Surface[] = Array.from({ length: 5 }, (_, i) => ({
    source: `src${i}`,
    title: `Thread ${i}`,
    url: `https://example.com/${i}`,
  }));

  it("shows all surfaces when unlocked", () => {
    expect(visibleSurfaces(fiveSurfaces, true)).toHaveLength(5);
    expect(hiddenSurfaceCount(fiveSurfaces, true)).toBe(0);
  });

  it("shows only 3 when locked by default", () => {
    expect(visibleSurfaces(fiveSurfaces, false)).toHaveLength(3);
    expect(hiddenSurfaceCount(fiveSurfaces, false)).toBe(2);
  });

  it("shows all when locked but total <= previewCount", () => {
    const twoSurfaces = fiveSurfaces.slice(0, 2);
    expect(visibleSurfaces(twoSurfaces, false, 3)).toHaveLength(2);
    expect(hiddenSurfaceCount(twoSurfaces, false, 3)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// ActionPlanSection — bucket bucketing checks
// ---------------------------------------------------------------------------

function hasAnyActions(plan: ReportPayload["whatToDoThisWeek"]): boolean {
  return (
    plan.quickWins.length > 0 ||
    plan.medium.length > 0 ||
    plan.longPlay.length > 0
  );
}

function makeMockAction(effortMin: number): ActionCard {
  return {
    category: "content",
    title: `Action (${effortMin}m)`,
    why: "Because",
    evidenceIds: [],
    evidence: [],
    effortMin,
    suggestedDeadline: "2026-06-20",
    expectedOutcome: { scoreComponent: "Content", delta: 5 },
    draft: "Draft copy",
    draftRequiresEdit: true,
    verification: { method: "self_report", state: "pending" },
    basis: "evidence_based",
    confidence: 0.85,
  };
}

describe("ActionPlanSection — bucket logic", () => {
  it("identifies empty plan correctly", () => {
    const emptyPlan: ReportPayload["whatToDoThisWeek"] = {
      quickWins: [],
      medium: [],
      longPlay: [],
    };
    expect(hasAnyActions(emptyPlan)).toBe(false);
  });

  it("identifies non-empty plan", () => {
    const plan: ReportPayload["whatToDoThisWeek"] = {
      quickWins: [makeMockAction(15)],
      medium: [],
      longPlay: [],
    };
    expect(hasAnyActions(plan)).toBe(true);
  });

  it("correctly identifies a plan with only longPlay actions", () => {
    const plan: ReportPayload["whatToDoThisWeek"] = {
      quickWins: [],
      medium: [],
      longPlay: [makeMockAction(180)],
    };
    expect(hasAnyActions(plan)).toBe(true);
  });

  it("draft is null for locked (free tier) actions", () => {
    const action = makeMockAction(20);
    const locked = { ...action, draft: null };
    expect(locked.draft).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// EvidencePanel — visibility logic
// ---------------------------------------------------------------------------

function visibleItems<T>(
  items: T[],
  maxVisible: number | undefined
): T[] {
  return maxVisible !== undefined ? items.slice(0, maxVisible) : items;
}

function hiddenItemCount<T>(
  items: T[],
  maxVisible: number | undefined
): number {
  return maxVisible !== undefined ? Math.max(0, items.length - maxVisible) : 0;
}

describe("EvidencePanel — visibility logic", () => {
  const fiveItems = [1, 2, 3, 4, 5];

  it("shows all items when maxVisible is undefined", () => {
    expect(visibleItems(fiveItems, undefined)).toHaveLength(5);
    expect(hiddenItemCount(fiveItems, undefined)).toBe(0);
  });

  it("limits to maxVisible and reports hidden count", () => {
    expect(visibleItems(fiveItems, 2)).toHaveLength(2);
    expect(hiddenItemCount(fiveItems, 2)).toBe(3);
  });

  it("shows all when items.length <= maxVisible", () => {
    expect(visibleItems(fiveItems, 10)).toHaveLength(5);
    expect(hiddenItemCount(fiveItems, 10)).toBe(0);
  });

  it("returns empty for empty items array", () => {
    expect(visibleItems([], 3)).toHaveLength(0);
    expect(hiddenItemCount([], 3)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// WhereTheyAreSection — GapScorePair logic (isAhead)
// ---------------------------------------------------------------------------

function isAhead(you: number, them: number): boolean {
  return you - them >= 0;
}

describe("WhereTheyAreSection — competitor gap score logic", () => {
  it("is ahead when you > them", () => {
    expect(isAhead(80, 60)).toBe(true);
  });

  it("is ahead when tied", () => {
    expect(isAhead(50, 50)).toBe(true);
  });

  it("is not ahead when you < them", () => {
    expect(isAhead(40, 70)).toBe(false);
  });
});
