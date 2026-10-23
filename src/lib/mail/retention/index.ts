// SPEC §8, Retention (issue #569) — the sequence, run by the maintenance
// tick: three triggers, four kinds, each touch stopped when its condition
// resolves.
//
// **Due at send time, never scheduled.** Like the setup reminders, nothing is
// queued per account: each tick asks who is due now, and each send re-reads
// the row and re-asks `rules.ts` immediately before composing. A payment
// succeeding or a resume makes the next touch not due; there is no queue
// entry to cancel.
//
// **Stamped only after the mail left.** A touch that did not send — an
// unwritten line, an opted-out address, a vendor failure — leaves its stamp
// unset and is logged with the reason, so every decision is visible and none
// is consumed by a mail that never arrived.
//
// The hosting-end notice, the fourth kind, is `account/billing`'s and already
// runs on the same tick.
import { formatMailDate } from "../blocks/format";
import { wireSuppressionReader } from "../leads/wire";
import { sendEmail, type SendResult } from "../send";
import { buildCancellation } from "../templates/cancellation";
import { buildPaymentFailed } from "../templates/payment-failed";
import { buildWinback } from "../templates/win-back";
import { cancellationDue, paymentFailedDue, winbackDue } from "./rules";
import { retentionStore } from "./store";

export type RetentionKind = "payment-failed" | "cancellation" | "win-back";

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
  if (account === null || account.cancelledAt === null || !cancellationDue(account)) return notDue(kind, userId);
  const site = await store.siteOf(userId);
  // The webhook stamps the cancel before it refunds, so only a refund at or after the stamp belongs to this cancel.
  const refunded = await store.refundedSince(userId, account.cancelledAt);

  const mail = buildCancellation({
    accessEndsOn: formatMailDate(account.paidThrough, site?.timezone ?? null),
    refunded,
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
export type { RetentionAccount } from "./rules";
