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
