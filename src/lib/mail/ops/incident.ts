// The owner's incident alert, sent (issue 330). Owner ruling 2026-09-15: no
// error-tracking vendor — Vercel's logs stay, and the existing mail seam
// tells `OWNER_EMAILS` when a job fails, when a job exhausts its retries,
// and when a deployment refuses to boot.
//
// **Nothing here throws.** The same rule as the spend alert beside it: a
// report about a failure must not become a second failure — not of the job
// being retried, and not of the boot whose own refusal is the news. Every
// arm ends in one log line naming the occasion and the outcome.
import { env } from "@/lib/config/env";
import { sendEmail } from "../send";
import { buildIncidentAlert, type OpsIncident } from "../templates/ops";

function log(occasion: OpsIncident["occasion"], outcome: string): void {
  console.warn(JSON.stringify({ event: "ops_incident_alert", occasion, outcome }));
}

/** An error's class name, never its message. */
export function errorNameOf(error: unknown): string {
  return error instanceof Error ? error.name : "unknown";
}

/** Whether at least one owner address was accepted by the seam — the
 *  answer a caller that carries its own once-ness stamps on (issue 796). */
export async function reportIncident(incident: OpsIncident): Promise<boolean> {
  const mail = buildIncidentAlert(incident);
  let owners: readonly string[];
  try {
    owners = env.OWNER_EMAILS;
  } catch {
    log(incident.occasion, "no-owners");
    return false;
  }
  let accepted = false;
  for (const to of owners) {
    try {
      const result = await sendEmail({ kind: "ops", to, subject: mail.subject, blocks: mail.blocks });
      log(incident.occasion, result.sent ? "sent" : result.reason);
      if (result.sent) accepted = true;
    } catch {
      log(incident.occasion, "threw");
    }
  }
  return accepted;
}
