import { Resend } from "resend";
import { env } from "@/lib/config/env";
import { fixturesEnabled } from "@/lib/dev/fixtures";

const FROM = "ReachKit <reports@reachkit.app>";

/** Escape a string for safe interpolation into HTML (appName originates from a
 *  scraped store listing, so it must never be trusted in the HTML body). */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

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
  if (fixturesEnabled()) {
    console.log("[email:fixture] magic-link →", { to, link });
    return;
  }

  const subject = "Your ReachKit login link";
  const text = [
    "Welcome to ReachKit — your free trial is active.",
    "",
    `Click here to log in and open your dashboard: ${link}`,
    "",
    "This link signs you in automatically. If you didn't start a trial, you can ignore this email.",
    "",
    "— The ReachKit team",
  ].join("\n");
  const html = [
    `<h2>Welcome to ReachKit</h2>`,
    `<p>Your free trial is active. Click below to log in and open your dashboard.</p>`,
    `<p><a href="${link}">Log in to ReachKit</a></p>`,
    `<p>This link signs you in automatically. If you didn't start a trial, you can ignore this email.</p>`,
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

/**
 * Pre-charge reminder for a trial that's about to convert. Fired off the Stripe
 * `customer.subscription.trial_will_end` webhook (~3 days before the first
 * charge). Honest, low-friction: it reminds the user the trial is ending, when
 * the card will be charged, and links straight to the billing page where they
 * can manage or cancel in one click. In fixtures mode it just logs.
 */
export async function sendTrialEndingEmail({
  to,
  trialEndsAt,
  manageUrl,
}: {
  to: string;
  /** ISO timestamp the trial ends / first charge lands (null if unknown). */
  trialEndsAt: string | null;
  /** Absolute URL to the billing page (manage / cancel). */
  manageUrl: string;
}): Promise<void> {
  if (fixturesEnabled()) {
    console.log("[email:fixture] trial-ending →", { to, trialEndsAt, manageUrl });
    return;
  }

  const when = formatTrialEnd(trialEndsAt);
  const subject = "Your ReachKit trial ends soon";
  const text = [
    "Your ReachKit free trial is ending soon.",
    "",
    when
      ? `Your card will be charged on ${when} and your weekly monitoring continues uninterrupted.`
      : "Your card will be charged shortly and your weekly monitoring continues uninterrupted.",
    "",
    "Want more first? Each week we re-scan your app, surface what changed, and refresh your action queue with draft copy.",
    "",
    `Manage or cancel your plan any time (one click): ${manageUrl}`,
    "",
    "— The ReachKit team",
  ].join("\n");
  const html = [
    `<h2>Your ReachKit trial ends soon</h2>`,
    when
      ? `<p>Your card will be charged on <strong>${escapeHtml(when)}</strong> and your weekly monitoring continues uninterrupted.</p>`
      : `<p>Your card will be charged shortly and your weekly monitoring continues uninterrupted.</p>`,
    `<p>Each week we re-scan your app, surface what changed, and refresh your action queue with draft copy.</p>`,
    `<p><a href="${manageUrl}">Manage or cancel your plan</a> any time — one click, no questions.</p>`,
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

/** Human-readable trial-end date (e.g. "June 23, 2026"), or null when unknown. */
function formatTrialEnd(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export async function sendScanReadyEmail({
  to,
  scanId,
  appName,
  reportUrl,
}: {
  to: string;
  scanId: string;
  appName: string;
  reportUrl: string;
}): Promise<void> {
  if (fixturesEnabled()) {
    console.log("[email:fixture] scan-ready →", { to, scanId, reportUrl });
    return;
  }

  const subject = `Your ReachKit scan for ${appName} is ready`;
  const text = [
    `Your ReachKit scan for ${appName} is ready.`,
    "",
    `View your full report here: ${reportUrl}`,
    "",
    "— The ReachKit team",
  ].join("\n");
  const safeAppName = escapeHtml(appName);
  const html = [
    `<h2>Your ReachKit scan for ${safeAppName} is ready</h2>`,
    `<p>Your full scan report is available. Click the link below to view it.</p>`,
    `<p><a href="${reportUrl}">${reportUrl}</a></p>`,
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
