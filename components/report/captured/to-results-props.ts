/**
 * toResultsProps — map the live ReportPayload onto the captured ResultsScreen's
 * props. Wires the fields that map cleanly (score, pillars, fixes, positioning
 * gap, site label); the audience tag-chips use the positioning prose (a clean
 * multi-tag audience model is a follow-up data service), and the search-gap
 * rows come from the market keyword-gap when present.
 */

import type { ReportPayload } from "@/lib/scan/report";
import type { ResultsScreenProps, Fix, GapRow } from "./results-screen";

const PILLAR_NOTE = (v: number, isMin: boolean) =>
  isMin ? "biggest lever" : v < 50 ? "needs work" : v >= 70 ? "strong surface" : "room to climb";

const CATEGORY_LABEL: Record<string, string> = { content: "Content", outreach: "Outreach", seo_aso: "SEO" };
const effortLabel = (min: number) => (min < 30 ? "Quick" : min <= 120 ? "Medium" : "Deep");

export function toResultsProps(
  report: ReportPayload,
  siteLabel: string,
  totalActions?: number,
  /** Pre-redaction keyword-gap count — the free-tier redaction empties
   *  `market.gap.keywordGap`, so the caller passes the full payload's total
   *  ("show the total, render a fraction", same as `totalActions`). */
  totalGapQueries?: number,
): ResultsScreenProps {
  const b = report.score.breakdown;
  // Radar axes 0/1/2 are Content/Outreach/SEO; `assessed:false` means the pillar
  // had no measured signal (e.g. off-site outreach on a free on-site scan). Such a
  // pillar must render as "Not measured", never a damning 0/100, and must not be
  // eligible as the "biggest lever" (min) — a 0 it never earned.
  const radar = report.score.radar ?? [];
  const measuredAt = (i: number): boolean => (radar[i] ? radar[i]!.assessed !== false : true);
  const measured = { content: measuredAt(0), outreach: measuredAt(1), seo: measuredAt(2) };
  const measuredVals = [
    measured.content ? b.content : null,
    measured.outreach ? b.outreach : null,
    measured.seo ? b.seo : null,
  ].filter((v): v is number => v !== null);
  const minVal = measuredVals.length ? Math.min(...measuredVals) : -1;
  const pillars = [
    { label: "Content", value: b.content, note: PILLAR_NOTE(b.content, measured.content && b.content === minVal), measured: measured.content },
    { label: "Outreach", value: b.outreach, note: PILLAR_NOTE(b.outreach, measured.outreach && b.outreach === minVal), measured: measured.outreach },
    { label: "SEO", value: b.seo, note: PILLAR_NOTE(b.seo, measured.seo && b.seo === minVal), measured: measured.seo },
  ];

  const ranked = [
    ...report.whatToDoThisWeek.quickWins,
    ...report.whatToDoThisWeek.medium,
    ...report.whatToDoThisWeek.longPlay,
  ].sort((a, b2) => (b2.expectedOutcome?.delta ?? 0) - (a.expectedOutcome?.delta ?? 0));
  // Prefer actions with a positive predicted delta, but NEVER let the filter
  // empty a non-empty plan (regression: real scans whose cards carried delta 0
  // rendered "your top 0 ranked fixes").
  const positive = ranked.filter((a) => (a.expectedOutcome?.delta ?? 0) > 0);
  const allActions = positive.length > 0 ? positive : ranked;

  const fixes: Fix[] = allActions.slice(0, 3).map((a, i) => ({
    rank: i + 1,
    title: a.title,
    why: a.why,
    effort: effortLabel(a.effortMin),
    pillar: CATEGORY_LABEL[a.category] ?? a.category,
    pred: a.expectedOutcome?.delta ?? 0,
  }));
  const rest = allActions.slice(3);
  const lockedWorth = rest.reduce((s, a) => s + (a.expectedOutcome?.delta ?? 0), 0);
  const fullTotal = totalActions ?? allActions.length;

  const pm = report.whatYouOffer.positioningMirror;

  // Clean LLM-authored audience tags — who the page is written FOR vs who it reads
  // AS. Replaces the old naive prose-splitting that produced garbage chips
  // ("trustmrr", "updated hourly —"). Empty when a legacy report predates the field.
  const cleanTags = (tags: string[] | undefined): string[] =>
    (tags ?? []).filter((t) => typeof t === "string" && t.trim().length >= 2).map((t) => t.trim()).slice(0, 5);
  const intendedTags = cleanTags(pm.intendedAudience);
  const actualTags = cleanTags(pm.actualAudience);

  // Search-gap rows. Paid deep scans carry the rival keyword-gap
  // (`market.gap.keywordGap`); FREE web scans carry the honest subject-only
  // category gap (`searchVisibility.categoryGap` — YOUR category terms where you're
  // not winning, with other-brand noise stripped). Prefer the paid gap.
  const kg = report.market?.gap?.keywordGap ?? [];
  const sv = report.searchVisibility ?? null;
  const oppFor = (v: number) => (v >= 2000 ? "High" : v >= 500 ? "Med" : "Low");
  let gapRows: GapRow[];
  let gapCount: number;
  if (kg.length > 0) {
    gapRows = kg.slice(0, 4).map((k) => {
      const vol = typeof k.volume === "number" ? k.volume.toLocaleString() : String(k.volume ?? "—");
      return { query: k.keyword, volume: `${vol}`, rank: "Not ranking", ranked: false, opp: oppFor(k.volume) };
    });
    gapCount = kg.length;
  } else {
    // FREE: the demand-derived opportunities — the biggest searches in your category
    // that you don't win (real market demand, not just your own tiny near-misses).
    const opps = sv?.categoryOpportunities ?? [];
    gapRows = opps.slice(0, 4).map((k) => ({
      query: k.keyword,
      volume: k.volume.toLocaleString(),
      rank: "Not winning",
      ranked: false,
      opp: oppFor(k.volume),
    }));
    gapCount = opps.length;
  }

  // Search Visibility panel — shown whenever the gather ran (ONE gate, mirrors
  // report.ts). Even a site that ranks for NOTHING renders here (the zero-state),
  // so we never show an empty "Your category" header.
  const searchVisibility = sv
    ? {
        score: sv.score,
        keywordsRanked: sv.keywordsRanked,
        estMonthlyVisits: sv.estMonthlyVisits,
        brandPct: sv.brandPct,
        categoryPct: sv.categoryPct,
        offTopicPct: sv.offTopicPct,
        categoryWins: sv.categoryWins,
        categoryDemand: sv.categoryDemand,
        categoryCaptureRate: sv.categoryCaptureRate,
      }
    : null;

  // Coherent headline (was the incoherent "a 98 means customers land on someone
  // else"). Lead with the real gap: no rankings at all is the sharpest hook; then a
  // low category-capture; then the other-brands story.
  const demandStr = sv ? sv.categoryDemand.toLocaleString() : "";
  const headline = searchVisibility
    ? searchVisibility.keywordsRanked === 0
      ? searchVisibility.categoryDemand > 0
        ? `Google ranks you for nothing yet — and your category gets ${demandStr} searches a month, all going to someone else.`
        : `Google ranks you for nothing yet — you're invisible in the searches your buyers make.`
      : searchVisibility.categoryDemand > 0 && searchVisibility.categoryCaptureRate < 15
        ? `Your category gets ${demandStr} searches a month — and you capture just ${searchVisibility.categoryCaptureRate}% of it.`
        : searchVisibility.offTopicPct >= 55
          ? `Your page is clean — but ${searchVisibility.offTopicPct}% of your search visibility is other companies' brand names, not yours.`
          : `You're on the board in search — but leaving real category traffic on the table.`
    : `${report.score.total}/100 on-site readiness. The gap that matters is where buyers search — and that's below.`;

  return {
    siteLabel,
    score: report.score.total,
    marketPosition: report.marketPosition?.total ?? null,
    searchVisibility,
    // Real competitor names we discovered (the compare-set) — their per-rival
    // category share is the paid unlock; free just names who buyers weigh you against.
    competitors: (report.whereTheyAre?.competitorGap ?? [])
      .map((c) => c.competitor)
      .filter((n): n is string => typeof n === "string" && n.length > 0)
      .slice(0, 6),
    headline,
    intro:
      "is technically fine. The gap is discoverability: you're absent from the comparison and directory surfaces where your buyers actually decide.",
    pillars,
    fixes,
    lockedCount: rest.length || Math.max(0, fullTotal - fixes.length),
    lockedWorth,
    intendedTags,
    actualTags,
    mirrorGap: pm.gap,
    gapRows,
    gapTotal: totalGapQueries ?? (gapCount || gapRows.length),
  };
}
