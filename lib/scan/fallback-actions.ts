/**
 * Deterministic action floor (launch-readiness).
 *
 * The primary action path (generateActions → Critic Gate v2 → §11 safety) can
 * legitimately drop 100% of cards on a real scan — seen live on bloom.io
 * (scan 388982c5) and nudgi.ai — because a generation/parse failure yields
 * placeholder cards the critic always rejects (no evidence, null drafts).
 * A completed scan with a score and measured signals must never ship an empty
 * "what to do this week": this module derives baseline fixes from the weakest
 * fail/warn signals of the 18-signal registry (each signal already carries a
 * plain-English why + how-to-fix).
 *
 * Deliberately SEPARATE from the primary path and applied only when the gated
 * set is empty. The cards are templated, evidence-free and probability-based
 * (draft: null, confidence ≤ 0.6), so they honour the §11 invariants without
 * pretending to be LLM-crafted, evidence-cited actions — they never pass
 * through the critic (its evidence rules would reject them by construction).
 *
 * PURE + deterministic (`now` injectable); unit-tested in fallback-actions.test.ts.
 */

import { SIGNAL_REGISTRY, PILLAR_WEIGHTS, type Pillar, type SignalSource } from "./signals";
import type { ScanSignalRow } from "./compute-signals";
import type { ActionCard } from "@/lib/llm/types";

/** Max baseline fixes emitted by the floor. */
export const MAX_FALLBACK_ACTIONS = 5;

const CATEGORY_FOR_PILLAR: Record<Pillar, ActionCard["category"]> = {
  content: "content",
  outreach: "outreach",
  seo: "seo_aso",
};

/** Rough effort by how the signal is measured/fixed: parse = on-page HTML edit,
 *  exists = listing/page work, wire = channel/community work, new = earned media. */
const EFFORT_MIN_FOR_SOURCE: Record<SignalSource, number> = {
  parse: 20,
  exists: 45,
  wire: 90,
  new: 180,
};

const DEADLINE_DAYS = 14;

/**
 * Derive up to {@link MAX_FALLBACK_ACTIONS} baseline ActionCards from the
 * weakest measured signals, ranked by expected score impact
 * (pillar weight × signal weight × normalised shortfall — i.e. the points the
 * signal is leaving on the table). Healthy rows (pass) and unmeasured rows are
 * ignored; an all-healthy scan floors to [].
 */
export function fallbackActionsFromSignals(
  rows: ScanSignalRow[],
  now: Date = new Date(),
): ActionCard[] {
  const defByKey = new Map(SIGNAL_REGISTRY.map((d) => [d.key, d]));

  const candidates = rows
    .flatMap((r) => {
      if (r.state !== "fail" && r.state !== "warn") return [];
      if (r.normalised === null) return [];
      const def = defByKey.get(r.signalKey);
      if (!def) return [];
      // Score points this signal is currently costing (0–100 total-score scale).
      const impact = PILLAR_WEIGHTS[def.pillar] * def.weight * (100 - r.normalised);
      return [{ def, state: r.state, normalised: r.normalised, impact }];
    })
    .sort((a, b) => b.impact - a.impact)
    .slice(0, MAX_FALLBACK_ACTIONS);

  const deadline = new Date(now.getTime() + DEADLINE_DAYS * 24 * 3600 * 1000)
    .toISOString()
    .slice(0, 10);

  return candidates.map(({ def, state, normalised, impact }) => ({
    category: CATEGORY_FOR_PILLAR[def.pillar],
    title: def.howToFix.replace(/\.$/, ""),
    why: `${def.label} is ${state === "fail" ? "failing" : "below par"} (${Math.round(
      normalised,
    )}/100 on this scan). ${def.why}`,
    evidenceIds: [],
    evidence: [],
    effortMin: EFFORT_MIN_FOR_SOURCE[def.source],
    suggestedDeadline: deadline,
    expectedOutcome: {
      scoreComponent: def.pillar,
      delta: Math.max(1, Math.round(impact)),
    },
    draft: null,
    draftRequiresEdit: true,
    verification: { method: "self_report", state: "pending" },
    basis: "probability_based",
    confidence: 0.5,
    target: null, // signal-derived baseline fixes carry no WHO/WHERE
    signalKeys: [def.key], // exact 1:1 linkage — this fix addresses this signal
  }));
}
