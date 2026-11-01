// BUILD §4.3 — three setup reminders at `SETUP_REMINDER_OFFSETS_H` (24, 72, 168 hours) to a founder who paid and is not live yet; no fourth.
// Owner R15: a stamped setup does not stop them; the first live page or a destination with `health = 'ok'` does.
// Checked at send time, never scheduled: the tick asks who is due now and each send re-reads the row, so going live at hour 71 stops hour 72.
// No working link, no send (REQ-025 c6): the link is issued first and a failure leaves the founder due at the next offset.
// `sites.setup_reminders_sent` is incremented after the send, and its check constraint refuses a fourth even on a double delivery.
import { CONNECT_LANDING_PATH, LANDING_QUERY_KEY } from "@/lib/account/identity/addresses";
import { SETUP_REMINDER_OFFSETS_H } from "@/lib/config/constants";
import { dbAdmin } from "@/lib/db";
import { sendEmail } from "../send";
import { buildSetupReminder } from "../templates/setup-reminder";

/** Re-exported from the pins: `constants.ts` is the one home of a pinned number. */
export const REMINDER_OFFSETS_H = SETUP_REMINDER_OFFSETS_H;

/** The setup screen (REQ-024 c4), the same literal `src/app/(account)/setup/gate.ts` allow-lists, so the gate never bounces a reminder. */
export const SETUP_LANDING_PATH = "/setup";

/** One sign-in link through the port the sign-in mail uses (`src/lib/account/provisioning/sign-in-link.ts`), or `null`, which is no send.
 *  `/setup` is not in the link, since the setup gate sends an unfinished founder there; `/setup/connect` is. */
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
  if (!link.issued) return null;
  if (a.landsOn !== CONNECT_LANDING_PATH) return link.url;
  const url = new URL(link.url);
  url.searchParams.set(LANDING_QUERY_KEY, a.landsOn);
  return url.toString();
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

/** A stamped site past its last offset by a day is not reminded, so one stamped before R15 is never sent all three at once. */
const STAMPED_WINDOW_H = REMINDER_OFFSETS_H.at(-1)! + REMINDER_OFFSETS_H[0]!;

/** Why a send did nothing. Every arm is reported; none is a silent skip. */
export type ReminderOutcome =
  | { sent: true; index: number }
  | { sent: false; reason: "not-due" | "live" | "cancelled" | "no-link" | "mail" };

/** The `sites.setup_*` columns are missing from the generated `Database` type: the narrow cast `src/lib/scan/deep/release.ts` documents. */
interface ReminderRow {
  id: string;
  domain: string;
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
  not(column: string, operator: "is", value: null): MinimalQuery<T>;
  lt(column: string, value: unknown): MinimalQuery<T>;
  gt(column: string, value: unknown): MinimalQuery<T>;
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

const ROW_COLUMNS = "id, domain, created_at, setup_completed_at, setup_reminders_sent, user_id";

/** Founders whose next reminder is due: the unfinished over the partial `idx_sites_setup_incomplete`, and the stamped inside
 *  their window and not live, filtered by `dueReminderIndex`. `created_at` stands in for the payment (§13). */
export async function sitesDueSetupReminder(now: Date = new Date()): Promise<readonly string[]> {
  const hoursAgo = (h: number) => new Date(now.getTime() - h * MS_PER_HOUR).toISOString();
  const [unstamped, stamped] = await Promise.all([
    untyped().from<ReminderRow>("sites").select(ROW_COLUMNS).is("setup_completed_at", null).lt("created_at", hoursAgo(REMINDER_OFFSETS_H[0]!)),
    untyped()
      .from<ReminderRow>("sites")
      .select(ROW_COLUMNS)
      .not("setup_completed_at", "is", null)
      .lt("setup_reminders_sent", REMINDER_OFFSETS_H.length)
      .lt("created_at", hoursAgo(REMINDER_OFFSETS_H[0]!))
      .gt("created_at", hoursAgo(STAMPED_WINDOW_H)),
  ]);
  const error = unstamped.error ?? stamped.error;
  if (error) throw new Error(`sitesDueSetupReminder: ${error.message}`);

  const due = (row: ReminderRow) =>
    dueReminderIndex({ paidAt: new Date(row.created_at), sent: row.setup_reminders_sent, now }) !== null;
  const stampedDue: string[] = [];
  for (const row of (stamped.data ?? []).filter(due)) {
    if (!(await standingOf(row)).live) stampedDue.push(row.id);
  }
  return [...(unstamped.data ?? []).filter(due).map((row) => row.id), ...stampedDue];
}

/** What a stamped site still lacks: live (a published page, or a destination with `health = 'ok'`), whether a page is
 *  written, and where its hosted host's DNS is managed. */
interface Standing {
  live: boolean;
  written: boolean;
  hosted: boolean;
}

async function standingOf(row: ReminderRow): Promise<Standing> {
  const db = untyped();
  const [published, destinations, written] = await Promise.all([
    db.from<{ id: string }>("publications").select("id").eq("site_id", row.id).not("published_at", "is", null).limit(1),
    db.from<{ kind: string; health: string }>("destinations").select("kind, health").eq("site_id", row.id).is("deleted_at", null),
    db.from<{ id: string }>("drafts").select("id").eq("site_id", row.id).not("body_md", "is", null).limit(1),
  ]);
  const error = published.error ?? destinations.error ?? written.error;
  if (error) throw new Error(`sendSetupReminder: could not read site ${row.id}: ${error.message}`);
  const held = destinations.data ?? [];
  return {
    live: (published.data ?? []).length > 0 || held.some((d) => d.health === "ok"),
    written: (written.data ?? []).length > 0,
    hosted: held.some((d) => d.kind === "hosted"),
  };
}

/** The DNS provider's name for `{provider}`, or `null` where it is not known: one free NS lookup, never a vendor call. */
async function providerFor(domain: string): Promise<string | null> {
  const { dnsZoneOf, dnsWhereFrom } = await import("@/lib/publish/destinations/hosted/dns-provider");
  const zone = dnsZoneOf(domain);
  if (zone === null) return null;
  const { nameserversOf } = await import("@/lib/egress");
  const where = dnsWhereFrom(await nameserversOf(zone));
  return where.kind === "provider" ? where.provider : null;
}

async function readReminderRow(siteId: string): Promise<ReminderRow | null> {
  const { data, error } = await untyped()
    .from<ReminderRow>("sites")
    .select(ROW_COLUMNS)
    .eq("id", siteId)
    .limit(1);
  if (error) throw new Error(`sendSetupReminder: could not read site ${siteId}: ${error.message}`);
  return data?.[0] ?? null;
}

/** `users.email`, or `"cancelled"` once the founder has cancelled or withdrawn: a reminder to connect is never sent after either. */
async function addressFor(userId: string): Promise<string | "cancelled" | null> {
  const { data, error } = await untyped()
    .from<{ email: string; cancelled_at: string | null; deleted_at: string | null }>("users")
    .select("email, cancelled_at, deleted_at")
    .eq("id", userId)
    .limit(1);
  if (error) throw new Error(`sendSetupReminder: could not read user ${userId}: ${error.message}`);
  const user = data?.[0];
  if (user?.cancelled_at || user?.deleted_at) return "cancelled";
  return user?.email ?? null;
}

/** Sends one founder's next reminder: due-ness, link, mail, then counter, so a failure at any step consumes nothing. */
export async function sendSetupReminder(
  siteId: string,
  now: Date = new Date()
): Promise<ReminderOutcome> {
  const row = await readReminderRow(siteId);
  if (row === null) return { sent: false, reason: "not-due" };
  const index = dueReminderIndex({
    paidAt: new Date(row.created_at),
    sent: row.setup_reminders_sent,
    now,
  });
  if (index === null) return { sent: false, reason: "not-due" };

  const standing = row.setup_completed_at === null ? null : await standingOf(row);
  if (standing?.live) return { sent: false, reason: "live" };

  const to = await addressFor(row.user_id);
  if (to === "cancelled") return { sent: false, reason: "cancelled" };
  if (to === null) return { sent: false, reason: "no-link" };

  // REQ-025 c6: no reminder before there is an account; no account means no link, no send, and the founder due again.
  let href: string | null;
  try {
    href = await issueSignInLink({ userId: row.user_id, email: to, landsOn: standing === null ? SETUP_LANDING_PATH : CONNECT_LANDING_PATH });
  } catch {
    return { sent: false, reason: "no-link" };
  }
  if (href === null) return { sent: false, reason: "no-link" };

  const connect =
    standing === null
      ? undefined
      : { written: standing.written, provider: standing.hosted ? await providerFor(row.domain).catch(() => null) : null };
  const mail = buildSetupReminder({ signInHref: href, connect });
  const result = await sendEmail({
    kind: "setup-reminder",
    to,
    subject: mail.subject,
    preheader: mail.preheader,
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
