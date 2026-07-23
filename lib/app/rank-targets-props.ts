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
 * on every tab load. That fork is gone: the rival "why" (how many cohort rivals
 * rank a term, and the best position they hold) is read straight from the deep
 * scan's ALREADY-persisted `report_payload.market.gap.keywordGap` — zero new cost,
 * no second gather. Free payloads carry no `market`, so free stays spine-only and
 * the base target list is byte-identical free↔paid (invariant #1 safe). The full
 * per-rival breakdown (which domain ranks where + the winning URL) is the Phase-3
 * enrichment that persists per-rival positions into the payload.
 */

import type { ReportPayload } from "@/lib/scan/report";
import { categoryNearMisses } from "@/lib/scan/fallback-actions";
import { dedupeByIntent, isMeaningfulMarketPhrase, type DemandRow } from "@/lib/scan/search-visibility";

export interface RankTarget {
  keyword: string;
  /** Real DataForSEO monthly search volume. */
  volume: number;
  /** The subject's live position for this term, when it already ranks (near-miss). */
  yourPosition?: number;
  /** Rival "why" (paid) — how many cohort rivals rank for this term, from the deep
   *  scan's persisted `market.gap.keywordGap`. Absent on free (spine-only) and on
   *  pre-market legacy payloads. */
  rivalsRanking?: number;
  /** The best (lowest) absolute position any rival holds for it — the gap to close. */
  bestRivalPosition?: number;
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

const norm = (s: string) => s.toLowerCase().trim();

export function buildRankTargets(reportPayload: ReportPayload | null): RankTargetsProps {
  const sv = reportPayload?.searchVisibility ?? null;
  const base = sv ? categoryNearMisses(sv) : [];

  // Rival "why" from the deep scan's persisted market gap (paid-only; free/legacy
  // payloads carry no `market`). The SAME RC1 keyword-gap engine the retired
  // metered Pipeline-B surface used — read once from the payload, never re-fetched.
  const gapRows = reportPayload?.market?.gap?.keywordGap ?? [];
  const gapByKw = new Map(gapRows.map((g) => [norm(g.keyword), g]));

  // Base spine positions, keyed so a deduped row can re-attach "you're #N".
  const posByKw = new Map(base.map((r) => [norm(r.keyword), r.yourPosition]));
  const knownBase = new Set(base.map((r) => norm(r.keyword)));

  // The paid set = the spine ∪ the rival-gap terms the spine didn't surface, run
  // through the SAME honesty guards the spine uses (≥2 real non-mega words, intent
  // dedup) so a rival brand/mega term can never leak in via the gap.
  const combined: DemandRow[] = [
    ...base,
    ...gapRows
      .filter((g) => !knownBase.has(norm(g.keyword)) && g.volume > 0 && isMeaningfulMarketPhrase(g.keyword))
      .map((g) => ({ keyword: g.keyword, volume: g.volume })),
  ];
  const deduped = dedupeByIntent(combined).sort((a, b) => b.volume - a.volume);

  const targets: RankTarget[] = deduped.map((r) => {
    const key = norm(r.keyword);
    const g = gapByKw.get(key);
    const yourPosition = posByKw.get(key);
    return {
      keyword: r.keyword,
      volume: r.volume,
      ...(typeof yourPosition === "number" ? { yourPosition } : {}),
      ...(g ? { rivalsRanking: g.rivalsRanking, bestRivalPosition: g.bestRivalPosition } : {}),
    };
  });

  return {
    targets,
    categoryLabel: sv?.categoryCard?.label ?? null,
    categoryDemand: sv?.categoryCard?.demand ?? (sv?.categoryDemand || null),
    nicheLabel: sv?.nicheCard?.label ?? null,
    nicheDemand: sv?.nicheCard?.demand ?? null,
  };
}
