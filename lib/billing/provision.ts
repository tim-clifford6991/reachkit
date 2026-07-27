/**
 * Account provisioning for the payment-first funnel (Stripe → Email → Magic Link).
 *
 * After an anonymous Stripe checkout completes, there is no logged-in user yet —
 * only the email Stripe collected. These helpers create-or-find the Supabase
 * account from that email, bind the Stripe ids, link the scanned app (if the
 * checkout carried a scanId), and send the onboarding magic link.
 *
 * Every step is idempotent so the Stripe webhook and the fixtures checkout path
 * can both call `provisionCheckoutUser` (and the webhook can be redelivered)
 * without creating duplicates.
 */

import { serverDb } from "@/lib/db/client";
import { env } from "@/lib/config/env";
import { linkScanToUser } from "@/lib/auth/profile";
import { sendLoginLink } from "@/lib/auth/login-link";
import type { Database } from "@/lib/db/types";

type UsersUpdate = Database["public"]["Tables"]["users"]["Update"];

/**
 * Create-or-find the auth user for an email; returns the `public.users` id.
 *
 * Idempotent: `auth.admin.createUser` creates the auth user (the `handle_new_user`
 * trigger inserts the matching `public.users` row); on "already registered" we
 * resolve the existing id via the `public.users` row.
 */
export async function ensureAuthUser(email: string): Promise<string> {
  const db = serverDb();

  const created = await db.auth.admin.createUser({ email, email_confirm: true });
  if (created.data?.user) return created.data.user.id;

  // Already registered (or a transient create error): resolve the trigger-created row.
  const { data: existing } = await db
    .from("users")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (existing?.id) return existing.id;

  throw new Error(
    `ensureAuthUser: could not create or find user for ${email}: ${created.error?.message ?? "unknown error"}`,
  );
}

/**
 * Provision a user from a completed checkout. Returns the resolved userId.
 *
 * - Ensures the account exists.
 * - Binds Stripe customer/subscription ids when provided.
 * - Sets tier/status when `entitlement` is provided (fixtures path only — in
 *   live mode the `customer.subscription.*` webhook is the source of truth).
 * - Links the scanned app when `scanId` is provided.
 * - Sends the onboarding magic link when `sendMagicLink` is true (default) —
 *   but only on the FIRST provisioning of a given Stripe customer. Stripe
 *   redelivers `checkout.session.completed` at-least-once (retries on a
 *   non-2xx, or a manual "Resend" from the dashboard), and every redelivery
 *   re-enters this function with the same `stripeCustomerId`. Without this
 *   guard each redelivery would re-send the login email — annoying, and on a
 *   flaky window potentially several emails for one purchase. `ensureAuthUser`
 *   and the scan-link/deepen calls below are already idempotent no-ops on
 *   retry; this closes the same gap for the one side effect that wasn't.
 */
export async function provisionCheckoutUser({
  userId: knownUserId = null,
  email,
  scanId,
  stripeCustomerId,
  stripeSubscriptionId,
  entitlement,
  sendMagicLink = true,
}: {
  /** Pre-resolved user (legacy in-app upgrade, `metadata.userId`). When absent
   *  the account is created-or-found from `email` (payment-first funnel). */
  userId?: string | null;
  /** Required unless `userId` is given — the payment-first funnel has only this. */
  email?: string | null;
  scanId?: string | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  entitlement?: { tier: string; status: string };
  sendMagicLink?: boolean;
}): Promise<string> {
  const db = serverDb();
  if (!knownUserId && !email) {
    throw new Error("provisionCheckoutUser: one of userId or email is required");
  }
  const userId = knownUserId ?? (await ensureAuthUser(email as string));

  // Has the onboarding link already gone out? This reads a RECORDED fact, never
  // a proxy. It used to infer "redelivery" from `stripe_customer_id` already
  // being bound — but the sibling `customer.subscription.*` handler ALSO binds
  // that column (webhook.ts, defensive create) while explicitly deferring the
  // email to us ("No magic link is sent here — the checkout.session.completed
  // handler owns that"). Stripe doesn't guarantee ordering, so a
  // subscription-first delivery made us read a bound column, conclude
  // "redelivery", and send nothing: each half assumed the other would, and the
  // user paid and could never log in. "Did ensureAuthUser create the account?"
  // is poisoned identically (the defensive create calls it too) — both proxies
  // are unreliable, so we record the fact instead of inferring it.
  const { data: existing } = await db
    .from("users")
    .select("onboarding_link_sent_at")
    .eq("id", userId)
    .maybeSingle();
  const linkAlreadySent = existing?.onboarding_link_sent_at != null;

  const update: UsersUpdate = {};
  if (stripeCustomerId) update.stripe_customer_id = stripeCustomerId;
  if (stripeSubscriptionId) update.stripe_subscription_id = stripeSubscriptionId;
  if (entitlement) {
    update.tier = entitlement.tier;
    update.subscription_status = entitlement.status;
  }
  if (Object.keys(update).length > 0) {
    const { error } = await db.from("users").update(update).eq("id", userId);
    if (error) console.error("[provision] failed to bind user fields", error.message);
  }

  if (scanId) {
    try {
      await linkScanToUser(scanId, userId);
    } catch (e) {
      console.error("[provision] linkScanToUser failed", e);
    }
  }

  // Deep scan is DEFERRED to onboarding (2026-07-27, intake `unified-onboarding`).
  // It used to fire HERE, at payment, against a GUESSED competitor cohort (the
  // user hadn't picked yet) — so `report_payload.market` benchmarked against
  // rivals they never chose, and it was partly wasted. Now the onboarding Build
  // step drives the deep scan on the PICKED cohort (via /api/competitors/select →
  // ensureDeepScan, already the post-pick trigger). Safety net for an abandoned
  // onboarding: it's BLOCKING (they must complete it → the pick deepens), plus
  // the weekly self-heal (weekly-refresh → ensureDeepScan) catches any paid app
  // left un-deepened within 7 days. Provision keeps linkScanToUser (above) so the
  // pre-checkout free scan is enrolled and ready as the onboarding starting point.

  // `email` is always present on the payment-first shape (the only one that
  // opts into a link); the legacy shape resolves by id and passes false.
  if (sendMagicLink && !linkAlreadySent && email) {
    const sent = await sendOnboardingMagicLink(email);
    // Record the send ONLY on confirmed delivery — a swallowed Resend failure
    // must NOT be recorded as sent (that stranded a paying user with no login
    // link and no retry). On failure the column stays null, so the next Stripe
    // webhook retry re-runs this and re-attempts delivery. Record BEFORE the
    // next delivery can race us to it.
    if (sent) {
      const { error } = await db
        .from("users")
        .update({ onboarding_link_sent_at: new Date().toISOString() })
        .eq("id", userId);
      if (error) console.error("[provision] failed to record onboarding_link_sent_at", error.message);
    }
  }

  return userId;
}

/**
 * Generate and email a magic link that signs the user straight into the
 * dashboard. Uses an admin-generated `token_hash` confirmation URL (verified by
 * /auth/confirm via `verifyOtp`) rather than the PKCE `?code` flow, so it works
 * from any device with no client-side code_verifier.
 *
 * Best-effort: never throws. The account + scan link are already persisted by
 * the time this runs, and the user can re-request the link from /welcome — so a
 * transient generateLink/Resend failure must not fail the Stripe webhook.
 */
export async function sendOnboardingMagicLink(email: string): Promise<boolean> {
  // The ONE branded sender (lib/auth/login-link.ts) — same admin token_hash +
  // Resend path the /welcome resend uses. Returns false on any failure, so a
  // swallowed error is NOT recorded as sent and the Stripe webhook retry
  // re-delivers it (the onboarding_link_sent_at gate).
  return sendLoginLink(email, "/welcome");
}
