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
import type { SearchVisibility, DemandRow } from "./search-visibility";
import { discoverabilityScore as unifiedDiscoverability } from "./registry-score";
import { CATEGORY_TARGET, dedupeByIntent, isMeaningfulMarketPhrase } from "./search-visibility";

/** Max baseline fixes emitted by the floor. */
export const MAX_FALLBACK_ACTIONS = 5;

/** Phase C / D4 (2026-07-21): the free plan ALWAYS surfaces at least this many
 *  fixes (deterministic, honest — never fabricated). The blurred locked rows are
 *  a SEPARATE visual teaser; this is the floor on REAL fixes shown. Pinned in
 *  `documented-invariants.test.ts`. */
export const FREE_MIN_ACTIONS = 3;

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

/** Max opportunity-targeted cards emitted from the free footprint's category
 *  opportunities. */
export const MAX_OPPORTUNITY_ACTIONS = 2;

/**
 * Phase C / D4 (2026-07-21): the honest near-miss pool the free floor draws
 * opportunity fixes from — every REAL category keyword the subject does NOT
 * already win, highest-volume first, deduped. It merges the demand hero's
 * `categoryOpportunities` with the (Phase A) leader MARKET card's `gaps` and the
 * niche card's `gaps`, so a tidy page with a weak search footprint (the trustmrr
 * class: 0 `categoryOpportunities`, but a leader-sized market with real gaps)
 * still yields ≥{@link FREE_MIN_ACTIONS} honest fixes instead of "your top 1
 * ranked fixes". Every row carries a REAL DataForSEO volume + the subject's REAL
 * position (or none) — never fabricated (invariant #11 / 5a). PURE.
 */
export function categoryNearMisses(sv: Pick<SearchVisibility, "categoryOpportunities" | "categoryCard" | "nicheCard">): DemandRow[] {
  const rows: DemandRow[] = [
    ...(sv.categoryOpportunities ?? []),
    ...(sv.categoryCard?.gaps ?? []),
    ...(sv.nicheCard?.gaps ?? []),
  ].filter((r) => r && r.volume > 0);
  // These become the free board's LEAD fixes ("Create a page targeting X"), so
  // they must clear the SAME honesty bar as the market cards — never a bare
  // mega-word ("Create a page targeting 'space'" for spacex.com, 368k, a real
  // ranking but an unwinnable page target: live defect 2026-07-22) and never a
  // near-duplicate ("privacy tools" + "privacy tool", usefathom.com). Reuse the
  // exact market-card guards (`isMeaningfulMarketPhrase` ≥2 real non-mega words,
  // `dedupeByIntent` plural/paraphrase collapse) so the opportunity surface can
  // never drift from the card surface. `categoryOpportunities`/`categoryCard.gaps`
  // are NOT pre-filtered upstream (only the niche/market cards are), which is why
  // the bare word leaked here but not into "What to rank for next".
  const deduped = dedupeByIntent(rows.filter((r) => isMeaningfulMarketPhrase(r.keyword)));
  return deduped.sort((a, b) => b.volume - a.volume);
}

/**
 * WS-C (2026-07-19): the free plan's #1 fix must speak to the page's own
 * diagnosis. These cards are DETERMINISTIC (no LLM, no new data): each names a
 * real category search the site doesn't win (keyword/volume/position already in
 * the payload). Impact honesty (invariant 5a): the delta is RECOMPUTED from the
 * score model — winning one category term moves the search-presence driver by
 * one CATEGORY_TARGET step, and the delta is the unified-gauge movement that
 * step produces. Never a free-chosen number.
 */
export function opportunityActionsFromSearch(
  input: {
    score: number;
    onPageReadiness: number;
    categoryOpportunities: Array<{ keyword: string; volume: number; yourPosition?: number }>;
    /** Phase C: how many opportunity cards to emit (the free floor raises this to
     *  FREE_MIN_ACTIONS so a weak-search site still reaches the fix floor). */
    max?: number;
  },
  now: Date = new Date(),
): ActionCard[] {
  const { score, onPageReadiness } = input;
  if (onPageReadiness <= 0) return [];
  const opps = (input.categoryOpportunities ?? []).slice(0, input.max ?? MAX_OPPORTUNITY_ACTIONS);
  const deadline = new Date(now.getTime() + 21 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const before = unifiedDiscoverability(onPageReadiness, Math.max(1, score));
  const after = unifiedDiscoverability(onPageReadiness, Math.min(100, score + 100 / CATEGORY_TARGET));
  const delta = Math.max(1, Math.round(after - before));
  return opps.map((o) => ({
    category: "seo_aso",
    title: `Create a page targeting "${o.keyword}"`,
    why: `${o.volume.toLocaleString()} searches/mo in your category — ${
      typeof o.yourPosition === "number" ? `you're #${o.yourPosition} today; top 3 is the goal` : "you don't rank for it yet"
    }. Winning it lifts the Search-presence half of your score.`,
    evidenceIds: [],
    evidence: [],
    effortMin: 120,
    suggestedDeadline: deadline,
    expectedOutcome: { scoreComponent: "seo", delta },
    draft: null,
    draftRequiresEdit: true,
    verification: { method: "self_report", state: "pending" },
    basis: "probability_based",
    confidence: 0.5,
    target: null,
    signalKeys: [],
    // The real keyword + volume that make this a data-driven growth move — the
    // free board leads with these and renders the volume chip (R2-safe: a real
    // DataForSEO number already in the payload).
    opportunity: { keyword: o.keyword, volume: o.volume },
  }));
}
