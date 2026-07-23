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
 * THE ONE KEYWORD SURFACE (M1 unify, 2026-07-23). The dashboard used to render a
 * SECOND keyword model — the metered Pipeline-B `supply.keywords.gaps`, recomputed
 * on every tab load. That fork is gone: the dashboard now renders ONLY this spine.
 *
 * WHY NO RIVAL "why" HERE YET (deliberately deferred to M3). The obvious win —
 * fold the deep scan's persisted `market.gap.keywordGap` in to show "N rivals
 * rank" — is UNSAFE on this "Create a page targeting «keyword»" surface: that gap
 * is RAW, unclassified rival keywords (competitor brands, airports, card products
 * — e.g. cardpointers' gap is "capital one" 9.1M, "los angeles international
 * airport" 1.5M, "hilton honors" 550k). Those pass `isMeaningfulMarketPhrase`
 * (multi-word, not single mega-tokens) yet are un-winnable page targets — the
 * SpaceX-"space" class. Rival keywords need the category RELEVANCE classifier (the
 * Phase-B judge, M3) before they can join an ACTIONABLE surface; until then the
 * spine — the subject's OWN classified near-misses — is the only honest source.
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
