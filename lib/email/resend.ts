import { Resend } from "resend";
import { env } from "@/lib/config/env";
import { fixtures } from "@/lib/scan/fixture-seam";

const FROM = "ReachKit <reports@reachkit.app>";

export function resendClient() {
  return new Resend(env.resendApiKey);
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

  const subject = "Your ReachKit login link";
  const text = [
    "Welcome to ReachKit — your plan is active.",
    "",
    `Click here to log in and open your dashboard: ${link}`,
    "",
    "This link signs you in automatically. If you didn't request this, you can ignore this email.",
    "",
    "— The ReachKit team",
  ].join("\n");
  const html = [
    `<h2>Welcome to ReachKit</h2>`,
    `<p>Your plan is active. Click below to log in and open your dashboard.</p>`,
    `<p><a href="${link}">Log in to ReachKit</a></p>`,
    `<p>This link signs you in automatically. If you didn't request this, you can ignore this email.</p>`,
    `<p>— The ReachKit team</p>`,
  ].join("\n");

  const { error } = await resendClient().emails.send({
    from: FROM,
    to,
    subject,
    text,
    html,
  });

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }
}
