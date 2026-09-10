// The owner's spend alert, sent — §6.5's ceilings and §11's switch.
//
// Three occasions, one mail (`templates/ops/`): the day's spend crossed
// four fifths of its ceiling, it reached the ceiling, or the kill switch
// was found engaged.
//
// **Who receives it.** `OWNER_EMAILS` — the binding BUILD §15 has carried
// since the beginning and which nothing in `src/` read until now. One send
// per address, because two owners are two people who each need telling,
// and a failure for one is not a failure for the other.
//
// **It cannot send yet, by design.** Every sentence it speaks is
// owner-owed (`copy()` refuses an unwritten key, `sendEmail` answers
// `not-composable`, DECISIONS 2026-09-05: "a mail never ships a
// placeholder"). The guard does not depend on the mail: the ceiling
// refuses at the door and holds the seam whether or not anybody is told.
// What is missing until the owner writes the lines is the telling.
//
// **Nothing here throws.** An alert is a report about a system under
// strain; a report that fails must not become a second failure of the
// thing it is reporting on. Every arm ends in a log line.
import { now } from "@/lib/config/now";
import { env } from "@/lib/config/env";
import { readDaySpendCents, alertThresholdsCents } from "@/lib/costs/daily";
import type { SpendAlert } from "@/lib/costs/daily";
import { registerSpendAlertSink } from "@/lib/costs/daily";
import { sendEmail } from "../send";
import { buildSpendCeilingAlert } from "../templates/ops";
import type { OpsOccasion } from "../templates/ops";

function log(occasion: OpsOccasion, outcome: string, detail?: string): void {
  const line = {
    event: "ops_spend_alert",
    occasion,
    outcome,
    ...(detail === undefined ? {} : { detail }),
  };
  console.warn(JSON.stringify(line));
}

/**
 * Sends one occasion to every owner address.
 *
 * `sendEmail` reports rather than throws — an unwritten sentence comes
 * back as `not-composable`, an unreachable vendor as `vendor` — so the
 * result is logged per address and never raised.
 */
export async function sendOpsAlert(a: {
  occasion: OpsOccasion;
  spentCents: number;
  ceilingCents: number;
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

/**
 * The kill switch was found engaged (§11). The day's spend rides along:
 * the switch stops scanning, generating and publishing, so what the day
 * had already cost when it moved is the context the owner reads it
 * against — and an unreadable ledger reports zero rather than holding the
 * alert, because the news is the switch, not the figure.
 */
export async function reportKillSwitchEngaged(): Promise<void> {
  const spentCents = (await readDaySpendCents(now())) ?? 0;
  await sendOpsAlert({
    occasion: "kill-switch-engaged",
    spentCents,
    ceilingCents: alertThresholdsCents().ceiling,
  });
}

/**
 * Registers this module as what the cost seam's crossings reach.
 *
 * Called once from the boot path (`src/instrumentation.ts`), the shape
 * `installActiveAccessGate` and `installStampCapability` already use — the
 * seam publishes and knows nothing about mail, so somebody above both has
 * to introduce them, and boot is where every surface has been through.
 *
 * The sink is synchronous because a spending call must never wait on an
 * alert: the send is started and not awaited, and `sendOpsAlert` swallows
 * its own failures, so the scan that noticed the crossing carries on
 * whatever happens to the mail.
 */
export function installSpendAlerts(): void {
  registerSpendAlertSink((alert: SpendAlert) => {
    void sendOpsAlert({
      occasion: alert.crossed === "ceiling" ? "reached" : "warn",
      spentCents: alert.spentCents,
      ceilingCents: alert.ceilingCents,
    });
  });
}
