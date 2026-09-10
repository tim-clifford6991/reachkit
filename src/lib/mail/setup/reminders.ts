// BUILD §4.3 — the setup reminders: three at 24 / 72 / 168 hours, stopped
// at send time.
//
// §4.3 is "post-payment, once", and a founder who paid and never came back
// to answer the three questions is the one case where the product writes
// to them about it. `SETUP_REMINDER_OFFSETS_H` pins the three offsets; the
// last is at seven days and there is no fourth.
//
// **The stop is checked at send time, never at schedule time.** A founder
// who finishes at hour 71 must not receive the hour-72 mail, and a
// scheduler that decided an hour earlier could not know that. So nothing
// is scheduled per founder at all: the maintenance tick asks which
// founders are due *now* (`sitesDueSetupReminder`) and each send re-reads
// the founder's own row immediately before composing. Cancelling, or
// finishing, stops the next reminder by making it not due — there is no
// queue entry anywhere to cancel.
//
// **A reminder with no working link is a send-time failure, not a
// degraded send.** REQ-025 c6's promise is "a working way back in"; a mail
// that arrives without one is worse than no mail, because it spends the
// founder's attention and returns nothing. So the link is issued first and
// a failure to issue it stops the send, leaving the counter untouched and
// the founder due again at the next offset.
//
// The counter (`sites.setup_reminders_sent`) is incremented **after** a
// successful send. At-most-three is the column's own check constraint, so
// a double delivery of one tick cannot become a fourth mail — the fourth
// increment is refused by Postgres, not by this file remembering.
import { SETUP_REMINDER_OFFSETS_H } from "@/lib/config/constants";
import { dbAdmin } from "@/lib/db";
import { sendEmail } from "../send";
import { buildSetupReminder } from "../templates/setup-reminder";

/** Re-exported from the pins, never restated: `constants.ts` is the one
 *  home of a pinned number. */
export const REMINDER_OFFSETS_H = SETUP_REMINDER_OFFSETS_H;

/** Where the link lands. An internal route name (the setup screen itself,
 *  REQ-024 c4), not a customer-visible string — and deliberately the same
 *  literal `src/app/(account)/setup/gate.ts` allow-lists, so a reminder can
 *  never land somewhere the gate would bounce. */
export const SETUP_LANDING_PATH = "/setup";

/**
 * Issues one sign-in link that lands on `landsOn`, or `null` where none
 * can be issued.
 *
 * **A port, and it answers `null` today.** §13's identity half — the
 * Supabase Auth behind `issueLink` and `redeemLink` (#35, #468) — and
 * `src/lib/account/provisioning/magic-link.ts` is its declared seam:
 * `requestMagicLink()` *sends* the sign-in mail, which is a different
 * occasion from putting a link inside this one. Until #35 exports the
 * issuer, no link can be issued, so no reminder is sent — which is REQ-025
 * c6's own rule ("no reminder ever going out before there is an account to
 * sign in to"), reached honestly rather than by mailing a link that would
 * not work.
 */
export type SignInLinkIssuer = (a: {
  email: string;
  landsOn: string;
}) => Promise<string | null>;

const identityIsIssue35: SignInLinkIssuer = async () => null;

let issueSignInLink: SignInLinkIssuer = identityIsIssue35;

/** The seam #35 fills, and the one tests drive a send through. */
export function setSignInLinkIssuer(next: SignInLinkIssuer): void {
  issueSignInLink = next;
}

export function resetSignInLinkIssuer(): void {
  issueSignInLink = identityIsIssue35;
}

const MS_PER_HOUR = 3_600_000;

/** Why a send did nothing. Every arm is reported; none is a silent skip. */
export type ReminderOutcome =
  | { sent: true; index: number }
  | { sent: false; reason: "not-due" | "already-complete" | "no-link" | "mail" };

/** The generated `Database` type carries none of the `sites.setup_*`
 *  columns this issue's migration adds — the same narrow cast
 *  `src/lib/scan/deep/release.ts` documents. */
interface ReminderRow {
  id: string;
  created_at: string;
  setup_completed_at: string | null;
  setup_reminders_sent: number;
  user_id: string;
}

interface MinimalResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}
interface MinimalQuery<T> extends PromiseLike<MinimalResult<T>> {
  select(columns: string): MinimalQuery<T>;
  update(values: Record<string, unknown>): MinimalQuery<T>;
  eq(column: string, value: unknown): MinimalQuery<T>;
  is(column: string, value: null): MinimalQuery<T>;
  lt(column: string, value: unknown): MinimalQuery<T>;
  limit(n: number): MinimalQuery<T>;
}
interface MinimalClient {
  from<T>(table: string): MinimalQuery<T>;
}

function untyped(): MinimalClient {
  return dbAdmin() as unknown as MinimalClient;
}

/**
 * Which reminder, if any, is due for a founder who paid at `paidAt` and
 * has had `sent` of them.
 *
 * Pure, and the whole of the schedule: `null` means nothing is due, and a
 * number is the index into `REMINDER_OFFSETS_H` of the one that is. A
 * founder past the last offset who has had all three is never due again,
 * and a founder who has somehow had more than three is refused here as
 * well as by the column's constraint.
 */
export function dueReminderIndex(a: {
  paidAt: Date;
  sent: number;
  now: Date;
}): number | null {
  if (a.sent >= REMINDER_OFFSETS_H.length) return null;
  const offsetH = REMINDER_OFFSETS_H[a.sent]!;
  const dueAt = a.paidAt.getTime() + offsetH * MS_PER_HOUR;
  return a.now.getTime() >= dueAt ? a.sent : null;
}

/**
 * The founders whose next reminder has fallen due.
 *
 * One indexed read over `idx_sites_setup_incomplete` — the partial index
 * that holds only unfinished founders — narrowed to those old enough for
 * the *first* offset, then filtered by `dueReminderIndex` so the offset
 * table stays in one place. A tick that finds nobody is one indexed read
 * and no writes.
 *
 * `created_at` stands in for the payment: a `sites` row is created by
 * provisioning from the payment (§13), so the two are the same instant to
 * within one webhook. When §13's own payment timestamp lands, this read
 * changes column and nothing else here does.
 */
export async function sitesDueSetupReminder(now: Date = new Date()): Promise<readonly string[]> {
  const firstOffsetH = REMINDER_OFFSETS_H[0]!;
  const { data, error } = await untyped()
    .from<ReminderRow>("sites")
    .select("id, created_at, setup_completed_at, setup_reminders_sent, user_id")
    .is("setup_completed_at", null)
    .lt("created_at", new Date(now.getTime() - firstOffsetH * MS_PER_HOUR).toISOString());
  if (error) throw new Error(`sitesDueSetupReminder: ${error.message}`);

  return (data ?? [])
    .filter(
      (row) =>
        dueReminderIndex({
          paidAt: new Date(row.created_at),
          sent: row.setup_reminders_sent,
          now,
        }) !== null
    )
    .map((row) => row.id);
}

async function readReminderRow(siteId: string): Promise<ReminderRow | null> {
  const { data, error } = await untyped()
    .from<ReminderRow>("sites")
    .select("id, created_at, setup_completed_at, setup_reminders_sent, user_id")
    .eq("id", siteId)
    .limit(1);
  if (error) throw new Error(`sendSetupReminder: could not read site ${siteId}: ${error.message}`);
  return data?.[0] ?? null;
}

/** The address a reminder goes to. `users.email` — one read, and the only
 *  thing this module reads off that table. */
async function addressFor(userId: string): Promise<string | null> {
  const { data, error } = await untyped()
    .from<{ email: string }>("users")
    .select("email")
    .eq("id", userId)
    .limit(1);
  if (error) throw new Error(`sendSetupReminder: could not read user ${userId}: ${error.message}`);
  return data?.[0]?.email ?? null;
}

/**
 * Sends one founder's next reminder, re-deciding due-ness against their
 * row at the moment of sending.
 *
 * The order is the order the promise requires: due-ness, then the link,
 * then the mail, then the counter. A failure at any step leaves the
 * counter where it was, so nothing is consumed by a reminder that did not
 * arrive.
 */
export async function sendSetupReminder(
  siteId: string,
  now: Date = new Date()
): Promise<ReminderOutcome> {
  const row = await readReminderRow(siteId);
  if (row === null) return { sent: false, reason: "not-due" };
  if (row.setup_completed_at !== null) return { sent: false, reason: "already-complete" };

  const index = dueReminderIndex({
    paidAt: new Date(row.created_at),
    sent: row.setup_reminders_sent,
    now,
  });
  if (index === null) return { sent: false, reason: "not-due" };

  const to = await addressFor(row.user_id);
  if (to === null) return { sent: false, reason: "no-link" };

  // "no reminder ever going out before there is an account to sign in to"
  // (REQ-025 c6). The issuer answers that question: no account to sign in
  // to means no link, and no link means no send — the counter is not
  // touched and this founder is due again at the next offset.
  let href: string | null;
  try {
    href = await issueSignInLink({ email: to, landsOn: SETUP_LANDING_PATH });
  } catch {
    return { sent: false, reason: "no-link" };
  }
  if (href === null) return { sent: false, reason: "no-link" };

  const mail = buildSetupReminder({ signInHref: href });
  const result = await sendEmail({
    kind: "setup-reminder",
    to,
    subject: mail.subject,
    blocks: mail.blocks,
  });
  if (!result.sent) return { sent: false, reason: "mail" };

  await untyped()
    .from<ReminderRow>("sites")
    .update({ setup_reminders_sent: row.setup_reminders_sent + 1 })
    .eq("id", siteId);

  return { sent: true, index };
}
