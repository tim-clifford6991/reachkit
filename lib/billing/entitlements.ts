/**
 * Tier entitlements + report redaction (Cycle 4 Task 6).
 *
 * `entitlementsFor` / `assertPaid` / `assertCanAddApp` resolve a user's tier
 * and gate paid surfaces (queue, refresh, multi-app). `redactReportForTier`
 * is PURE (no DB): it blur-locks the free report by capping the action plan to
 * a small preview with drafts nulled, while leaving the analysis sections full.
 */

import { TIER_LIMITS, isPaid, isTier, type Tier, type TierLimit } from "@/lib/billing/tiers";
import type { ReportPayload } from "@/lib/scan/report";
import type { ActionCard } from "@/lib/llm/types";
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
  };
}
