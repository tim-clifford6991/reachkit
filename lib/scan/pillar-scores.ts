/**
 * Pillar rollup for the dashboard hero — turns the persisted 3-int
 * `scans.score_breakdown` ({ content, outreach, seo }) into per-pillar display
 * rows plus the weakest-pillar "lever". PURE (no DB, no React) so it unit-tests
 * without a harness.
 *
 * Assessed vs not-measured: SEO/ASO is always assessed (the SERP run always
 * happens). Content and Outreach are only measured once their surfaces are
 * verified — on a first scan they are 0 AND un-assessed, and must render as
 * "not measured" rather than a real zero (the §7 anti-vanity rule that kept
 * Stripe from scoring 19). We mirror `verifiedScore`'s semantics: a content /
 * outreach value of 0 means "not measured this scan", a value > 0 means assessed.
 *
 * The weakest lever is the LOWEST-scoring ASSESSED pillar. `estGain` is a
 * conservative, explainable estimate of the headline points on offer if that
 * pillar were raised to the level of the strongest assessed pillar — the
 * pillar's total-score weight times the gap. It is labelled as an estimate at
 * the call site; it is 0 (and hidden) when there is no headroom.
 */

import { PILLAR_WEIGHTS, type Pillar } from "@/lib/scan/signals";

export interface ScoreBreakdown {
  content: number;
  outreach: number;
  seo: number;
}

export interface PillarScore {
  pillar: Pillar;
  label: string;
  value: number;
  /** False → render "not measured" rather than a 0 bar. */
  assessed: boolean;
}

export interface PillarRollup {
  /** Display order: Content, Outreach, SEO (matches the report card). */
  pillars: PillarScore[];
  /** Lowest-scoring assessed pillar, or null if somehow none are assessed. */
  weakest: PillarScore | null;
  /** Estimated headline points from raising `weakest` to the strongest assessed pillar. */
  estGain: number;
}

const LABEL: Record<Pillar, string> = { content: "Content", outreach: "Outreach", seo: "SEO" };
const DISPLAY_ORDER: Pillar[] = ["content", "outreach", "seo"];

/** SEO is always assessed; content/outreach are assessed only when measured (> 0). */
function isAssessed(pillar: Pillar, value: number): boolean {
  return pillar === "seo" || value > 0;
}

/** Shared: derive weakest + estimated-gain from a set of scored pillars. */
function buildRollup(pillars: PillarScore[]): PillarRollup {
  const assessed = pillars.filter((p) => p.assessed);
  const weakest = assessed.length ? assessed.reduce((min, p) => (p.value < min.value ? p : min)) : null;
  const strongest = assessed.length ? assessed.reduce((max, p) => (p.value > max.value ? p : max)) : null;
  const estGain =
    weakest && strongest && strongest.value > weakest.value
      ? Math.round(PILLAR_WEIGHTS[weakest.pillar] * (strongest.value - weakest.value))
      : 0;
  return { pillars, weakest, estGain };
}

export function pillarRollup(breakdown: ScoreBreakdown | null | undefined): PillarRollup {
  const b: ScoreBreakdown = {
    content: Math.max(0, Math.round(breakdown?.content ?? 0)),
    outreach: Math.max(0, Math.round(breakdown?.outreach ?? 0)),
    seo: Math.max(0, Math.round(breakdown?.seo ?? 0)),
  };
  return buildRollup(
    DISPLAY_ORDER.map((pillar) => ({ pillar, label: LABEL[pillar], value: b[pillar], assessed: isAssessed(pillar, b[pillar]) })),
  );
}

/**
 * 1A — pillar rollup from the FULL 18-signal registry breakdown. This is the honest
 * pillar model: Outreach IS measured on a paid scan (marketplace/community/share-of-
 * voice signals), so it no longer falsely reads "not measured yet" the way the
 * on-site-only `score_breakdown` did. `assessed` means "a signal was actually
 * measured in this pillar", from the registry's own assessed set. Falls back to the
 * `score_breakdown` rollup when no registry signals exist (free/app scans).
 */
export function pillarRollupFromRegistry(
  reg: { breakdown: ScoreBreakdown; assessed: Pillar[] } | null,
  fallback: ScoreBreakdown | null | undefined,
): PillarRollup {
  if (reg && reg.assessed.length > 0) {
    const assessedSet = new Set(reg.assessed);
    return buildRollup(
      DISPLAY_ORDER.map((pillar) => ({
        pillar,
        label: LABEL[pillar],
        value: Math.max(0, Math.round(reg.breakdown[pillar] ?? 0)),
        assessed: assessedSet.has(pillar),
      })),
    );
  }
  return pillarRollup(fallback);
}
