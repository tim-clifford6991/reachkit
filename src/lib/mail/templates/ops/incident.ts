// The owner's incident alert (issue 330) — a job failed, a job was
// dead-lettered, or a deployment refused to boot.
//
// One shape, four occasions, the way the spend alert beside it is built:
// the occasion picks the line, and the fact rows carry closed names only.
// Nothing a customer typed, no event payload, no error message (a message
// can quote an address or a domain) and no subject id reaches this mail —
// the values are a job id from the registry, an attempt number, an error's
// class name and a boot check's name.
import type { CopyKey } from "@/lib/presentation/copy";
import type { FactRow, MailBlock } from "../../blocks/types";

export type OpsIncident =
  | { occasion: "job-failed"; jobId: string; attempt: number; errorName: string }
  | { occasion: "dead-lettered"; jobId: string; errorName: string }
  | { occasion: "boot-refused"; check: string; errorName: string }
  // Issue #770: no error — the market was read and was too small. The facts
  // are the scan's id and its tier, never the domain.
  | { occasion: "market-too-small"; scanId: string; tier: string };

const SUBJECT = "mail.ops.incident.subject" satisfies CopyKey;
const HEADING = "mail.ops.incident.heading" satisfies CopyKey;

const BODY: Readonly<Record<OpsIncident["occasion"], CopyKey>> = Object.freeze({
  "job-failed": "mail.ops.incident.job-failed",
  "dead-lettered": "mail.ops.incident.dead-lettered",
  "boot-refused": "mail.ops.incident.boot-refused",
  "market-too-small": "mail.ops.incident.market-too-small",
});

/** A scan id is a UUID, and `closedName` would refuse one that starts with
 *  a digit; anything that is not one is written as `unknown`. */
function closedId(value: string): string {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) ? value : "unknown";
}

/** A name, or `Error` where the value is not one: a class name is letters,
 *  digits and underscores, and anything else could be a message. */
export function closedName(value: string): string {
  return /^[A-Za-z][A-Za-z0-9_/-]{0,63}$/.test(value) ? value : "Error";
}

function factsOf(incident: OpsIncident): FactRow[] {
  if (incident.occasion === "market-too-small") {
    return [
      { label: "mail.ops.incident.fact.scan", value: closedId(incident.scanId) },
      { label: "mail.ops.incident.fact.tier", value: closedName(incident.tier) },
    ];
  }
  const error = { label: "mail.ops.incident.fact.error", value: closedName(incident.errorName) } as const;
  switch (incident.occasion) {
    case "job-failed":
      return [
        { label: "mail.ops.incident.fact.job", value: closedName(incident.jobId) },
        // Zero-indexed on the platform; written one-indexed, as a person counts.
        { label: "mail.ops.incident.fact.attempt", value: String(Math.max(0, Math.trunc(incident.attempt)) + 1) },
        error,
      ];
    case "dead-lettered":
      return [{ label: "mail.ops.incident.fact.job", value: closedName(incident.jobId) }, error];
    case "boot-refused":
      return [{ label: "mail.ops.incident.fact.check", value: closedName(incident.check) }, error];
  }
}

export function buildIncidentAlert(incident: OpsIncident): { subject: CopyKey; blocks: readonly MailBlock[] } {
  return {
    subject: SUBJECT,
    blocks: [
      { block: "heading", text: HEADING },
      { block: "paragraph", text: BODY[incident.occasion] },
      { block: "facts", items: factsOf(incident) },
    ],
  };
}
