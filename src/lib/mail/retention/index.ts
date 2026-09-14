// SPEC §8, Retention (issue #569) — the sequence, run by the maintenance
// tick: four triggers, six kinds, each touch stopped when its condition
// resolves.
//
// **Due at send time, never scheduled.** Like the setup reminders, nothing is
// queued per account: each tick asks who is due now, and each send re-reads
// the row and re-asks `rules.ts` immediately before composing. Signing in,
// opening or resolving the draft, a payment succeeding or a resume makes the
// next touch not due; there is no queue entry to cancel.
//
// **Stamped only after the mail left.** A touch that did not send — an
// unwritten line, an opted-out address, a vendor failure — leaves its stamp
// unset and is logged with the reason, so every decision is visible and none
// is consumed by a mail that never arrived.
//
// The hosting-end notice, the sixth kind, is `account/billing`'s and already
// runs on the same tick.
import { formatMailDate } from "../blocks/format";
import { wireSuppressionReader } from "../leads/wire";
import { sendEmail, type SendResult } from "../send";
import { buildCancellation } from "../templates/cancellation";
import { buildInactivity } from "../templates/inactivity";
import { buildPaymentFailed } from "../templates/payment-failed";
import { buildVetoReminder } from "../templates/veto-reminder";
import { buildWinback } from "../templates/win-back";
import { RETENTION_MAIL } from "@/lib/config/constants";
import {
  cancellationDue,
  inactivityDue,
  paymentFailedDue,
  vetoReminderDue,
  winbackDue,
} from "./rules";
import { idleCutoff, retentionStore } from "./store";

export type RetentionKind = "inactivity" | "veto-reminder" | "payment-failed" | "cancellation" | "win-back";

export type RetentionOutcome =
  | { sent: true; kind: RetentionKind }
  | { sent: false; kind: RetentionKind; reason: "not-due" | Extract<SendResult, { sent: false }>["reason"] };

function logTouch(a: { kind: RetentionKind; subjectId: string; outcome: string }): void {
  console.log(JSON.stringify({ event: "retention_touch", ...a }));
}

function notDue(kind: RetentionKind, subjectId: string): RetentionOutcome {
  logTouch({ kind, subjectId, outcome: "not-due" });
  return { sent: false, kind, reason: "not-due" };
}

function withheld(kind: RetentionKind, subjectId: string, result: Extract<SendResult, { sent: false }>): RetentionOutcome {
  logTouch({ kind, subjectId, outcome: result.reason });
  return { sent: false, kind, reason: result.reason };
}

function sentTouch(kind: RetentionKind, subjectId: string): RetentionOutcome {
  logTouch({ kind, subjectId, outcome: "sent" });
  return { sent: true, kind };
}

// ── Due queries: one per trigger, each returning subject ids ─────────────

export async function accountsDueInactivity(now: Date = new Date()): Promise<readonly string[]> {
  const store = retentionStore();
  const due: string[] = [];
  for (const account of await store.idleAccounts(idleCutoff(now))) {
    const site = await store.siteOf(account.id);
    if (site === null) continue;
    const lastPublishedAt = await store.lastPublishedAt(site.siteId);
    if (inactivityDue({ account, lastPublishedAt, now })) due.push(account.id);
  }
  return due;
}

export async function draftsDueVetoReminder(now: Date = new Date()): Promise<readonly string[]> {
  const until = new Date(now.getTime() + RETENTION_MAIL.vetoReminderHours * 3_600_000);
  const drafts = await retentionStore().draftsClosingBy(until, now);
  return drafts.filter((draft) => vetoReminderDue({ draft, now })).map((draft) => draft.id);
}

export async function accountsDuePaymentFailed(): Promise<readonly string[]> {
  return (await retentionStore().pastDueAccounts()).filter(paymentFailedDue).map((a) => a.id);
}

export async function accountsDueCancellation(): Promise<readonly string[]> {
  return (await retentionStore().cancelledAccounts()).filter(cancellationDue).map((a) => a.id);
}

export async function accountsDueWinback(now: Date = new Date()): Promise<readonly string[]> {
  return (await retentionStore().cancelledAccounts())
    .filter((account) => winbackDue({ account, now }))
    .map((account) => account.id);
}

// ── Senders: re-read, re-decide, send, then stamp ───────────────────────

export async function sendInactivityNudge(userId: string, now: Date = new Date()): Promise<RetentionOutcome> {
  const kind = "inactivity";
  const store = retentionStore();
  const account = await store.account(userId);
  const site = account === null ? null : await store.siteOf(userId);
  if (account === null || site === null) return notDue(kind, userId);
  const lastPublishedAt = await store.lastPublishedAt(site.siteId);
  if (!inactivityDue({ account, lastPublishedAt, now })) return notDue(kind, userId);

  wireSuppressionReader();
  const mail = buildInactivity({ email: account.email });
  const result = await sendEmail({ kind, to: account.email, ...mail });
  if (!result.sent) return withheld(kind, userId, result);
  await store.stampAccount(userId, "inactivity_nudged_at", now);
  return sentTouch(kind, userId);
}

export async function sendVetoReminder(draftId: string, now: Date = new Date()): Promise<RetentionOutcome> {
  const kind = "veto-reminder";
  const store = retentionStore();
  const draft = await store.draft(draftId);
  if (draft === null || draft.vetoDeadline === null || !vetoReminderDue({ draft, now })) {
    return notDue(kind, draftId);
  }
  const owner = await store.account(draft.ownerId);
  if (owner === null || owner.deletedAt !== null) return notDue(kind, draftId);

  wireSuppressionReader();
  const mail = buildVetoReminder({
    email: owner.email,
    draftId,
    page: draft.title,
    closesAt: formatMailDate(draft.vetoDeadline, draft.timezone),
  });
  const result = await sendEmail({ kind, to: owner.email, ...mail });
  if (!result.sent) return withheld(kind, draftId, result);
  await store.stampVetoReminded(draftId, now);
  return sentTouch(kind, draftId);
}

export async function sendPaymentFailed(userId: string, now: Date = new Date()): Promise<RetentionOutcome> {
  const kind = "payment-failed";
  const store = retentionStore();
  const account = await store.account(userId);
  if (account === null || !paymentFailedDue(account)) return notDue(kind, userId);

  const mail = buildPaymentFailed();
  const result = await sendEmail({ kind, to: account.email, ...mail });
  if (!result.sent) return withheld(kind, userId, result);
  await store.stampAccount(userId, "payment_failed_mailed_at", now);
  return sentTouch(kind, userId);
}

export async function sendCancellation(userId: string, now: Date = new Date()): Promise<RetentionOutcome> {
  const kind = "cancellation";
  const store = retentionStore();
  const account = await store.account(userId);
  if (account === null || !cancellationDue(account)) return notDue(kind, userId);
  const site = await store.siteOf(userId);

  const mail = buildCancellation({
    accessEndsOn: formatMailDate(account.paidThrough, site?.timezone ?? null),
  });
  const result = await sendEmail({ kind, to: account.email, ...mail });
  if (!result.sent) return withheld(kind, userId, result);
  await store.stampAccount(userId, "cancellation_mailed_at", now);
  return sentTouch(kind, userId);
}

export async function sendWinback(userId: string, now: Date = new Date()): Promise<RetentionOutcome> {
  const kind = "win-back";
  const store = retentionStore();
  const account = await store.account(userId);
  if (account === null || !winbackDue({ account, now })) return notDue(kind, userId);

  // The address-wide opt-out is the win-back's one stop besides a resume:
  // `sendEmail` asks the suppression store for this `opt-out` kind.
  wireSuppressionReader();
  const mail = buildWinback({ email: account.email });
  const result = await sendEmail({ kind, to: account.email, ...mail });
  if (!result.sent) return withheld(kind, userId, result);
  await store.stampAccount(userId, "winback_sent_at", now);
  return sentTouch(kind, userId);
}

export { setRetentionStore, retentionStore, type RetentionStore } from "./store";
export type { RetentionAccount, RetentionDraft } from "./rules";
