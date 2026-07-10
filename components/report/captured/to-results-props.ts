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

  // Multi-tag audience derivation: split positioning prose into distinct chips
  // (on commas / semicolons / "and" / "&" / "·"), trim, drop tiny fragments, and
  // fold in the ICP signals as additional "intended" tags. Caps at 5 chips.
  const splitTags = (text: string | null | undefined): string[] => {
    if (!text) return [];
    return text
      .split(/[,;·]|\band\b|&|•/gi)
      .map((t) => t.trim().replace(/^(for|to|the|a)\s+/i, "").replace(/[.\s]+$/, "").trim())
      .filter((t) => t.length >= 3 && t.length <= 40);
  };
  const icpSignals = (report.whoItsFor?.signals ?? [])
    .map((s) => (typeof s === "string" ? s : (s as { label?: string })?.label ?? ""))
    .filter((s): s is string => !!s);

  const intendedTags = Array.from(new Set([...splitTags(pm.listingSays), ...icpSignals.flatMap(splitTags)])).slice(0, 5);
  const actualTags = Array.from(new Set(splitTags(pm.reviewsValue))).slice(0, 5);

  // Search-gap rows. Paid deep scans carry the rival keyword-gap
  // (`market.gap.keywordGap`); FREE web scans carry the subject-only teaser
  // (`freeKeywordTeaser` — high-volume searches where you rank but aren't winning,
  // no rival data). Prefer the paid gap; fall back to the free teaser.
  const kg = report.market?.gap?.keywordGap ?? [];
  const teaser = report.freeKeywordTeaser ?? [];
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
    gapRows = teaser.slice(0, 4).map((k) => ({
      query: k.keyword,
      volume: k.volume.toLocaleString(),
      rank: `#${k.yourPosition}`,
      ranked: true,
      opp: oppFor(k.volume),
    }));
    gapCount = report.freeKeywordTeaserTotal ?? teaser.length;
  }

  return {
    siteLabel,
    score: report.score.total,
    marketPosition: report.marketPosition?.total ?? null,
    headline: `A ${report.score.total} means real customers are searching — and landing on someone else.`,
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
