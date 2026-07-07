/**
 * Pure free-report assembly helpers.
 *
 * `verifiedScoreFromRegistry` wraps a `RegistryScore` (the v2 18-signal
 * registry total) into a `VerifiedScore` with the same 3-axis radar shape the
 * paid pipeline produces, so downstream consumers (the report renderer, the
 * badge/score-card) don't need to special-case the free path.
 *
 * `buildFreeReport` assembles a lightweight `ReportPayload` for the free scan:
 * the real score + positioning + findings + cheap signal-derived baseline
 * fixes, with all deep (paid) sections left empty. It reuses `assembleReport`
 * verbatim so the free and paid reports share one renderer.
 */

import type { Platform } from "./router";
import type { PreliminaryFacts } from "./types";
import type { Finding, PositioningMirror, ActionCard } from "@/lib/llm/types";
import type { RegistryScore } from "./registry-score";
import type { VerifiedScore, RadarAxis } from "./score-full";
import { assembleReport, type ReportPayload } from "./report";

/** Build the 3 radar axes from a RegistryScore breakdown (assessed pillars only). */
export function verifiedScoreFromRegistry(v: RegistryScore): VerifiedScore {
  const axis = (label: string, pillar: "content" | "outreach" | "seo", value: number): RadarAxis => ({
    axis: label,
    value,
    active: true,
    assessed: v.assessed.includes(pillar),
  });
  return {
    total: v.total,
    breakdown: { content: v.breakdown.content, outreach: v.breakdown.outreach, seo: v.breakdown.seo },
    basis: "verified",
    radar: [
      axis("Content", "content", v.breakdown.content),
      axis("Outreach", "outreach", v.breakdown.outreach),
      axis("SEO/ASO", "seo", v.breakdown.seo),
    ],
  };
}

/**
 * Assemble a lightweight free `ReportPayload`: the score + positioning + findings
 * + cheap signal-derived baseline fixes, with all deep sections empty (locked in
 * the UI). Pure — reuses the same `assembleReport` the paid pass uses, so the
 * shape is identical and one renderer handles both.
 */
export function buildFreeReport(args: {
  mode: Platform;
  generatedAt: string;
  facts: PreliminaryFacts;
  positioningMirror: PositioningMirror;
  findings: Finding[];
  actions: ActionCard[];
  score: VerifiedScore;
}): ReportPayload {
  const { mode, generatedAt, facts, positioningMirror, findings, actions, score } = args;
  const icpSignals = (facts.themes ?? []).map((t) => t.term).filter(Boolean).slice(0, 6);
  const competitorGap = (facts.competitors ?? [])
    .filter((c) => typeof c.name === "string" && c.name.length > 0)
    .map((c) => ({ competitor: c.name, dimension: "community presence", them: 0, you: 0 }));
  return assembleReport({
    mode,
    generatedAt,
    positioningMirror,
    findings,
    icpSignals,
    surfaces: [],
    competitorGap,
    actions,
    score,
    // deep sections omitted → assembleReport defaults them to empty
  });
}
