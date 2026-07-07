/**
 * action-linking.test.ts — signal linkage + the action floor (launch-readiness A1).
 *
 * Regression for the live "thin paid plan" bug (trustmrr.com scan cc5c1aad):
 * the critic survived only 2 cards, both with empty signalKeys, so the upgrade
 * wall advertised "Unlock all 2 fixes" with nothing behind it and score-delta
 * attribution had no signal to attribute to. linkSignalKeys + topUpActions
 * guarantee every card links to the registry and the plan is never thin.
 */

import { describe, it, expect } from "vitest";
import { linkSignalKeys, topUpActions, MIN_ACTIONS, MAX_ACTIONS } from "./action-linking";
import { SIGNAL_REGISTRY, PILLAR_WEIGHTS } from "./signals";
import type { ScanSignalRow } from "./compute-signals";
import type { ActionCard } from "@/lib/llm/types";

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
    contribution: normalised === null ? null : PILLAR_WEIGHTS[def.pillar] * def.weight * normalised,
    state,
    platform: "web",
  };
}

function card(category: ActionCard["category"], title: string, signalKeys?: string[]): ActionCard {
  return {
    category,
    title,
    why: "why",
    evidenceIds: [],
    evidence: [],
    effortMin: 30,
    suggestedDeadline: "2026-07-17",
    expectedOutcome: { scoreComponent: category === "seo_aso" ? "seo" : category, delta: 5 },
    draft: null,
    draftRequiresEdit: true,
    verification: { method: "self_report", state: "pending" },
    basis: "evidence_based",
    confidence: 0.8,
    target: null,
    ...(signalKeys ? { signalKeys } : {}),
  };
}

describe("linkSignalKeys", () => {
  it("attaches weak-first pillar signal keys to a card with no linkage", () => {
    const rows = [row("schema_jsonld", "fail", 0), row("title_tag", "pass", 100), row("content_depth", "warn", 40)];
    const linked = linkSignalKeys([card("seo_aso", "Fix SEO")], rows)[0]!;
    expect(linked.signalKeys!.length).toBeGreaterThan(0);
    // schema_jsonld is the failing seo signal → should lead the linkage.
    expect(linked.signalKeys![0]).toBe("schema_jsonld");
  });

  it("never leaves a card empty even when its pillar has no weak signal", () => {
    const rows = [row("title_tag", "pass", 100)];
    const linked = linkSignalKeys([card("seo_aso", "Fix SEO")], rows)[0]!;
    expect(linked.signalKeys!.length).toBeGreaterThan(0); // falls back to highest-weight seo signal
  });

  it("preserves existing signalKeys (e.g. the fallback floor's 1:1 links)", () => {
    const rows = [row("schema_jsonld", "fail", 0)];
    const linked = linkSignalKeys([card("seo_aso", "x", ["canonical_url"])], rows)[0]!;
    expect(linked.signalKeys).toEqual(["canonical_url"]);
  });
});

describe("topUpActions", () => {
  it("tops a thin 2-card plan up to >= MIN_ACTIONS when enough signals are failing", () => {
    const generated = [card("seo_aso", "Publish comparison pages"), card("content", "Ship a launch video")];
    const rows = [
      row("schema_jsonld", "fail", 0),
      row("canonical_url", "fail", 0),
      row("content_depth", "warn", 40),
      row("community_presence", "fail", 10),
      row("owned_channels", "warn", 35),
    ];
    const linked = linkSignalKeys(generated, rows);
    const plan = topUpActions(linked, rows);
    expect(plan.length).toBeGreaterThanOrEqual(MIN_ACTIONS);
    expect(plan.length).toBeLessThanOrEqual(MAX_ACTIONS);
    // every card carries a linkage now
    for (const a of plan) expect((a.signalKeys ?? []).length).toBeGreaterThan(0);
  });

  it("does not top up a plan that already meets the floor", () => {
    const plan = [1, 2, 3, 4, 5].map((n) => card("seo_aso", `fix ${n}`, ["title_tag"]));
    expect(topUpActions(plan, [row("schema_jsonld", "fail", 0)])).toHaveLength(5);
  });

  it("caps the plan at MAX_ACTIONS", () => {
    const generated = [card("content", "a")];
    const rows = SIGNAL_REGISTRY.map((d) => row(d.key, "fail", 0));
    const plan = topUpActions(linkSignalKeys(generated, rows), rows);
    expect(plan.length).toBeLessThanOrEqual(MAX_ACTIONS);
  });

  it("dedupes fallback fixes by title against existing cards", () => {
    const jsonldTitle = SIGNAL_REGISTRY.find((s) => s.key === "schema_jsonld")!.howToFix.replace(/\.$/, "");
    const generated = [card("seo_aso", jsonldTitle, ["title_tag"])];
    const rows = [row("schema_jsonld", "fail", 0), row("content_depth", "fail", 0)];
    const plan = topUpActions(generated, rows);
    const titles = plan.map((p) => p.title.toLowerCase());
    expect(titles.filter((t) => t === jsonldTitle.toLowerCase())).toHaveLength(1);
  });

  it("stays honest — a strong site with one weak signal is not padded to 5", () => {
    const generated = [card("seo_aso", "one real fix", ["title_tag"])];
    const rows = [row("content_depth", "warn", 45), row("title_tag", "pass", 100)];
    const plan = topUpActions(generated, rows);
    expect(plan.length).toBeLessThan(MIN_ACTIONS); // only 2 fixes genuinely exist
    expect(plan.length).toBe(2);
  });
});
