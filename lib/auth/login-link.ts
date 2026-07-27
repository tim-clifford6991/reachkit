/**
 * The ONE branded magic-login-link sender (2026-07-27). Admin-generated
 * `token_hash` link (verified by /auth/confirm) sent via RESEND with our branded
 * template — NOT Supabase's SMTP / default auth email. Used by BOTH the
 * post-checkout onboarding link (lib/billing/provision.ts) and the "/welcome
 * resend" route (app/api/auth/magic-link), so EVERY login email is identical and
 * on-brand, and there are ZERO Supabase-native auth emails to keep in sync.
 *
 * Cross-device safe (token_hash carries no PKCE code_verifier, unlike
 * signInWithOtp's `?code` flow). Login-only: `generateLink` requires the user to
 * already exist, so this never creates an account for an unknown email — correct
 * for a payment-first app. Returns true only on a confirmed send (callers that
 * record "link sent" must gate on it — see provision's onboarding_link_sent_at).
 */
import { serverDb } from "@/lib/db/client";
import { env } from "@/lib/config/env";
import { sendBrandedEmail } from "@/lib/email/resend";
import { loginLinkEmail } from "@/lib/email/messages";
import { safeRelativePath } from "@/lib/auth/safe-redirect";

export async function sendLoginLink(email: string, next = "/welcome"): Promise<boolean> {
  try {
    const dest = safeRelativePath(next, "/welcome");
    const db = serverDb();
    const { data, error } = await db.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo: `${env.appUrl}${dest}` },
    });

    const tokenHash = data?.properties?.hashed_token;
    if (error || !tokenHash) {
      // No account for this email (or a transient failure). Login-only: we don't
      // create one — the caller returns a generic "check your inbox" (no enumeration).
      console.error("[auth] sendLoginLink generateLink failed", error?.message);
      return false;
    }

    const link =
      `${env.appUrl}/auth/confirm?token_hash=${encodeURIComponent(tokenHash)}` +
      `&type=magiclink&next=${encodeURIComponent(dest)}`;

    // sendBrandedEmail throws on a Resend error → a failed send returns false.
    await sendBrandedEmail(email, loginLinkEmail({ link }));
    return true;
  } catch (e) {
    console.error("[auth] sendLoginLink failed (best-effort)", e);
    return false;
  }
}
