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
import { buildCaption } from "@/lib/badge/score-card";
import { serverDb } from "@/lib/db/client";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** A competitor row for the full competitive landscape (paid deep section). */
export interface CompetitiveLandscapeRow {
  competitor: string;
  positioning: string | null;
  gap: string | null;
  /** Community-mention count (the "them" signal). */
  communityMentions: number;
  /** Creators/influencers that cover this competitor (outreach targets). */
  creators: Array<{ name: string; url: string }>;
  /**
   * On the free teaser, `creators` is emptied and this carries the original
   * count so the section can render "{n} creators reach their audience — see
   * all". Absent (undefined) on the full/paid payload.
   */
  lockedCreatorCount?: number;
}

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

/** A creator/influencer to reach (paid deep section). */
export interface CreatorReach {
  name: string;
  url: string;
  coveredCompetitor: string;
  audienceProxy: number;
}

export interface ReviewTheme {
  theme: string;
  quote: string;
}

/** What you do well vs poorly (paid deep section). */
export interface StrengthsAndWeaknesses {
  strengths: ReviewTheme[];
  weaknesses: ReviewTheme[];
  mixed: ReviewTheme[];
  diagnostics: Array<{ category: string; claim: string; confidence: number }>;
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
  /** Q4 — What to do this week (bucketed by effort) */
  whatToDoThisWeek: {
    /** effortMin < 30 — §10.3 quick wins */
    quickWins: ActionCard[];
    /** effortMin 30..120 — medium horizon */
    medium: ActionCard[];
    /** effortMin > 120 — long play */
    longPlay: ActionCard[];
  };
  score: VerifiedScore;

  // ── Deep sections — surfaced from already-computed data (paid; teaser-locked) ──
  // Optional: reports persisted before this feature won't carry them, so every
  // consumer must null-coalesce (`?? []`).
  /** Full competitive landscape — all competitors with positioning + distribution. */
  competitiveLandscape?: CompetitiveLandscapeRow[];
  /** Channel & keyword opportunities — keyword clusters + communities by engagement. */
  channelOpportunities?: ChannelOpportunities;
  /** Influencers/creators to reach. */
  creatorsToReach?: CreatorReach[];
  /** What you do well vs poorly — review sentiment + diagnostic findings. */
  strengthsAndWeaknesses?: StrengthsAndWeaknesses;

  // ── M4 market analysis — deep cohort (you + prominent rivals) + demand + gap +
  // plan. Present only on paid deep scans (flag-gated). Supersedes the lighter
  // competitiveLandscape/channelOpportunities/creators sections when present.
  market?: MarketAnalysis;

  /** Competitive distribution intel (category, scored competitors, channels).
   *  Computed post-persist by attachCompetitiveIntel; lets the dashboard render
   *  instantly instead of live-fetching. */
  competitiveIntel?: CompetitiveIntelPayload;
}

interface ScoredEntityShape {
  domain: string;
  isSubject: boolean;
  monthlyTraffic: number;
  score: number;
  band: string;
  mix: {
    organic: number;
    referral: number;
    social: number;
    direct: number;
    organicKeywords: number;
    referringDomains: number;
    socialMentions: number;
  } | null;
}

export interface CompetitiveIntelPayload {
  generatedAt: string;
  category: string;
  subject: ScoredEntityShape;
  competitors: ScoredEntityShape[];
  actionableChannels: Array<{ host: string; type: string; action: string; competitorsUsing: number; reachWeight: number }>;
}

// ---------------------------------------------------------------------------
// Bucketing helper (§10.3 horizon mix)
// ---------------------------------------------------------------------------

function bucketActions(actions: ActionCard[]): ReportPayload["whatToDoThisWeek"] {
  const quickWins: ActionCard[] = [];
  const medium: ActionCard[] = [];
  const longPlay: ActionCard[] = [];

  for (const action of actions) {
    if (action.effortMin < 30) {
      quickWins.push(action);
    } else if (action.effortMin <= 120) {
      medium.push(action);
    } else {
      longPlay.push(action);
    }
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
  findings: Finding[];
  icpSignals: string[];
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
  competitiveLandscape?: CompetitiveLandscapeRow[];
  channelOpportunities?: ChannelOpportunities;
  creatorsToReach?: CreatorReach[];
  reviewThemes?: { strengths: ReviewTheme[]; weaknesses: ReviewTheme[]; mixed: ReviewTheme[] };
}): ReportPayload {
  const {
    mode,
    generatedAt,
    positioningMirror,
    findings,
    icpSignals,
    surfaces,
    competitorGap,
    actions,
    score,
    competitiveLandscape = [],
    channelOpportunities = { keywordClusters: [], communitiesByEngagement: [] },
    creatorsToReach = [],
    reviewThemes = { strengths: [], weaknesses: [], mixed: [] },
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
    competitiveLandscape,
    channelOpportunities,
    creatorsToReach,
    strengthsAndWeaknesses: {
      strengths: reviewThemes.strengths,
      weaknesses: reviewThemes.weaknesses,
      mixed: reviewThemes.mixed,
      // The Cycle 2 findings were always passed in but never surfaced — they are
      // the diagnostic "what we found" layer of this section.
      diagnostics: findings.map((f) => ({
        category: f.category,
        claim: f.claim,
        confidence: f.confidence,
      })),
    },
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
