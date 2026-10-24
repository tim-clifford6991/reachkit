// BUILD §4.3 — three setup reminders at `SETUP_REMINDER_OFFSETS_H` (24, 72, 168 hours) to a founder who paid and never finished; no fourth.
// Checked at send time, never scheduled: the tick asks who is due now and each send re-reads the row, so finishing at hour 71 stops hour 72.
// No working link, no send (REQ-025 c6): the link is issued first and a failure leaves the founder due at the next offset.
// `sites.setup_reminders_sent` is incremented after the send, and its check constraint refuses a fourth even on a double delivery.
import { SETUP_REMINDER_OFFSETS_H } from "@/lib/config/constants";
import { dbAdmin } from "@/lib/db";
import { sendEmail } from "../send";
import { buildSetupReminder } from "../templates/setup-reminder";

/** Re-exported from the pins: `constants.ts` is the one home of a pinned number. */
export const REMINDER_OFFSETS_H = SETUP_REMINDER_OFFSETS_H;

/** The setup screen (REQ-024 c4), the same literal `src/app/(account)/setup/gate.ts` allow-lists, so the gate never bounces a reminder. */
export const SETUP_LANDING_PATH = "/setup";

/** One sign-in link through the port the sign-in mail uses (`src/lib/account/provisioning/sign-in-link.ts`), or `null`, which is no send.
 *  `landsOn` is not in the link: the setup gate sends an unfinished founder there. */
export type SignInLinkIssuer = (a: {
  userId: string;
  email: string;
  landsOn: string;
}) => Promise<string | null>;

const identityIssuer: SignInLinkIssuer = async (a) => {
  // Lazy: this module rides `src/jobs/engine.ts`'s static imports, and identity pulls Supabase Auth.
  const { wireSignInLinkIssuer } = await import("@/lib/account/identity/wire");
  const { issueSignInLink: issue } = await import("@/lib/account/provisioning/sign-in-link");
  wireSignInLinkIssuer();
  const link = await issue({ userId: a.userId, to: a.email });
  return link.issued ? link.url : null;
};

let issueSignInLink: SignInLinkIssuer = identityIssuer;

/** The door tests drive a send through. */
export function setSignInLinkIssuer(next: SignInLinkIssuer): void {
  issueSignInLink = next;
}

export function resetSignInLinkIssuer(): void {
  issueSignInLink = identityIssuer;
}

const MS_PER_HOUR = 3_600_000;

/** Why a send did nothing. Every arm is reported; none is a silent skip. */
export type ReminderOutcome =
  | { sent: true; index: number }
  | { sent: false; reason: "not-due" | "already-complete" | "no-link" | "mail" };

/** The `sites.setup_*` columns are missing from the generated `Database` type: the narrow cast `src/lib/scan/deep/release.ts` documents. */
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

/** Which reminder is due, as an index into `REMINDER_OFFSETS_H`, or `null`. Pure, and the whole schedule; more than three is refused here too. */
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

/** Founders whose next reminder is due: one read over the partial `idx_sites_setup_incomplete`, filtered by `dueReminderIndex`.
 *  `created_at` stands in for the payment, since provisioning creates the row from it (§13). */
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

/** `users.email`, the only thing read off that table. */
async function addressFor(userId: string): Promise<string | null> {
  const { data, error } = await untyped()
    .from<{ email: string }>("users")
    .select("email")
    .eq("id", userId)
    .limit(1);
  if (error) throw new Error(`sendSetupReminder: could not read user ${userId}: ${error.message}`);
  return data?.[0]?.email ?? null;
}

/** Sends one founder's next reminder: due-ness, link, mail, then counter, so a failure at any step consumes nothing. */
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

  // REQ-025 c6: no reminder before there is an account; no account means no link, no send, and the founder due again.
  let href: string | null;
  try {
    href = await issueSignInLink({ userId: row.user_id, email: to, landsOn: SETUP_LANDING_PATH });
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
    reason: mail.reason,
  });
  if (!result.sent) return { sent: false, reason: "mail" };

  await untyped()
    .from<ReminderRow>("sites")
    .update({ setup_reminders_sent: row.setup_reminders_sent + 1 })
    .eq("id", siteId);

  return { sent: true, index };
}
