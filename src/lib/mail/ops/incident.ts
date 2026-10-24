// The owner's incident alert: no error-tracking vendor, so this seam tells `OWNER_EMAILS` when a job fails, exhausts its retries, or a deploy refuses to boot.
// Nothing here throws: a report about a failure must not become a second one. Every arm ends in one log line.
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

/** Whether at least one owner address was accepted, for a caller that stamps its own once-ness. */
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
