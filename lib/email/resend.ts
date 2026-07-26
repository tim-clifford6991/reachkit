import { Resend } from "resend";
import { env } from "@/lib/config/env";
import { fixtures } from "@/lib/scan/fixture-seam";
import { loginLinkEmail, type BuiltEmail } from "@/lib/email/messages";

const FROM = "ReachKit <reports@reachkit.app>";

export function resendClient() {
  return new Resend(env.resendApiKey);
}

/**
 * The ONE send seam every ReachKit email routes through (intake
 * 2026-07-26-email-system). Takes a `BuiltEmail` (subject/html/text from
 * `lib/email/messages.ts`, already rendered through the branded shell) and sends
 * it via Resend. In fixtures/keyless dev it logs instead of sending. Throws on a
 * Resend error so callers that MUST confirm delivery (see the provision.ts
 * "recorded-as-sent" fix) can catch it — cron/best-effort callers wrap in try.
 */
export async function sendBrandedEmail(to: string, email: BuiltEmail): Promise<void> {
  if (fixtures()) {
    console.log("[email:fixture]", email.subject, "→", to);
    return;
  }
  const { error } = await resendClient().emails.send({
    from: FROM,
    to,
    subject: email.subject,
    html: email.html,
    text: email.text,
  });
  if (error) throw new Error(`Resend error: ${error.message}`);
}

/**
 * Send the post-checkout onboarding magic link. Used by the payment-first funnel
 * after Stripe checkout completes (Stripe → Email → Magic Link). The link is an
 * admin-generated token_hash confirmation URL (see lib/billing/provision.ts), so
 * it works cross-device with no PKCE verifier. In fixtures mode the link is just
 * logged so keyless dev can copy it.
 */
export async function sendMagicLinkEmail({
  to,
  link,
}: {
  to: string;
  link: string;
}): Promise<void> {
  if (fixtures()) {
    console.log("[email:fixture] magic-link →", { to, link });
    return;
  }
  // Branded template (intake 2026-07-26) — same token_hash link, now on-brand.
  await sendBrandedEmail(to, loginLinkEmail({ link }));
}
