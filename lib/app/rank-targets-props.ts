/**
 * buildRankTargets — the ONE pure builder for the paid dashboard's
 * "What to rank for" board (the growth engine), extracted so the paid-surface
 * acceptance rubric drives the REAL production computation (same discipline as
 * `buildDashboardHeroProps`).
 *
 * Source of truth: `report_payload.searchVisibility` — the SAME free-computed
 * market/opportunity model both tiers persist (invariant #1 untouched: these are
 * presentation fields, they never feed `sv.score`). Paid renders the FULL,
 * unredacted target set (free only teases 5); the rows come from the shared,
 * guarded `categoryNearMisses` (≥2-real-word phrases, intent-deduped — the same
 * spine the free board and the action floor use, so the three can't drift).
 *
 * Zero new cost: reads the persisted payload, makes no fetch. The paid rival-gap
 * enrichment (who outranks you, the "why") lands in Phase 3 as a paid-only
 * fetch; this phase renders the base spine that already exists in the payload.
 */

import type { ReportPayload } from "@/lib/scan/report";
import { categoryNearMisses } from "@/lib/scan/fallback-actions";

export interface RankTarget {
  keyword: string;
  /** Real DataForSEO monthly search volume. */
  volume: number;
  /** The subject's live position for this term, when it already ranks (near-miss). */
  yourPosition?: number;
}

export interface RankTargetsProps {
  /** Every category/niche search the subject does NOT already win, by demand — the
   *  full target list (paid is unredacted). Empty when the scan measured no
   *  grounded opportunities (a 0-footprint product) — the board degrades to a
   *  zero-state, never a fabricated row. */
  targets: RankTarget[];
  /** Market context from the (data-board) cards, when the payload carries them —
   *  absent on pre-data-board captures (null-coalesced at the boundary). */
  categoryLabel: string | null;
  categoryDemand: number | null;
  nicheLabel: string | null;
  nicheDemand: number | null;
}

export function buildRankTargets(reportPayload: ReportPayload | null): RankTargetsProps {
  const sv = reportPayload?.searchVisibility ?? null;
  const targets: RankTarget[] = sv
    ? categoryNearMisses(sv).map((r) => ({ keyword: r.keyword, volume: r.volume, yourPosition: r.yourPosition }))
    : [];
  return {
    targets,
    categoryLabel: sv?.categoryCard?.label ?? null,
    categoryDemand: sv?.categoryCard?.demand ?? (sv?.categoryDemand || null),
    nicheLabel: sv?.nicheCard?.label ?? null,
    nicheDemand: sv?.nicheCard?.demand ?? null,
  };
}
