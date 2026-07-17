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
import { ensureDeepScan } from "@/lib/scan/deepen";
import { sendMagicLinkEmail } from "@/lib/email/resend";
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

  // ONE deepen policy for every checkout shape. The payment-first funnel knows
  // its scanId; the legacy in-app upgrade carries none (metadata is
  // { userId, plan, interval }), so the target can only be what the user OWNS.
  // Deepening by ownership covers both without a per-path branch — which is why
  // the legacy path silently never deepened at all before this.
  await deepenOwnedScans(userId);

  // `email` is always present on the payment-first shape (the only one that
  // opts into a link); the legacy shape resolves by id and passes false.
  if (sendMagicLink && !linkAlreadySent && email) {
    await sendOnboardingMagicLink(email);
    // Record the send BEFORE the next delivery can race us to it.
    const { error } = await db
      .from("users")
      .update({ onboarding_link_sent_at: new Date().toISOString() })
      .eq("id", userId);
    if (error) console.error("[provision] failed to record onboarding_link_sent_at", error.message);
  }

  return userId;
}

/**
 * Deepen every scan this user owns that hasn't had the deep pass yet.
 *
 * The SINGLE post-checkout deepen policy — the deliberate mirror of
 * `resolveProductScan` (lib/app/add-product.ts), which exists because two
 * dedupe paths drifted apart. The same drift had happened here: only the
 * payment-first branch deepened (via its session scanId), so a logged-in free
 * user upgrading from the paywall got NO deep pass, ever, and nothing
 * re-triggered it — their paid dashboard rendered free data.
 *
 * Idempotent by construction: `ensureDeepScan` no-ops once `deepened_at` is
 * stamped, so already-deep scans cost nothing and redelivery is safe. Failures
 * degrade (logged, never thrown): a checkout must never 500 because a deepen
 * couldn't be queued — the webhook's mark-after-success ledger would then
 * replay the whole provisioning.
 */
async function deepenOwnedScans(userId: string): Promise<void> {
  const db = serverDb();
  try {
    const { data: user } = await db.from("users").select("app_ids").eq("id", userId).maybeSingle();
    const appIds: string[] = user?.app_ids ?? [];
    if (appIds.length === 0) return;

    const { data: scans } = await db
      .from("scans")
      .select("id, app_id, completed_at")
      .in("app_id", appIds)
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false });

    // Latest completed scan per app — that's the one the dashboard renders.
    const latestByApp = new Map<string, string>();
    for (const s of scans ?? []) {
      const appId = s.app_id as string;
      if (!latestByApp.has(appId)) latestByApp.set(appId, s.id as string);
    }

    for (const scanId of latestByApp.values()) {
      await ensureDeepScan(scanId);
    }
  } catch (e) {
    console.error("[provision] deepenOwnedScans failed", e);
  }
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
export async function sendOnboardingMagicLink(email: string): Promise<void> {
  try {
    const db = serverDb();
    const { data, error } = await db.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo: `${env.appUrl}/welcome` },
    });

    const tokenHash = data?.properties?.hashed_token;
    if (error || !tokenHash) {
      console.error("[provision] generateLink failed", error?.message);
      return;
    }

    const link =
      `${env.appUrl}/auth/confirm?token_hash=${encodeURIComponent(tokenHash)}` +
      `&type=magiclink&next=${encodeURIComponent("/welcome")}`;

    await sendMagicLinkEmail({ to: email, link });
  } catch (e) {
    console.error("[provision] sendOnboardingMagicLink failed (best-effort)", e);
  }
}
