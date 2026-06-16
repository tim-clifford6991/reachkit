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
 * - Sends the onboarding magic link when `sendMagicLink` is true (default).
 */
export async function provisionCheckoutUser({
  email,
  scanId,
  stripeCustomerId,
  stripeSubscriptionId,
  entitlement,
  sendMagicLink = true,
}: {
  email: string;
  scanId?: string | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  entitlement?: { tier: string; status: string };
  sendMagicLink?: boolean;
}): Promise<string> {
  const db = serverDb();
  const userId = await ensureAuthUser(email);

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
      // Two-track split: the scan ran the cheap free teaser. Now that the user
      // has paid, deepen it (idempotent) to produce the full report.
      await ensureDeepScan(scanId);
    } catch (e) {
      console.error("[provision] linkScanToUser/ensureDeepScan failed", e);
    }
  }

  if (sendMagicLink) {
    await sendOnboardingMagicLink(email);
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
