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

export function toResultsProps(report: ReportPayload, siteLabel: string, totalActions?: number): ResultsScreenProps {
  const b = report.score.breakdown;
  const minVal = Math.min(b.content, b.outreach, b.seo);
  const pillars = [
    { label: "Content", value: b.content, note: PILLAR_NOTE(b.content, b.content === minVal) },
    { label: "Outreach", value: b.outreach, note: PILLAR_NOTE(b.outreach, b.outreach === minVal) },
    { label: "SEO", value: b.seo, note: PILLAR_NOTE(b.seo, b.seo === minVal) },
  ];

  const allActions = [
    ...report.whatToDoThisWeek.quickWins,
    ...report.whatToDoThisWeek.medium,
    ...report.whatToDoThisWeek.longPlay,
  ]
    .filter((a) => (a.expectedOutcome?.delta ?? 0) > 0)
    .sort((a, b2) => (b2.expectedOutcome?.delta ?? 0) - (a.expectedOutcome?.delta ?? 0));

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

  // Search-gap rows from market keyword-gap (present on deep/paid scans).
  const kg = report.market?.gap?.keywordGap ?? [];
  const gapRows: GapRow[] = kg.slice(0, 4).map((k) => {
    const vol = typeof k.volume === "number" ? k.volume.toLocaleString() : String(k.volume ?? "—");
    const opp = k.volume >= 2000 ? "High" : k.volume >= 500 ? "Med" : "Low";
    return { query: k.keyword, volume: `${vol}`, rank: "Not ranking", ranked: false, opp };
  });

  return {
    siteLabel,
    score: report.score.total,
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
    gapTotal: kg.length || gapRows.length,
  };
}
