/**
 * Report payload assembly (§5.6) and persistence.
 *
 * `assembleReport` is pure and deterministic — `generatedAt` is always
 * passed in from the caller so tests can control it.
 *
 * `persistReport` writes `scans.report_payload` via serverDb().
 */

import type { PositioningMirror, Finding, ActionCard } from "@/lib/llm/types";
import type { VerifiedScore } from "@/lib/scan/score-full";
import type { Platform } from "@/lib/scan/router";
import type { MarketAnalysis } from "@/lib/scan/gap";
import type { SearchVisibility } from "@/lib/scan/search-visibility";
import { SIGNAL_REGISTRY } from "@/lib/scan/signals";
import { buildCaption } from "@/lib/badge/score-card";
import { serverDb } from "@/lib/db/client";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface KeywordOpportunity {
  keyword: string;
  volume: number;
  cpc: number;
  competition: number;
}

export interface KeywordCluster {
  theme: string;
  keywords: KeywordOpportunity[];
}

export interface EngagedCommunity {
  source: string;
  title: string;
  url: string;
  engagement: number;
}

/** Channel & keyword opportunities (paid deep section). */
export interface ChannelOpportunities {
  keywordClusters: KeywordCluster[];
  communitiesByEngagement: EngagedCommunity[];
}

export interface ReportPayload {
  mode: Platform;
  generatedAt: string;
  /** Q1 — What you offer */
  whatYouOffer: {
    positioningMirror: PositioningMirror;
  };
  /** Q2 — Who it's for */
  whoItsFor: {
    summary: string;
    signals: string[];
  };
  /** Q3 — Where they are (surfaces + competitor gap) */
  whereTheyAre: {
    surfaces: Array<{ source: string; title: string; url: string }>;
    competitorGap: Array<{
      competitor: string;
      dimension: string;
      them: number;
      you: number;
      /** How the competitor describes itself (from the competitor_gap sheet). */
      positioning?: string;
      /** The specific gap vs the subject (from the competitor_gap sheet). */
      gap?: string;
    }>;
  };
  /** Q4 — What to do this week (bucketed by time-to-PAYOFF, PR C / §6 #2/#3) */
  whatToDoThisWeek: {
    /** On-page content/SEO fixes that move the score as soon as they ship. */
    quickWins: ActionCard[];
    /** Off-site groundwork that pays off over a few weeks (wire-source signals). */
    medium: ActionCard[];
    /** Slow-compounding plays — outreach, backlinks, earned media (weeks+). */
    longPlay: ActionCard[];
  };
  score: VerifiedScore;
  /** F2 — the off-site "Market position" grade (paid-only): how the subject stacks
   *  up against its real cohort on organic footprint, backlinks, cadence, presence,
   *  share of voice. Deliberately distinct from `score` (the on-site readiness
   *  headline). Absent on free scans / when no off-site signal was measured. */
  marketPosition?: { total: number; breakdown: { content: number; outreach: number; seo: number }; assessed: string[] } | null;

  // ── Deep sections — surfaced from already-computed data (paid; teaser-locked) ──
  // Optional: reports persisted before this feature won't carry them, so every
  // consumer must null-coalesce (`?? []`).
  /** Channel & keyword opportunities — keyword clusters + communities by engagement. */
  channelOpportunities?: ChannelOpportunities;

  // ── M4 market analysis — deep cohort (you + prominent rivals) + demand + gap +
  // plan. Present only on paid deep scans (flag-gated). Supersedes the lighter
  // channelOpportunities section when present.
  market?: MarketAnalysis;

  // ── Free-tier Search Visibility (iteration 2) — the honest conversion metric,
  // computed from the ONE subject-only ranked_keywords call. Splits the domain's
  // organic footprint into brand / category / off-topic so the free report can
  // lead with the real gap ("90% of your visibility is other companies' brands")
  // instead of the on-site score that reads as "you're winning". Free web scans
  // only; the paid report uses `market` (rival cohort) instead.
  searchVisibility?: SearchVisibility;

  // ── Part C — honest fetch-quality degrade state. True when the site fetch
  // returned a JS-shell/garbage capture AND the one Tavily Extract escalation
  // also failed/was garbage (`facts.fetchDegraded`, set in collect). Optional:
  // reports persisted before this feature won't carry it (null-coalesce `??
  // false` at the render props boundary, per the report_payload rule).
  fetchDegraded?: boolean;
}

// ---------------------------------------------------------------------------
// Bucketing helper (§10.3 horizon mix)
// ---------------------------------------------------------------------------

type Horizon = "quick" | "medium" | "long";

/**
 * Time-to-PAYOFF horizon for an action (PR C, §6 #2/#3) — replaces the old
 * time-to-DO (effortMin) split so the short/long mix reflects WHEN the score
 * actually moves, and "long-term wins" genuinely exist. (The old effort-based
 * split could never populate longPlay: LLM `effortMin` is clamped to ≤90 but the
 * bucket needed >120, so every generated card fell in quick/medium.)
 *
 *  - Outreach pays off slowly — relationships, backlinks, community seeding → long.
 *  - Cards addressing earned-media / off-site signals (source "new": referring
 *    domains, press) → long; other off-site "wire" signals (keywords, presence,
 *    cadence) → medium.
 *  - On-page content + SEO fixes move the score as soon as they ship → quick,
 *    unless the model estimated real hands-on effort (≥30 min) → medium.
 */
export function horizonFor(action: ActionCard): Horizon {
  if (action.category === "outreach") return "long";
  const sources = (action.signalKeys ?? [])
    .map((k) => SIGNAL_REGISTRY.find((d) => d.key === k)?.source)
    .filter((s): s is NonNullable<typeof s> => !!s);
  if (sources.includes("new")) return "long";
  if (sources.includes("wire")) return "medium";
  return action.effortMin < 30 ? "quick" : "medium";
}

export function bucketActions(actions: ActionCard[]): ReportPayload["whatToDoThisWeek"] {
  const quickWins: ActionCard[] = [];
  const medium: ActionCard[] = [];
  const longPlay: ActionCard[] = [];

  for (const action of actions) {
    const h = horizonFor(action);
    if (h === "quick") quickWins.push(action);
    else if (h === "medium") medium.push(action);
    else longPlay.push(action);
  }

  return { quickWins, medium, longPlay };
}

// ---------------------------------------------------------------------------
// whoItsFor summary builder
// ---------------------------------------------------------------------------

function buildWhoSummary(
  icpSignals: string[],
  reviewsValue: string,
): string {
  const topSignals = icpSignals.slice(0, 3);
  if (topSignals.length === 0) {
    return reviewsValue.length > 0 ? reviewsValue : "Audience signals not yet identified.";
  }
  const signalList = topSignals.join(", ");
  return reviewsValue.length > 0
    ? `Buyers who value ${signalList}. Reviews confirm: "${reviewsValue}".`
    : `Buyers who value ${signalList}.`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Assemble a `ReportPayload` from the outputs of the Cycle 3 pipeline.
 *
 * Pure and deterministic — no side effects, no network calls.
 * `generatedAt` is passed in (not `new Date()`) to keep tests reproducible.
 */
export function assembleReport(input: {
  mode: Platform;
  generatedAt: string;
  positioningMirror: PositioningMirror;
  // Kept on the signature so existing callers (e.g. persistDeepSynth-adjacent
  // call sites) don't need a second edit — no longer read in the body since
  // M3b retired the strengthsAndWeaknesses section that used to map these into
  // its `diagnostics` list.
  findings: Finding[];
  /** ICP/audience signal strings shown in `whoItsFor`. The review_themes
   *  producer (M3b, O-7) was its only source at the deep pass; free scans still
   *  derive it from `facts.themes` (free-report.ts). Optional — an omitted/empty
   *  array degrades `whoItsFor.summary` to its "not yet identified" fallback. */
  icpSignals?: string[];
  surfaces: Array<{ source: string; title: string; url: string }>;
  competitorGap: Array<{
    competitor: string;
    dimension: string;
    them: number;
    you: number;
    positioning?: string;
    gap?: string;
  }>;
  actions: ActionCard[];
  score: VerifiedScore;
  // Deep sections (already-computed data, passed in by the caller). Optional so
  // existing callers/tests that don't surface them still produce a valid report.
  channelOpportunities?: ChannelOpportunities;
  /** Free-tier Search Visibility (iteration 2) — populated on free web scans. */
  searchVisibility?: SearchVisibility;
  /** Part C — `facts.fetchDegraded`, passed through by the caller. */
  fetchDegraded?: boolean;
}): ReportPayload {
  const {
    mode,
    generatedAt,
    positioningMirror,
    icpSignals = [],
    surfaces,
    competitorGap,
    actions,
    score,
    channelOpportunities = { keywordClusters: [], communitiesByEngagement: [] },
    searchVisibility,
    fetchDegraded,
  } = input;

  return {
    mode,
    generatedAt,
    whatYouOffer: {
      positioningMirror,
    },
    whoItsFor: {
      summary: buildWhoSummary(icpSignals, positioningMirror.reviewsValue),
      signals: icpSignals.slice(0, 6),
    },
    whereTheyAre: {
      surfaces,
      competitorGap,
    },
    whatToDoThisWeek: bucketActions(actions),
    score,
    channelOpportunities,
    // Attach whenever the gather ran (free web scans always pass it) so a site that
    // ranks for NOTHING still renders the "Google ranks you for 0 searches" zero-state
    // instead of hiding the section. The caller passes undefined for non-web.
    ...(searchVisibility ? { searchVisibility } : {}),
    // Part C — only attach when true, so an older/app-mode report's shape stays
    // unchanged (the `?? false` at the render props boundary handles absence).
    ...(fetchDegraded ? { fetchDegraded } : {}),
  };
}

// ---------------------------------------------------------------------------
// Executive summary (ChannelIntel UX — the report's "page 1")
// ---------------------------------------------------------------------------

/** One competitor line for the executive summary scorecard. */
export interface ExecSummaryCompetitor {
  domain: string;
  organicKeywords: number | null;
  etv: number | null;
}

/** The top-of-report scorecard — derived purely from an (already redacted) report. */
export interface ExecutiveSummary {
  score: {
    total: number;
    /** Anti-vanity verdict line (reuses the score-card caption). */
    verdict: string;
    breakdown: { content: number; outreach: number; seo: number };
  };
  /** Top rivals (≤3) with their organic-keyword + traffic-value proof. */
  topCompetitors: ExecSummaryCompetitor[];
  /** Your organic-keyword footprint vs the rival median (null when unknown). */
  traffic: { youKeywords: number; rivalMedianKeywords: number } | null;
  /** The single highest-leverage move (null when nothing actionable surfaced). */
  biggestGap: string | null;
  /** 1–2 quick-win titles to act on now. */
  quickWins: string[];
}

function medianOf(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/**
 * Build the executive-summary scorecard from a report payload. PURE.
 *
 * Works on a report that has ALREADY been redacted for the viewer's tier, so the
 * free teaser shows real numbers (score, top-3 rivals, traffic) while the paid
 * payoff (the ranked biggest-gap, full quick-win set) flows through unchanged.
 * Degrades gracefully when there's no market analysis (app-mode / older scans).
 */
export function buildExecutiveSummary(report: ReportPayload): ExecutiveSummary {
  const market = report.market;

  // Top competitors — prefer the rich market cohort, else the competitor gap.
  const topCompetitors: ExecSummaryCompetitor[] = market
    ? market.cohort.competitors.slice(0, 3).map((c) => ({
        domain: c.domain,
        organicKeywords: c.seo?.organicKeywords ?? null,
        etv: c.seo?.etv ?? null,
      }))
    : report.whereTheyAre.competitorGap.slice(0, 3).map((g) => ({
        domain: g.competitor,
        organicKeywords: null,
        etv: null,
      }));

  // You-vs-rival-median organic-keyword footprint (only with real SEO data).
  let traffic: ExecutiveSummary["traffic"] = null;
  if (market?.cohort.self.seo) {
    const rivalKw = market.cohort.competitors
      .map((c) => c.seo?.organicKeywords)
      .filter((n): n is number => typeof n === "number");
    if (rivalKw.length > 0) {
      traffic = {
        youKeywords: market.cohort.self.seo.organicKeywords,
        rivalMedianKeywords: medianOf(rivalKw),
      };
    }
  }

  // Biggest gap — the ranked plan's #1, else the top keyword gap, else the
  // strongest competitor-mention gap (the teaser hook free still gets).
  let biggestGap: string | null = null;
  if (market?.plan.items[0]) {
    biggestGap = market.plan.items[0].title;
  } else if (market?.gap.keywordGap[0]) {
    biggestGap = `Rank for "${market.gap.keywordGap[0].keyword}" (${market.gap.keywordGap[0].volume.toLocaleString()}/mo)`;
  } else {
    const losing = report.whereTheyAre.competitorGap.find((g) => g.them > g.you);
    if (losing) biggestGap = `Close the gap with ${losing.competitor}`;
  }

  const quickWins = report.whatToDoThisWeek.quickWins.slice(0, 2).map((a) => a.title);

  return {
    score: {
      total: report.score.total,
      verdict: buildCaption(report.score.total),
      breakdown: report.score.breakdown,
    },
    topCompetitors,
    traffic,
    biggestGap,
    quickWins,
  };
}

/**
 * Persist a `ReportPayload` to `scans.report_payload` via the service-role
 * Supabase client. Throws on error.
 */
export async function persistReport(
  scanId: string,
  payload: ReportPayload,
): Promise<void> {
  const db = serverDb();
  const { error } = await db
    .from("scans")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({ report_payload: payload as unknown as any })
    .eq("id", scanId);

  if (error) {
    throw new Error(`persistReport: failed to write report_payload for scan ${scanId}: ${error.message}`);
  }
}
