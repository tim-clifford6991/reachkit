/**
 * Account HARD-DELETE (launch P3b).
 *
 * The user↔data link in this schema is NOT a foreign key — `users.app_ids` is a
 * `uuid[]` array, so deleting a `users` row cascades to NOTHING. Deletion is
 * therefore an explicit, ordered orchestration (verified against the live FK
 * graph 2026-07-15):
 *
 *   users ──app_ids[] (array, no cascade)──► apps ──CASCADE──► scans/actions/
 *     competitors/monitors/outcomes/score_snapshots/market_snapshots/embeddings
 *     └► scans ──CASCADE──► evidence/findings/scan_events/pipeline_runs/scan_signals
 *
 * Three things are NOT reached by an apps-only delete and are handled here:
 *  1. The Stripe subscription — cancelled FIRST so we never orphan a live sub
 *     that keeps billing a deleted account.
 *  2. The `auth.users` row — no FK from `public.users`; removed via the Admin API.
 *  3. `scans.claim_email` PII — a scan claimed by this user's email whose app was
 *     never added to `app_ids` (abandoned claim) would otherwise be left behind
 *     with the user's email in it; deleted explicitly by email.
 *
 * Global shared caches (raw_documents, fact_sheets, demand_intel,
 * distribution_profiles, search_cache, processed_stripe_events, NULL-app
 * embeddings) are content/domain-keyed cross-user data and are deliberately
 * left untouched — they carry no user identifier and deleting them harms others.
 *
 * Guard: tests/integration/account-delete.test.ts.
 */

import { serverDb } from "@/lib/db/client";
import { fixtures } from "@/lib/scan/fixture-seam";
import { assertStripeConfigured, stripeClient } from "@/lib/billing/stripe";

export class AccountNotFoundError extends Error {
  constructor(userId: string) {
    super(`account not found: ${userId}`);
    this.name = "AccountNotFoundError";
  }
}

export interface DeleteAccountResult {
  deletedApps: number;
  /** Claim-only scans removed by email (not reached via app_ids). */
  deletedClaimScans: number;
  canceledSubscription: boolean;
}

/**
 * Hard-delete the account for `userId`: cancel Stripe, revoke auth, remove every
 * owned row. Irreversible. Ordered so a mid-flight failure never leaves a live
 * subscription billing a session that still works — cancel + revoke happen
 * before any destructive DB write, and abort (throw) on a real failure.
 */
export async function deleteAccount(userId: string): Promise<DeleteAccountResult> {
  const db = serverDb();

  // 1. Load the user, capturing every identifier we need BEFORE deleting anything.
  const { data: user, error: loadErr } = await db
    .from("users")
    .select("id, email, app_ids, stripe_subscription_id")
    .eq("id", userId)
    .maybeSingle();
  if (loadErr) throw new Error(`deleteAccount: failed to load user: ${loadErr.message}`);
  if (!user) throw new AccountNotFoundError(userId);

  const email = user.email;
  const appIds = user.app_ids ?? [];
  const subscriptionId = user.stripe_subscription_id;

  // 2. Cancel the Stripe subscription first. Never orphan a live sub on a
  //    deleted account. Tolerate an already-gone sub; abort on any other error.
  let canceledSubscription = false;
  if (subscriptionId && !fixtures()) {
    assertStripeConfigured();
    try {
      await stripeClient().subscriptions.cancel(subscriptionId);
      canceledSubscription = true;
    } catch (e) {
      const err = e as { code?: string; statusCode?: number };
      const alreadyGone = err?.code === "resource_missing" || err?.statusCode === 404;
      if (!alreadyGone) {
        throw new Error(
          `deleteAccount: Stripe cancel failed for ${subscriptionId}: ${(e as Error).message}`,
        );
      }
    }
  }

  // 3. Revoke auth access — delete the Supabase auth user (no FK from public.users,
  //    so this is a separate call). Tolerate "not found" (already gone, or a
  //    profile row seeded without an auth user in tests); abort on other errors so
  //    we don't wipe DB rows while login still works.
  const { error: authErr } = await db.auth.admin.deleteUser(userId);
  if (authErr && authErr.status !== 404 && !/not.?found/i.test(authErr.message ?? "")) {
    throw new Error(`deleteAccount: auth user delete failed: ${authErr.message}`);
  }

  // 4. Delete claim-only scans (PII orphan — see file header). Cascades their
  //    subtree. No-op for the common case where every claimed scan's app is
  //    already in app_ids (step 5 would remove it anyway).
  let deletedClaimScans = 0;
  if (email) {
    const { data: claimScans, error: claimErr } = await db
      .from("scans")
      .delete()
      .eq("claim_email", email)
      .select("id");
    if (claimErr) throw new Error(`deleteAccount: claim-scan delete failed: ${claimErr.message}`);
    deletedClaimScans = claimScans?.length ?? 0;
  }

  // 5. Delete the user's apps — cascades the entire app→scan subtree.
  let deletedApps = 0;
  if (appIds.length > 0) {
    const { data: delApps, error: appErr } = await db
      .from("apps")
      .delete()
      .in("id", appIds)
      .select("id");
    if (appErr) throw new Error(`deleteAccount: app delete failed: ${appErr.message}`);
    deletedApps = delApps?.length ?? 0;
  }

  // 6. Delete the profile row (holds email + Stripe ids + onboarding PII).
  const { error: userErr } = await db.from("users").delete().eq("id", userId);
  if (userErr) throw new Error(`deleteAccount: user row delete failed: ${userErr.message}`);

  return { deletedApps, deletedClaimScans, canceledSubscription };
}
