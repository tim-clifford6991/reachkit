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
import { env } from "@/lib/config/env";

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
 * - `active` is true for a paid tier whose subscription is `"active"`, OR
 *   `"past_due"` still within the payment-failed GRACE window (so a recoverable
 *   failed charge doesn't instantly lock the user out — the #1 involuntary-churn
 *   cause). There is NO trial: checkout charges immediately, so `"trialing"` is
 *   never granted access.
 */
export async function entitlementsFor(userId: string): Promise<Entitlements> {
  const { data: row } = await serverDb()
    .from("users")
    .select("tier, subscription_status, current_period_end")
    .eq("id", userId)
    .maybeSingle();

  const rawTier = row?.tier ?? "free";
  const tier: Tier = isTier(rawTier) ? rawTier : "free";
  const status = row?.subscription_status ?? null;
  const active = isPaid(tier) && isSubscriptionActive(status, row?.current_period_end ?? null, env.billingGraceDays);

  return { tier, limits: TIER_LIMITS[tier], active };
}

/**
 * Is a subscription in a state that grants access? PURE (grace days injected) +
 * exported for tests.
 * - `"active"` → yes.
 * - `"past_due"` → yes ONLY while within the grace window (period end +
 *   `graceDays`), so a transient failed renewal keeps access instead of
 *   revoking instantly. Out of grace → no.
 * - anything else (incl. `"trialing"`, `"canceled"`, `"unpaid"`, null) → no.
 */
export function isSubscriptionActive(
  status: string | null,
  currentPeriodEnd: string | null,
  graceDays: number,
  now: number = Date.now(),
): boolean {
  if (status === "active") return true;
  if (status === "past_due") {
    if (!currentPeriodEnd) return false;
    const end = new Date(currentPeriodEnd).getTime();
    return Number.isFinite(end) && now < end + graceDays * 24 * 60 * 60 * 1000;
  }
  return false;
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
 *   {@link FREE_PREVIEW_ACTIONS} preview actions, with every previewed action's
 *   `draft` set to null. All other sections stay full.
 *
 * Preview SELECTION is opportunity-aware (2026-07-22): the free board leads with
 * up to 2 data-driven keyword growth moves (actions carrying `.opportunity` — a
 * real category/niche keyword + its search volume, highest-demand first), then
 * fills to {@link FREE_PREVIEW_ACTIONS} with the best remaining on-page/other
 * fixes (kept in their original quick→medium→long bucket order), topping up with
 * more opportunities only if there aren't enough other fixes. This is the ONE
 * place that decides which 3 the free tier sees — previously it took the first 3
 * by effort bucket, so which fixes showed was an accident of effort (spacex.com
 * rendered 2 hygiene fixes; plausible.io rendered 3 near-duplicate keyword
 * opportunities). A report with no opportunity actions (every corpus fixture,
 * captured before the field existed) is unaffected: opps is empty, so the
 * selection is exactly the old first-3-by-bucket order.
 *
 * Never mutates the input.
 */
export function redactReportForTier(
  payload: ReportPayload,
  tier: Tier,
): ReportPayload {
  if (isPaid(tier)) return payload;

  const b = payload.whatToDoThisWeek;
  // Original bucket order (quick → medium → long) — the tie-break for non-
  // opportunity fixes, so a no-opportunity report keeps the exact old selection.
  const all = [...b.quickWins, ...b.medium, ...b.longPlay];
  const opps = all
    .filter((a) => a.opportunity)
    .sort((x, y) => (y.opportunity!.volume) - (x.opportunity!.volume));
  const otherFixes = all.filter((a) => !a.opportunity); // original bucket order
  const chosen = [...opps.slice(0, 2), ...otherFixes];
  if (chosen.length < FREE_PREVIEW_ACTIONS) chosen.push(...opps.slice(2));
  const keep = new Set(chosen.slice(0, FREE_PREVIEW_ACTIONS));

  // Preserve the bucket structure (downstream flattens it) — keep only the
  // chosen preview actions in their original bucket + order, draft-locked.
  const pick = (bucket: ActionCard[]): ActionCard[] =>
    bucket.filter((a) => keep.has(a)).map(lockAction);
  const quickWins = pick(b.quickWins);
  const medium = pick(b.medium);
  const longPlay = pick(b.longPlay);

  return {
    ...payload,
    whatToDoThisWeek: { quickWins, medium, longPlay },
    // F2: the off-site "Market position" grade is paid-only value — never leak the
    // exact number on the free/public teaser.
    marketPosition: null,
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
    // iteration 2 — Search Visibility IS the free-tier value (subject-only footprint
    // split + category gap, no rival data), so it passes through to the free view
    // via the `...payload` spread above. Nothing to gate here.
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
