/**
 * buildDashboardHeroProps — the ONE pure builder for the paid dashboard hero's
 * score inputs, extracted verbatim from `app/(app)/app/dashboard/page.tsx`
 * (which now calls it) so the paid-surface acceptance rubric can drive the
 * REAL production computation instead of a forked replica (the
 * classification-corpus discipline: the test drives the one function
 * production runs).
 *
 * Score semantics preserved exactly (invariant #1): the gauge is the unified
 * Discoverability Score v5 — geomean of the FIXED-basis on-page driver
 * (`headlineScore`) and the persisted search-presence half from
 * `report_payload.searchVisibility.score`; with no live signal rows it falls
 * back to the persisted `score_total`, and the pillar rollup falls back to the
 * persisted breakdown (`pillarRollupFromRegistry(null, breakdown)`) — the path
 * that also makes the hero fully drivable from a captured `report_payload`
 * corpus fixture alone.
 *
 * Deliberately typed with a LOCAL structural interface rather than importing
 * `DashboardHeroProps` from the component: `lib ✗→ components` (check:arch).
 * TypeScript's structural typing makes the page's `<DashboardHero {...built}>`
 * spread fully checked against the component's own props.
 */

import { pillarRollupFromRegistry, type ScoreBreakdown } from "@/lib/scan/pillar-scores";
import { headlineScore, registryScore, discoverabilityScore } from "@/lib/scan/registry-score";
import type { Pillar } from "@/lib/scan/signals";
import type { ReportPayload } from "@/lib/scan/report";

export interface HeroSignalRow {
  signalKey?: string;
  pillar: Pillar;
  weight: number;
  normalised: number | null;
  state: string;
}

export interface DashboardHeroScoreProps {
  score: number;
  rollup: ReturnType<typeof pillarRollupFromRegistry>;
  measuredByPillar: Record<Pillar, number>;
  marketPosition: number | null;
  onPageReadiness: number | null;
  searchPresence: number | null;
}

export function buildDashboardHeroProps(input: {
  signalRows: HeroSignalRow[];
  scoreTotal: number;
  scoreBreakdown: ScoreBreakdown | null;
  reportPayload: ReportPayload | null;
}): DashboardHeroScoreProps {
  const rows = input.signalRows;
  const reg = rows.length ? headlineScore(rows) : null; // gauge on-page driver (fixed basis)
  const regFull = rows.length ? registryScore(rows) : null; // pillar bars (full measured set)

  const measuredByPillar: Record<Pillar, number> = { content: 0, outreach: 0, seo: 0 };
  for (const r of rows) if (r.state !== "unmeasured") measuredByPillar[r.pillar] = (measuredByPillar[r.pillar] ?? 0) + 1;

  const rollup = pillarRollupFromRegistry(regFull, input.scoreBreakdown);

  const searchPresence = input.reportPayload?.searchVisibility?.score ?? null;
  const score = reg
    ? searchPresence != null
      ? discoverabilityScore(reg.total, searchPresence)
      : reg.total
    : input.scoreTotal;

  const marketPosition = input.reportPayload?.marketPosition?.total ?? null;

  return {
    score,
    rollup,
    measuredByPillar,
    marketPosition,
    onPageReadiness: reg ? reg.total : null,
    searchPresence,
  };
}
