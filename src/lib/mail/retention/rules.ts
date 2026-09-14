// SPEC §8, Retention (issue #569) — when each touch is due, as pure
// functions over the rows. The whole schedule lives here; the store only
// narrows the read and the senders only re-ask these at send time.
//
//   trigger          kind            due                                   stops
//   idle 7 days      inactivity      seen ≥ 7 d ago, pages published       sign-in (a new spell)
//                                    since, not nudged this spell
//   veto < 6 h       veto-reminder   in review, unopened, window closes    draft resolved or opened
//                                    within 6 h, not reminded
//   payment failed   payment-failed  plan past_due, not mailed this spell  payment succeeds
//   cancelled        cancellation    cancelled, not mailed since           resume
//   (access ended)   hosting-end     `account/billing/hosting-notices.ts`  resume
//   access +30 d     win-back        cancelled, access ended ≥ 30 d ago,   resume; never repeats
//                                    never sent
import { RETENTION_MAIL } from "@/lib/config/constants";

const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 24 * MS_PER_HOUR;

export interface RetentionAccount {
  readonly id: string;
  readonly email: string;
  readonly planStatus: string;
  readonly paidThrough: Date;
  readonly cancelledAt: Date | null;
  readonly deletedAt: Date | null;
  /** `last_seen_at`, falling back to `first_signed_in_at`. `null` for an
   *  account nobody has signed in to — the sign-in chase's, not ours. */
  readonly seenAt: Date | null;
  readonly inactivityNudgedAt: Date | null;
  readonly paymentFailedMailedAt: Date | null;
  readonly cancellationMailedAt: Date | null;
  readonly winbackSentAt: Date | null;
}

export interface RetentionDraft {
  readonly id: string;
  readonly state: string;
  readonly title: string;
  readonly vetoDeadline: Date | null;
  readonly openedAt: Date | null;
  readonly vetoRemindedAt: Date | null;
}

function before(a: Date | null, b: Date): boolean {
  return a === null || a.getTime() < b.getTime();
}

export function inactivityDue(a: {
  account: RetentionAccount;
  lastPublishedAt: Date | null;
  now: Date;
}): boolean {
  const { account } = a;
  if (account.deletedAt !== null || account.cancelledAt !== null) return false;
  if (account.paidThrough.getTime() <= a.now.getTime()) return false;
  if (account.seenAt === null) return false;
  const idleFor = a.now.getTime() - account.seenAt.getTime();
  if (idleFor < RETENTION_MAIL.inactivityIdleDays * MS_PER_DAY) return false;
  // "while pages publish": a page went live during this idle spell.
  if (a.lastPublishedAt === null || a.lastPublishedAt.getTime() <= account.seenAt.getTime()) return false;
  // One nudge per spell: a nudge sent after the last sign-in is this spell's.
  return before(account.inactivityNudgedAt, account.seenAt);
}

export function vetoReminderDue(a: { draft: RetentionDraft; now: Date }): boolean {
  const { draft } = a;
  if (draft.state !== "in_review" || draft.vetoDeadline === null) return false;
  if (draft.openedAt !== null || draft.vetoRemindedAt !== null) return false;
  const left = draft.vetoDeadline.getTime() - a.now.getTime();
  return left > 0 && left <= RETENTION_MAIL.vetoReminderHours * MS_PER_HOUR;
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
