// SPEC §8, Retention (issue #569) — when each touch is due, as pure
// functions over the rows. The whole schedule lives here; the store only
// narrows the read and the senders only re-ask these at send time.
//
//   trigger          kind            due                                   stops
//   payment failed   payment-failed  plan past_due, not mailed this spell  payment succeeds
//   cancelled        cancellation    cancelled, not mailed since           resume
//   (access ended)   hosting-end     `account/billing/hosting-notices.ts`  resume
//   access +30 d     win-back        cancelled, access ended ≥ 30 d ago,   resume; never repeats
//                                    never sent
import { RETENTION_MAIL } from "@/lib/config/constants";

const MS_PER_DAY = 86_400_000;

export interface RetentionAccount {
  readonly id: string;
  readonly email: string;
  readonly planStatus: string;
  readonly paidThrough: Date;
  readonly cancelledAt: Date | null;
  readonly deletedAt: Date | null;
  readonly paymentFailedMailedAt: Date | null;
  readonly cancellationMailedAt: Date | null;
  readonly winbackSentAt: Date | null;
}

function before(a: Date | null, b: Date): boolean {
  return a === null || a.getTime() < b.getTime();
}

export function paymentFailedDue(account: RetentionAccount): boolean {
  if (account.deletedAt !== null) return false;
  return account.planStatus === "past_due" && account.paymentFailedMailedAt === null;
}

export function cancellationDue(account: RetentionAccount): boolean {
  if (account.deletedAt !== null || account.cancelledAt === null) return false;
  return before(account.cancellationMailedAt, account.cancelledAt);
}

export function winbackDue(a: { account: RetentionAccount; now: Date }): boolean {
  const { account } = a;
  if (account.deletedAt !== null || account.cancelledAt === null) return false;
  if (account.winbackSentAt !== null) return false;
  const since = a.now.getTime() - account.paidThrough.getTime();
  return since >= RETENTION_MAIL.winbackAfterAccessDays * MS_PER_DAY;
}

/** Whether a stored "last seen" is stale enough for a visit to rewrite it —
 *  so an /app visit is one write an hour, not one per request. */
export function seenIsStale(a: { seenAt: Date | null; now: Date }): boolean {
  if (a.seenAt === null) return true;
  return a.now.getTime() - a.seenAt.getTime() >= RETENTION_MAIL.seenRefreshMinutes * 60_000;
}
