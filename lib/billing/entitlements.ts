/**
 * Tier entitlements + report redaction (Cycle 4 Task 6).
 *
 * `entitlementsFor` / `assertPaid` / `assertCanAddApp` resolve a user's tier
 * and gate paid surfaces (queue, refresh, multi-app). `redactReportForTier`
 * is PURE (no DB): it blur-locks the free report by capping the action plan to
 * a small preview with drafts nulled, while leaving the analysis sections full.
 */

import { TIER_LIMITS, isPaid, isTier, type Tier, type TierLimit } from "@/lib/billing/tiers";
import type { ReportPayload, CompetitiveLandscapeRow } from "@/lib/scan/report";
import type { ActionCard } from "@/lib/llm/types";
import type { MarketAnalysis } from "@/lib/scan/gap";
import type { DistributionProfile } from "@/lib/scan/profile";
import type { DemandPocket } from "@/lib/scan/demand/types";
import { serverDb } from "@/lib/db/client";

export class EntitlementError extends Error {
  constructor(msg = "upgrade required") {
    super(msg);
    this.name = "EntitlementError";
  }
}

export interface Entitlements {
  tier: Tier;
  limits: TierLimit;
  active: boolean;
}

/** Number of preview action cards a free viewer sees before the upgrade wall. */
const FREE_PREVIEW_ACTIONS = 3;
/** Preview slice sizes for the deep sections shown locked on the free teaser. */
const FREE_PREVIEW_KEYWORD_CLUSTERS = 1;
const FREE_PREVIEW_COMMUNITIES = 2;
const FREE_PREVIEW_CREATORS = 2;
const FREE_PREVIEW_THEMES = 1;
/** Market teaser slice sizes for the free report. */
const FREE_PREVIEW_COMPETITORS = 3;
const FREE_PREVIEW_POCKETS = 5;

// ---------------------------------------------------------------------------
// DB-backed entitlement resolution
// ---------------------------------------------------------------------------

/**
 * Resolve a user's entitlements from their `users` row.
 *
 * - `tier` is coerced via `isTier` (unknown → "free").
 * - `active` is true only for a paid tier whose subscription is live
 *   ("active" or "trialing").
 */
export async function entitlementsFor(userId: string): Promise<Entitlements> {
  const { data: row } = await serverDb()
    .from("users")
    .select("tier, subscription_status")
    .eq("id", userId)
    .maybeSingle();

  const rawTier = row?.tier ?? "free";
  const tier: Tier = isTier(rawTier) ? rawTier : "free";
  const status = row?.subscription_status ?? null;
  const active =
    isPaid(tier) && (status === "active" || status === "trialing");

  return { tier, limits: TIER_LIMITS[tier], active };
}

/** Throw `EntitlementError` unless the user has an active paid subscription. */
export async function assertPaid(userId: string): Promise<void> {
  const { active } = await entitlementsFor(userId);
  if (!active) throw new EntitlementError();
}

/**
 * Throw `EntitlementError` if the user is already tracking the max apps their
 * tier allows (`users.app_ids.length >= limits.apps`).
 */
export async function assertCanAddApp(userId: string): Promise<void> {
  const { limits } = await entitlementsFor(userId);
  const { data: row } = await serverDb()
    .from("users")
    .select("app_ids")
    .eq("id", userId)
    .maybeSingle();

  const appIds = row?.app_ids ?? [];
  if (appIds.length >= limits.apps) {
    throw new EntitlementError("app limit reached for your plan");
  }
}

// ---------------------------------------------------------------------------
// Report redaction (PURE — no DB)
// ---------------------------------------------------------------------------

/** Blur-lock a single action card for preview: strip the draft. */
function lockAction(action: ActionCard): ActionCard {
  return { ...action, draft: null };
}

/**
 * Redact a report for the viewer's tier.
 *
 * - Paid → returned unchanged (same reference).
 * - Free → a fresh copy whose `whatToDoThisWeek` is capped to
 *   {@link FREE_PREVIEW_ACTIONS} preview actions total, drawn in order from
 *   quickWins → medium → longPlay (bucket structure preserved), with every
 *   previewed action's `draft` set to null. All other sections
 *   (`whatYouOffer`, `whoItsFor`, `whereTheyAre`, `score`) stay full.
 *
 * Never mutates the input.
 */
export function redactReportForTier(
  payload: ReportPayload,
  tier: Tier,
): ReportPayload {
  if (isPaid(tier)) return payload;

  let remaining = FREE_PREVIEW_ACTIONS;
  const take = (bucket: ActionCard[]): ActionCard[] => {
    if (remaining <= 0) return [];
    const slice = bucket.slice(0, remaining).map(lockAction);
    remaining -= slice.length;
    return slice;
  };

  // Order matters: quickWins fill first, then medium, then longPlay.
  const quickWins = take(payload.whatToDoThisWeek.quickWins);
  const medium = take(payload.whatToDoThisWeek.medium);
  const longPlay = take(payload.whatToDoThisWeek.longPlay);

  return {
    ...payload,
    whatToDoThisWeek: { quickWins, medium, longPlay },
    // Deep sections. The competitive landscape is "tease the question, gate the
    // answer": free keeps WHICH rivals + their mention counts (the proof), but
    // the exact opening text and the creators-to-reach are gated. The other
    // three are truncated to a small locked preview.
    competitiveLandscape: redactLandscape(payload.competitiveLandscape),
    channelOpportunities: redactChannels(payload.channelOpportunities),
    creatorsToReach: (payload.creatorsToReach ?? []).slice(0, FREE_PREVIEW_CREATORS),
    strengthsAndWeaknesses: redactStrengths(payload.strengthsAndWeaknesses),
    // M4 market analysis — free now gets a deliberate TEASER (the ChannelIntel
    // free scan: top-3 competitors + channels + traffic + demand-pocket headlines
    // + the channel matrix + share-of-voice), with the paid payoff gated
    // (backlink detail, thread excerpts, the ranked distribution plan).
    market: redactMarket(payload.market),
  };
}

// ---------------------------------------------------------------------------
// Market-analysis redaction (PURE)
// ---------------------------------------------------------------------------

/** Strip a profile's paid-only SEO detail (backlink authority + referring
 *  domains, plus the ranked-keywords + top-pages deep signals); keep the
 *  organic-keyword + traffic (ETV) numbers as the free proof. The `seo` object is
 *  rebuilt with only the four free fields, so `rankedKeywords`/`topPages` are
 *  dropped by construction (they power the paid keyword-gap + top-pages sections). */
function redactProfile(p: DistributionProfile): DistributionProfile {
  const { marketplace, ...rest } = p;
  void marketplace; // launch/marketplace presence is a paid signal
  return {
    ...rest,
    seo: p.seo
      ? { organicKeywords: p.seo.organicKeywords, etv: p.seo.etv, authority: null, referringDomains: null }
      : p.seo,
  };
}

/** Strip a demand pocket's representative threads (the paid "sample posts"),
 *  keeping its headline surface + counts as the teaser. */
function redactPocket(pk: DemandPocket): DemandPocket {
  return { ...pk, topThreads: [] };
}

/**
 * Free-tier market teaser. Keeps the proof — top-{@link FREE_PREVIEW_COMPETITORS}
 * competitors with their channels + traffic numbers, the you-vs-rivals channel
 * matrix, share-of-voice, and demand-pocket headlines — and gates the answer:
 * backlink detail, thread excerpts, channel gaps, and the ranked distribution
 * plan (the paid payoff). PURE; never mutates the input. Undefined passes through.
 */
export function redactMarket(market: MarketAnalysis | undefined): MarketAnalysis | undefined {
  if (!market) return market;
  const competitors = market.cohort.competitors
    .slice(0, FREE_PREVIEW_COMPETITORS)
    .map(redactProfile);
  return {
    cohort: {
      ...market.cohort,
      self: redactProfile(market.cohort.self),
      competitors,
      competitorDomains: market.cohort.competitorDomains.slice(0, FREE_PREVIEW_COMPETITORS),
    },
    demand: {
      ...market.demand,
      pockets: market.demand.pockets.slice(0, FREE_PREVIEW_POCKETS).map(redactPocket),
    },
    gap: {
      ...market.gap,
      // channelGaps + keywordGap drive the paid playbook; matrix + SOV stay as proof.
      channelGaps: [],
      keywordGap: [],
      demandPockets: market.gap.demandPockets.slice(0, FREE_PREVIEW_POCKETS).map(redactPocket),
    },
    // The ranked distribution plan + recent-buzz freshness are paid payoffs.
    plan: { items: [] },
    recentBuzz: [],
  };
}

/**
 * Free-tier competitive landscape: keep the provocation (competitor name,
 * positioning, mention count), gate the answer — null the `gap` opening text
 * and empty `creators`, preserving the creator count via `lockedCreatorCount`.
 */
function redactLandscape(
  rows: CompetitiveLandscapeRow[] | undefined,
): CompetitiveLandscapeRow[] | undefined {
  if (!rows) return rows;
  return rows.map((r) => ({
    competitor: r.competitor,
    positioning: r.positioning,
    communityMentions: r.communityMentions,
    gap: null,
    creators: [],
    lockedCreatorCount: r.creators.length,
  }));
}

/** Free-tier preview of the channel section: 1 cluster with cpc/competition
 *  stripped, 2 communities — enough to tease, not enough to use. */
function redactChannels(
  channels: ReportPayload["channelOpportunities"],
): ReportPayload["channelOpportunities"] {
  if (!channels) return channels;
  return {
    keywordClusters: channels.keywordClusters
      .slice(0, FREE_PREVIEW_KEYWORD_CLUSTERS)
      .map((c) => ({
        theme: c.theme,
        keywords: c.keywords.map((k) => ({ ...k, cpc: 0, competition: 0 })),
      })),
    communitiesByEngagement: channels.communitiesByEngagement.slice(0, FREE_PREVIEW_COMMUNITIES),
  };
}

/** Free-tier preview of strengths/weaknesses: 1 of each, quotes stripped,
 *  diagnostics hidden. */
function redactStrengths(
  sw: ReportPayload["strengthsAndWeaknesses"],
): ReportPayload["strengthsAndWeaknesses"] {
  if (!sw) return sw;
  const noQuote = (t: { theme: string; quote: string }) => ({ theme: t.theme, quote: "" });
  return {
    strengths: sw.strengths.slice(0, FREE_PREVIEW_THEMES).map(noQuote),
    weaknesses: sw.weaknesses.slice(0, FREE_PREVIEW_THEMES).map(noQuote),
    mixed: [],
    diagnostics: [],
  };
}
