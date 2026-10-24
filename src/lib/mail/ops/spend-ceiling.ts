// The owner's spend alert — §6.5's ceilings and §11's switch: four fifths of the day's ceiling, the ceiling, a site's own cap,
// a free-path bound, or the kill switch engaged. One send per `OWNER_EMAILS` address (BUILD §15), so one failure does not hide another.
// An unwritten line makes `sendEmail` answer `not-composable`; the ceiling guard holds at the door whether or not anybody is told.
// Nothing here throws: a failing report must not become a second failure of what it reports on.
import { now } from "@/lib/config/now";
import { env } from "@/lib/config/env";
import { readDaySpendCents, readDayCeilingCents } from "@/lib/costs/daily";
import type { SpendAlert } from "@/lib/costs/daily";
import { registerSpendAlertSink } from "@/lib/costs/daily";
import { sendEmail } from "../send";
import { buildSpendCeilingAlert } from "../templates/ops";
import type { OpsOccasion, OpsSubject } from "../templates/ops";

function log(occasion: OpsOccasion, outcome: string, detail?: string): void {
  const line = {
    event: "ops_spend_alert",
    occasion,
    outcome,
    ...(detail === undefined ? {} : { detail }),
  };
  console.warn(JSON.stringify(line));
}

/** Sends one occasion to every owner address; `sendEmail` reports rather than throws, so each result is logged, never raised. */
export async function sendOpsAlert(a: {
  occasion: OpsOccasion;
  spentCents: number;
  ceilingCents: number;
  /** Whose ceiling, where it is not the product's. */
  subject?: OpsSubject;
}): Promise<void> {
  const mail = buildSpendCeilingAlert(a);
  for (const to of env.OWNER_EMAILS) {
    try {
      const result = await sendEmail({
        kind: "ops",
        to,
        subject: mail.subject,
        blocks: mail.blocks,
      });
      log(a.occasion, result.sent ? "sent" : result.reason);
    } catch (error) {
      log(a.occasion, "threw", String(error));
    }
  }
}

/** The kill switch engaged (§11), with the day's spend as context; an unreadable ledger reports zero, since the news is the switch. */
export async function reportKillSwitchEngaged(): Promise<void> {
  const at = now();
  const spentCents = (await readDaySpendCents(at)) ?? 0;
  await sendOpsAlert({
    occasion: "kill-switch-engaged",
    spentCents,
    ceilingCents: await readDayCeilingCents(at),
  });
}

/** Registers this module as the cost seam's crossing sink, once at boot (`src/instrumentation.ts`), since the seam knows nothing of mail.
 *  Synchronous: a spending call never waits on an alert, so the send is started, not awaited, and swallows its own failures. */
export function installSpendAlerts(): void {
  registerSpendAlertSink((alert: SpendAlert) => {
    void sendOpsAlert({
      ...occasionOf(alert),
      spentCents: alert.spentCents,
      ceilingCents: alert.ceilingCents,
    });
  });
}

/** The spend occasion and the subject named beside it; no subject is the product's own ceiling. */
function occasionOf(alert: SpendAlert): { occasion: OpsOccasion; subject?: OpsSubject } {
  const subject = alert.subject;
  if (subject === undefined || subject.kind === "product") {
    return { occasion: alert.crossed === "ceiling" ? "reached" : "warn" };
  }
  if (subject.kind === "site") {
    return { occasion: "site-reached", subject: { kind: "site", siteId: subject.siteId } };
  }
  return { occasion: "free-scan-bound", subject: { kind: "free-scan", bound: subject.bound } };
}
