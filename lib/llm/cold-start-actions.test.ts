import { afterEach, describe, expect, test, vi } from "vitest";
import { coldStartActionsFrom, fixtureColdStartActions } from "@/lib/dev/fixtures";
import type { PreliminaryFacts } from "@/lib/scan/types";
import type { ScanContext } from "@/lib/scan/pipeline";

// A minimal Cold Start facts object (web mode, brand-new site).
function coldFacts(overrides: Partial<PreliminaryFacts> = {}): PreliminaryFacts {
  return {
    mode: "web",
    listing: { name: "Nudgi", category: "Productivity", description: "A gentle nudge app" },
    competitors: [{ name: "Habitify", url: "https://habitify.me", source: "dataforseo_serp", rank: 1 }],
    reviewVolume: 0,
    ratingTrend: null,
    webProxy: { score: 1, serpResultCount: 20, phUpvotes: 0, domainAgeYears: 0.1 },
    themes: [{ term: "habit tracking", count: 4 }],
    sourcesUsed: ["site_fetch"],
    coldStart: true,
    ...overrides,
  };
}

const fakeCtx = { scanId: "s", appId: "a", storeUrl: "https://nudgi.app", mode: "web", budget: {} as never } as ScanContext;

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

// ---------------------------------------------------------------------------
// Shared invariants asserted across every Cold Start card.
// ---------------------------------------------------------------------------
function assertColdStartInvariants(cards: ReturnType<typeof fixtureColdStartActions>): void {
  expect(cards.length).toBeGreaterThanOrEqual(6);
  for (const c of cards) {
    expect(c.basis).toBe("probability_based");
    expect(c.confidence).toBeLessThanOrEqual(0.6);
    expect(c.confidence).toBeGreaterThan(0);
    expect(c.draftRequiresEdit).toBe(true);
    // Critic rule 1: ≥2 evidence from ≥2 distinct sourceTypes.
    expect(c.evidence.length).toBeGreaterThanOrEqual(2);
    expect(new Set(c.evidence.map((e) => e.sourceType)).size).toBeGreaterThanOrEqual(2);
    // Critic rule 3/4.
    expect(c.effortMin).toBeGreaterThan(0);
    expect(Number.isNaN(new Date(c.suggestedDeadline).getTime())).toBe(false);
    expect(c.expectedOutcome.scoreComponent.length).toBeGreaterThan(0);
    // Critic rule 5a: content/outreach carry a real draft.
    if (c.category === "content" || c.category === "outreach") {
      expect(c.draft).not.toBeNull();
      expect((c.draft ?? "").trim().length).toBeGreaterThanOrEqual(10);
    }
  }
  // A pivot-suggestion card is present.
  expect(cards.some((c) => /pivot/i.test(c.title) || /pivot/i.test(c.why))).toBe(true);
}

describe("coldStartActionsFrom (shared builder)", () => {
  test("produces a §4.3-compliant queue from a seed", () => {
    const cards = coldStartActionsFrom({
      productName: "Nudgi",
      icp: "people building habits",
      topKeyword: "habit tracker app",
      secondKeyword: "best habit tracker",
      topCompetitor: "Habitify",
      communityA: "r/getdisciplined",
      communityB: "Indie Hackers",
    });
    assertColdStartInvariants(cards);
    // Seed strings flow into the cards.
    expect(cards.some((c) => c.title.includes("Nudgi"))).toBe(true);
    expect(cards.some((c) => c.title.includes("Habitify"))).toBe(true);
  });

  test("evidence source fields are non-URL provenance labels (won't hit the §11 per-surface cap)", () => {
    const cards = coldStartActionsFrom({
      productName: "Nudgi", icp: "x", topKeyword: "y app", secondKeyword: "best y",
      topCompetitor: "Z", communityA: "A", communityB: "B",
    });
    for (const c of cards) {
      for (const ev of c.evidence) {
        expect(/^https?:\/\//i.test(ev.source)).toBe(false);
      }
    }
  });

  test("dominant sourceType distribution keeps the whole set under the diversity rule", () => {
    const cards = coldStartActionsFrom({
      productName: "Nudgi", icp: "x", topKeyword: "y app", secondKeyword: "best y",
      topCompetitor: "Z", communityA: "A", communityB: "B",
    });
    // Replicate enforceSourceDiversity's dominant-type accounting.
    const maxAllowed = Math.max(1, Math.floor(cards.length * 0.3));
    const counts = new Map<string, number>();
    for (const c of cards) {
      const perType = new Map<string, number>();
      for (const ev of c.evidence) perType.set(ev.sourceType, (perType.get(ev.sourceType) ?? 0) + 1);
      let best = ""; let bestN = 0;
      for (const [st, n] of perType) if (n > bestN) { bestN = n; best = st; }
      counts.set(best, (counts.get(best) ?? 0) + 1);
    }
    for (const [, n] of counts) expect(n).toBeLessThanOrEqual(maxAllowed);
  });
});

describe("fixtureColdStartActions", () => {
  test("is §4.3-compliant", () => {
    assertColdStartInvariants(fixtureColdStartActions());
  });
});

describe("generateColdStartActions", () => {
  // Mock only fixturesEnabled (keeps it off the real env parser); keep the real
  // builders so the cards are genuinely the ones the generator produces.
  async function importWith(fixtures: boolean): Promise<typeof import("@/lib/llm/cold-start-actions").generateColdStartActions> {
    vi.resetModules();
    vi.doMock("@/lib/dev/fixtures", async () => {
      const actual = await vi.importActual<typeof import("@/lib/dev/fixtures")>("@/lib/dev/fixtures");
      return { ...actual, fixturesEnabled: () => fixtures };
    });
    const mod = await import("@/lib/llm/cold-start-actions");
    return mod.generateColdStartActions;
  }

  test("returns the fixture set in fixtures mode", async () => {
    const gen = await importWith(true);
    const cards = await gen(fakeCtx, coldFacts());
    assertColdStartInvariants(cards);
    // matches the canned fixture exactly in fixtures mode
    expect(cards).toEqual(fixtureColdStartActions());
  });

  test("live path derives the seed from facts (template-driven, no throw)", async () => {
    const gen = await importWith(false);
    const cards = await gen(fakeCtx, coldFacts());
    assertColdStartInvariants(cards);
    // Derived product name + competitor + intent keyword from facts.
    expect(cards.some((c) => c.title.includes("Nudgi"))).toBe(true);
    expect(cards.some((c) => c.title.includes("Habitify"))).toBe(true);
    // The derived category/intent keyword flows into the cards (now category-based,
    // e.g. "habit tracking tool" / "best habit tracking" — not a forced "… app").
    expect(cards.some((c) => /habit tracking/i.test(JSON.stringify(c)))).toBe(true);
  });

  test("live path degrades safely on empty/degraded facts", async () => {
    const gen = await importWith(false);
    const empty = coldFacts({
      listing: { name: "", category: null, description: null },
      competitors: [],
      themes: [],
    });
    const cards = await gen(fakeCtx, empty);
    assertColdStartInvariants(cards);
  });
});
