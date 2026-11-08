// The owner's spend alert — §6.5's ceilings and §11's switch: four fifths of the day's ceiling, the ceiling, a site's own cap,
// a free-path bound, the kill switch engaged, or a ledger nobody could read. One send per `OWNER_EMAILS` address (BUILD §15), so one failure does not hide another.
// An unwritten line makes `sendEmail` answer `not-composable`; the ceiling guard holds at the door whether or not anybody is told.
// Nothing here throws: a failing report must not become a second failure of what it reports on.
import { now } from "@/lib/config/now";
import { env } from "@/lib/config/env";
import { readDaySpendCents, readDayCeilingCents } from "@/lib/costs/daily";
import type { LedgerUnreadable, SpendAlert } from "@/lib/costs/daily";
import { sendEmail } from "../send";
import { buildSpendCeilingAlert } from "../templates/ops";
import type { OpsOccasion, OpsSubject, SpendAlertInput } from "../templates/ops";
import { claimOwnerMail, releaseOwnerMail } from "./incident";

function log(occasion: OpsOccasion, outcome: string, detail?: string): void {
  const line = {
    event: "ops_spend_alert",
    occasion,
    outcome,
    ...(detail === undefined ? {} : { detail }),
  };
  console.warn(JSON.stringify(line));
}

/** Sends one occasion to every owner address; `sendEmail` reports rather than throws, so each result is logged, never raised.
 *  True when at least one address was accepted. */
export async function sendOpsAlert(a: SpendAlertInput): Promise<boolean> {
  const mail = buildSpendCeilingAlert(a);
  let accepted = false;
  for (const to of env.OWNER_EMAILS) {
    try {
      const result = await sendEmail({
        kind: "ops",
        to,
        subject: mail.subject,
        blocks: mail.blocks,
      });
      log(a.occasion, result.sent ? "sent" : result.reason);
      if (result.sent) accepted = true;
    } catch (error) {
      log(a.occasion, "threw", String(error));
    }
  }
  return accepted;
}

/** Keys this process has settled, so a database that cannot answer the claim costs one mail per process, never one per read. */
const settled = new Set<string>();

/** Once per reason and UTC day, decided by the same `job_error_mails` claim a failing job uses: it needs no job runtime,
 *  so a free-scan admission on the request path is counted with every job. Never throws. */
export async function reportLedgerUnreadable(unreadable: LedgerUnreadable): Promise<void> {
  const reason = `${unreadable.ledger}/${unreadable.cause}`;
  const key = { jobId: "spend-ledger", errorName: reason, day: unreadable.at.toISOString().slice(0, 10) };
  const id = `${key.errorName}|${key.day}`;
  let outcome = "already-told";
  try {
    if (settled.has(id)) return;
    let claimed: boolean | null;
    try {
      claimed = await claimOwnerMail(key, unreadable.at);
    } catch {
      claimed = null;
    }
    // The claim decides; only a claim nobody could make falls back to this process's memory.
    if (claimed === false || (claimed === null && settled.has(id))) return void settled.add(id);
    settled.add(id);
    const sent = await sendOpsAlert({ occasion: "ledger-unreadable", reason });
    outcome = sent ? "mailed" : "not-sent";
    if (sent) return;
    settled.delete(id);
    if (claimed === true) await releaseOwnerMail(key);
  } catch (error) {
    outcome = `threw: ${String(error)}`;
  } finally {
    console.warn(JSON.stringify({ event: "ops_ledger_unreadable", reason, outcome }));
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

/** The cost seam's crossing sink, registered at boot behind a forwarder that loads this module on the first alert.
 *  Synchronous: a spending call never waits on an alert, so the send is started, not awaited, and swallows its own failures. */
export function spendAlertSink(alert: SpendAlert): void {
  void sendOpsAlert({
    ...occasionOf(alert),
    spentCents: alert.spentCents,
    ceilingCents: alert.ceilingCents,
  });
}

/** The cost seam's unreadable-ledger sink, registered the same way. */
export function ledgerUnreadableSink(unreadable: LedgerUnreadable): void {
  void reportLedgerUnreadable(unreadable);
}

/** The spend occasion and the subject named beside it; no subject is the product's own ceiling. */
function occasionOf(alert: SpendAlert): { occasion: Exclude<OpsOccasion, "ledger-unreadable">; subject?: OpsSubject } {
  const subject = alert.subject;
  if (subject === undefined || subject.kind === "product") {
    return { occasion: alert.crossed === "ceiling" ? "reached" : "warn" };
  }
  if (subject.kind === "site") {
    return { occasion: "site-reached", subject: { kind: "site", siteId: subject.siteId } };
  }
  return { occasion: "free-scan-bound", subject: { kind: "free-scan", bound: subject.bound } };
}
