/**
 * fallback-actions.test.ts — deterministic action floor (launch-readiness).
 *
 * Regression for the live "0 ranked fixes" bug (bloom.io scan
 * 388982c5-c163-4cc7-bfc9-1cf67fe1197c, nudgi.ai before it): the Critic/§11
 * gates can legitimately drop 100% of generated cards, and the pipeline then
 * persisted a report whose `whatToDoThisWeek` buckets were all empty. The floor
 * derives baseline fixes from the weakest fail/warn signals of the 18-signal
 * registry so a completed scan can never ship an empty action plan while
 * measured signals are failing.
 */

import { describe, it, expect } from "vitest";
import {
  fallbackActionsFromSignals,
  MAX_FALLBACK_ACTIONS,
  opportunityActionsFromSearch,
  MAX_OPPORTUNITY_ACTIONS,
} from "./fallback-actions";
import { SIGNAL_REGISTRY, PILLAR_WEIGHTS } from "./signals";
import { assembleReport } from "./report";
import { redactReportForTier } from "@/lib/billing/entitlements";
import { toResultsProps } from "@/components/report/captured/to-results-props";
import type { ScanSignalRow } from "./compute-signals";
import { CATEGORY_TARGET } from "./search-visibility";
import { discoverabilityScore as unifiedDiscoverability } from "./registry-score";

function row(
  signalKey: string,
  state: ScanSignalRow["state"],
  normalised: number | null,
): ScanSignalRow {
  const def = SIGNAL_REGISTRY.find((s) => s.key === signalKey);
  if (!def) throw new Error(`unknown signal in test: ${signalKey}`);
  return {
    signalKey,
    pillar: def.pillar,
    rawValue: normalised,
    normalised,
    weight: def.weight,
    contribution:
      normalised === null ? null : PILLAR_WEIGHTS[def.pillar] * def.weight * normalised,
    state,
    platform: "web",
  };
}

describe("fallbackActionsFromSignals", () => {
  it("derives actions from fail/warn signals only (pass + unmeasured excluded)", () => {
    const rows = [
      row("schema_jsonld", "fail", 0),
      row("title_tag", "pass", 100),
      row("organic_keywords", "unmeasured", null),
      row("community_presence", "warn", 30),
    ];
    const actions = fallbackActionsFromSignals(rows);
    expect(actions).toHaveLength(2);
    const titles = actions.map((a) => a.title).join(" | ");
    expect(titles).toContain("JSON-LD");
    expect(titles).toContain("threads");
  });

  it("orders by expected score impact (pillar weight × signal weight × shortfall) and caps the set", () => {
    const rows = SIGNAL_REGISTRY.map((def) => row(def.key, "fail", 0));
    const actions = fallbackActionsFromSignals(rows);
    expect(actions).toHaveLength(MAX_FALLBACK_ACTIONS);
    const deltas = actions.map((a) => a.expectedOutcome.delta);
    expect([...deltas].sort((a, b) => b - a)).toEqual(deltas);
    // organic_keywords (seo 0.45 × 0.25 × 100 ≈ 11) must outrank everything.
    expect(actions[0]!.title).toBe(
      SIGNAL_REGISTRY.find((s) => s.key === "organic_keywords")!.howToFix.replace(/\.$/, ""),
    );
  });

  it("every card satisfies the §11 invariants and renders on the results screen (delta > 0)", () => {
    const rows = [row("meta_description", "warn", 60), row("share_of_voice", "fail", 5)];
    for (const a of fallbackActionsFromSignals(rows)) {
      expect(["content", "outreach", "seo_aso"]).toContain(a.category);
      expect(a.title.length).toBeGreaterThan(0);
      expect(a.why.length).toBeGreaterThan(0);
      expect(a.draftRequiresEdit).toBe(true);
      expect(a.basis).toBe("probability_based");
      expect(a.confidence).toBeLessThanOrEqual(0.6);
      expect(a.evidenceIds).toEqual([]);
      expect(a.effortMin).toBeGreaterThan(0);
      expect(Number.isNaN(new Date(a.suggestedDeadline).getTime())).toBe(false);
      // toResultsProps filters `delta > 0` — a zero-delta card would vanish.
      expect(a.expectedOutcome.delta).toBeGreaterThan(0);
      expect(a.expectedOutcome.scoreComponent.length).toBeGreaterThan(0);
      expect(a.draft).toBeNull();
    }
  });

  it("maps pillars to action categories (seo → seo_aso)", () => {
    const actions = fallbackActionsFromSignals([
      row("canonical_url", "fail", 0),
      row("content_depth", "fail", 0),
      row("marketplace_presence", "fail", 0),
    ]);
    const byTitleFragment = (frag: string) =>
      actions.find((a) => a.title.toLowerCase().includes(frag))!;
    expect(byTitleFragment("canonical").category).toBe("seo_aso");
    expect(byTitleFragment("500 words").category).toBe("content");
    expect(byTitleFragment("marketplace").category).toBe("outreach");
  });

  it("returns [] when nothing is failing (healthy scan) or no rows measured", () => {
    expect(fallbackActionsFromSignals([])).toEqual([]);
    expect(fallbackActionsFromSignals([row("title_tag", "pass", 100)])).toEqual([]);
    expect(fallbackActionsFromSignals([row("press_mentions", "unmeasured", null)])).toEqual([]);
  });

  it("floored report renders ranked fixes end-to-end (assemble → free redaction → results mapper)", () => {
    // The bloom.io scenario: critic gate emptied the plan, scan scored 42.
    // With the floor, the persisted report and BOTH viewer tiers must show fixes.
    const rows = [
      row("organic_keywords", "fail", 10),
      row("schema_jsonld", "fail", 0),
      row("community_presence", "warn", 30),
      row("content_depth", "warn", 45),
    ];
    const floored = fallbackActionsFromSignals(rows);
    const payload = assembleReport({
      mode: "web",
      generatedAt: "2026-07-03T00:00:00.000Z",
      positioningMirror: { listingSays: "Photo tools, for creators", reviewsValue: "fast galleries", gap: "gap" },
      findings: [],
      icpSignals: [],
      surfaces: [],
      competitorGap: [],
      actions: floored,
      score: { total: 42, breakdown: { content: 40, outreach: 30, seo: 50 }, radar: [], basis: "verified" },
    });

    const buckets = payload.whatToDoThisWeek;
    const total = buckets.quickWins.length + buckets.medium.length + buckets.longPlay.length;
    expect(total).toBe(4);

    for (const tier of ["free", "solo"] as const) {
      const p = toResultsProps(redactReportForTier(payload, tier), "bloom.io", total);
      expect(p.fixes.length).toBeGreaterThan(0);
      // The section header maths can never read "0 of 0" again.
      expect(p.fixes.length + p.lockedCount).toBe(total);
    }
  });

  it("is deterministic for a fixed `now`", () => {
    const rows = [row("heading_structure", "fail", 0), row("owned_channels", "warn", 40)];
    const now = new Date("2026-07-03T00:00:00Z");
    expect(fallbackActionsFromSignals(rows, now)).toEqual(fallbackActionsFromSignals(rows, now));
    expect(fallbackActionsFromSignals(rows, now)[0]!.suggestedDeadline).toBe("2026-07-17");
  });
});

describe("opportunityActionsFromSearch (WS-C)", () => {
  const sv = {
    score: 0,
    onPageReadiness: 89,
    categoryOpportunities: [
      { keyword: "rank tracking software", volume: 1600, yourPosition: undefined },
      { keyword: "competitor analysis tools", volume: 1300, yourPosition: 12 },
      { keyword: "seo analytics software", volume: 260, yourPosition: undefined },
    ],
  };

  it("emits ≤ MAX_OPPORTUNITY_ACTIONS cards, each naming the REAL phrase + real standing", () => {
    const cards = opportunityActionsFromSearch(sv, new Date("2026-07-19"));
    expect(cards).toHaveLength(MAX_OPPORTUNITY_ACTIONS);
    expect(cards[0]!.title).toContain('"rank tracking software"');
    expect(cards[0]!.why).toContain("1,600");
    expect(cards[1]!.why).toContain("#12");
    for (const c of cards) {
      expect(c.draft).toBeNull();
      expect(c.draftRequiresEdit).toBe(true);
      expect(c.basis).toBe("probability_based");
    }
  });

  it("delta is the score-model recomputation (one category win = one CATEGORY_TARGET step), never a free-chosen number (5a)", () => {
    const [card] = opportunityActionsFromSearch(sv, new Date("2026-07-19"));
    const expected = Math.max(
      1,
      Math.round(
        unifiedDiscoverability(89, Math.min(100, 0 + 100 / CATEGORY_TARGET)) -
          unifiedDiscoverability(89, Math.max(1, 0)),
      ),
    );
    expect(card!.expectedOutcome.delta).toBe(expected);
  });

  it("no opportunities → no cards (degrade, never invent)", () => {
    expect(opportunityActionsFromSearch({ score: 50, onPageReadiness: 80, categoryOpportunities: [] })).toEqual([]);
  });
});
