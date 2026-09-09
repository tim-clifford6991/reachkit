// BUILD §12, §11 — the occasion of the Monday digest.
//
// `buildWeekly` composed it and `weeklyDigest` read what it needs, and no
// module called either: the weekly mail was never sent (#181). Journey 06
// composed it and handed it to the send seam by hand, which is what this
// module does for real.
//
// **Once per `(site_id, week_start)`, and the key is a stamp on the week's
// own row.** `scans` already carries one row per site-week under a partial
// unique index, so the digest's once-ness is a column on that row
// (`digest_sent_at`) and not a table of its own. It is stamped **only
// where the seam accepted the mail**: a send it refused — an owner-owed
// line that will not compose, a switch the customer turned off, a vendor
// that would not take it — leaves the week unstamped, so the next tick
// offers it again. Recording a refusal as though it were a send would burn
// the week, and the refusal that matters most is a line the owner has not
// written yet: the mail has to go the moment they write it.
//
// **A week the site did not measure sends no mail** (ADR-071: no row, no
// state). Not an empty digest and not a "nothing happened" note — a week
// with no measurement has nothing to report *about*, and the account of
// what is owed and when the next one is due belongs to the screens, which
// state it from the same `accountForWeek` this module reads. A week that
// was measured and reached only some of its sections **does** send, with
// the sections it missed named: that is REQ-064 c4, and it is the arm the
// omission rule exists for.
//
// **The digest is composed for the week, never re-measured.** Every figure
// comes from what is already stored: the standings from `weeklyDigest`,
// the two deltas from `weekMovement`, the next three from the ranking as
// it stands. A mail that re-measured to state a movement would report a
// different week from the one it announces.
import { dbAdmin } from "@/lib/db";
import { WEEKLY_NEXT_COUNT } from "@/lib/config/constants";
import type { CopyKey } from "@/lib/presentation/copy";
import { measured, type Measured } from "@/lib/measure/measured";
import { rankOpen, weeklyDigest } from "@/lib/opportunities";
import { opportunityStore, readOpportunity } from "@/lib/opportunities/store";
import { accountForWeek, weekMovement, type UnmeasuredPart } from "@/lib/scan/weekly";
import type { MeasurementState } from "../shell/compose";
import { sendEmail } from "../send";
import { buildWeekly, type WeeklyPage } from "../templates/weekly";

/** Why a digest did not go out. Every arm is reported; none is silent, and
 *  `not-composable` is its own arm rather than folded into `mail` —
 *  it is the one refusal that means "the owner has not written this yet",
 *  and an operator asking why Monday was quiet is owed that answer
 *  distinctly. */
export type WeeklyDigestOutcome =
  | { sent: true; id: string }
  | {
      sent: false;
      reason: "already-sent" | "not-measured" | "no-account" | "not-composable" | "mail";
    };

/** The six parts a partial week can be missing, each under the one name
 *  the product calls it. A `Record`, so a seventh part could not be added
 *  without a name for it (REQ-064 c4 names the sections it missed, and an
 *  unnamed one would be a section the customer is told about and cannot
 *  identify). */
const SECTION_NAME: Readonly<Record<UnmeasuredPart, CopyKey>> = Object.freeze({
  on_page: "mail.section.on_page",
  market: "mail.section.market",
  rankings: "mail.section.rankings",
  ai_answers: "mail.section.ai_answers",
  rivals: "mail.section.rivals",
  score: "mail.section.score",
});

interface MinimalResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}
interface MinimalQuery<T> extends PromiseLike<MinimalResult<T>> {
  select(columns: string): MinimalQuery<T>;
  eq(column: string, value: unknown): MinimalQuery<T>;
  limit(n: number): MinimalQuery<T>;
  update(values: Record<string, unknown>): MinimalQuery<T>;
}
interface MinimalClient {
  from<T>(table: string): MinimalQuery<T>;
}

/** The same narrow cast the other mail occasions document: several columns
 *  this module reads are absent from the generated `Database` type. */
function untyped(): MinimalClient {
  return dbAdmin() as unknown as MinimalClient;
}

interface WeekRow {
  id: string;
  digest_sent_at: string | null;
}

/**
 * Sends one site's Monday digest for one week.
 *
 * Called by the weekly tick after the measurement, per site, and never
 * from inside the measurement itself: the pass records what it measured
 * and stops, and the two obligations of one tick are visible in the job.
 */
export async function sendWeeklyDigest(a: {
  siteId: string;
  weekStart: string;
  now?: Date;
}): Promise<WeeklyDigestOutcome> {
  const now = a.now ?? new Date();

  // The week's own row, and the stamp that says it has already been told.
  // Read first: a re-run of the tick must reach neither the digest nor the
  // seam.
  const week = await readWeekRow(a);
  if (week === null) return { sent: false, reason: "not-measured" };
  if (week.digest_sent_at !== null) return { sent: false, reason: "already-sent" };

  // ADR-071: no row, no state. A week that was not measured is not a week
  // with an empty digest — it has nothing to report about, and what is
  // owed instead is the screens' account, not a mail.
  const account = await accountForWeek({ siteId: a.siteId, weekStart: a.weekStart, now });
  if (account.kind === "not_measured" || account.kind === "not_owed") {
    return { sent: false, reason: "not-measured" };
  }

  const recipient = await readRecipient(a.siteId);
  if (recipient === null) return { sent: false, reason: "no-account" };

  const digest = await weeklyDigest({ siteId: a.siteId, week: a.weekStart });
  // The date every figure in this mail is stated as of. `weekMeasuredAt`
  // is the week's own; the account's is the same date read from the same
  // row, and it is the fallback only because the two arms come from two
  // readers — never `now`, which would date a stored week to the moment
  // the mail happened to be composed.
  const at = digest.weekMeasuredAt ?? account.measuredAt;

  const movement = await weekMovement({ siteId: a.siteId, weekStart: a.weekStart, at });
  const pages: readonly WeeklyPage[] = digest.standings.map((standing) => ({
    liveUrl: standing.liveUrl,
    standing: standing.standing,
  }));

  const mail = buildWeekly({
    scoreDelta: movement.scoreDelta,
    aiAnswersDelta: movement.aiAnswersDelta,
    // Measured, and measured-empty where the week judged nothing: "you
    // have published nothing yet" is a result, and the template's own
    // empty line states it. The `unmeasured` arm belongs to a week that
    // produced no standings to read at all, which is the not-measured
    // case this function has already returned on.
    pages: measured(pages, at),
    next: await nextThree(a.siteId, at),
  });

  const result = await sendEmail({
    kind: "weekly",
    to: recipient.email,
    userId: recipient.userId,
    subject: mail.subject,
    blocks: mail.blocks,
    reason: mail.reason,
    measurement: measurementStateOf(account),
  });

  if (!result.sent) {
    // `not-composable` is the owner's unwritten line, reported as itself.
    // Nothing is stamped either way: the week stays open and the next tick
    // offers it again.
    return { sent: false, reason: result.reason === "not-composable" ? "not-composable" : "mail" };
  }

  await stampSent(week.id, now);
  return { sent: true, id: result.id };
}

/** §12's "next 3", by the ranking as it stands. Measured-and-empty where
 *  the supply has run out — the calendar is never padded, and an empty
 *  list of next pages is a result the template states in one line. */
async function nextThree(siteId: string, at: Date): Promise<Measured<readonly { targetQuery: string }[]>> {
  const ranked = await rankOpen(siteId);
  const store = opportunityStore();
  const rows = await Promise.all(
    ranked.slice(0, WEEKLY_NEXT_COUNT).map((entry) => store.byId(entry.opportunityId))
  );
  const next = rows
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .map((row) => readOpportunity(row).targetQuery)
    // An opportunity with no target search has nothing to name, and
    // naming it some other way would be a second identity for one row.
    .filter((targetQuery): targetQuery is string => targetQuery !== null)
    .map((targetQuery) => ({ targetQuery }));
  return measured(next, at);
}

/** The account, as the compose shell states it. A complete week says so
 *  and carries no line; a partial one names the sections it missed. The
 *  other two arms never reach here. */
function measurementStateOf(account: {
  kind: "complete" | "partial";
  unmeasured?: readonly UnmeasuredPart[];
}): MeasurementState {
  if (account.kind === "complete") return { state: "complete" };
  return {
    state: "partial",
    unmeasured: (account.unmeasured ?? []).map((part) => SECTION_NAME[part]),
  };
}

async function readWeekRow(a: { siteId: string; weekStart: string }): Promise<WeekRow | null> {
  const { data, error } = await untyped()
    .from<WeekRow>("scans")
    .select("id, digest_sent_at")
    .eq("site_id", a.siteId)
    .eq("tier", "weekly")
    .eq("week_start", a.weekStart)
    .limit(1);
  if (error !== null) {
    throw new Error(`sendWeeklyDigest(${a.siteId}, ${a.weekStart}): ${error.message}`);
  }
  return data?.[0] ?? null;
}

async function readRecipient(siteId: string): Promise<{ email: string; userId: string } | null> {
  const { data: sites, error: siteError } = await untyped()
    .from<{ id: string; user_id: string }>("sites")
    .select("id, user_id")
    .eq("id", siteId)
    .limit(1);
  if (siteError !== null) throw new Error(`sendWeeklyDigest(${siteId}): ${siteError.message}`);
  const site = sites?.[0];
  if (site === undefined) return null;

  const { data: users, error: userError } = await untyped()
    .from<{ email: string }>("users")
    .select("email")
    .eq("id", site.user_id)
    .limit(1);
  if (userError !== null) throw new Error(`sendWeeklyDigest(${siteId}): ${userError.message}`);
  const email = users?.[0]?.email;
  return email === undefined ? null : { email, userId: site.user_id };
}

/** The stamp, written after the seam accepted the mail and never before. */
async function stampSent(scanId: string, at: Date): Promise<void> {
  const { error } = await untyped()
    .from<WeekRow>("scans")
    .update({ digest_sent_at: at.toISOString() })
    .eq("id", scanId);
  if (error !== null) {
    throw new Error(`sendWeeklyDigest: could not stamp the digest as sent: ${error.message}`);
  }
}
