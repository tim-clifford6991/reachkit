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
// **An unmeasured week still sends, saying so** (SPEC §8, Weekly: "Unmeasured
// week still sends, saying so"). Its row exists — a failed pass leaves one —
// and its account says `not_measured`: the digest carries no section and no
// figure, only the whole-mail line naming the date the next measurement is
// due, and it is stamped like any other week. A week with **no row at all**
// has no key to be told once against and still sends nothing, and neither
// does a site whose access has ended (`not_owed`: "Stops: … access ends").
// A week measured only in part sends with the sections it missed named
// (REQ-064 c4).
//
// **The digest is composed for the week, never re-measured.** Every figure
// comes from what is already stored: the standings from `weeklyDigest`,
// D22's four headline numbers from the prompt window, the week's verdict
// rows and the hosted blog's read counts, the technical checks that moved
// from `weekMovement`, the next three from the ranking as it stands. A mail that re-measured to state a movement would report a
// different week from the one it announces.
import { dbAdmin } from "@/lib/db";
import { env } from "@/lib/config/env";
import { ANSWER_RATE_WEEKS, BLOG_READS_WINDOW_D, MENTION_RATE_MIN_WEEKS, WEEKLY_NEXT_COUNT } from "@/lib/config/constants";
import { measurePrompts } from "@/lib/market/prompts/rate";
import type { CopyKey } from "@/lib/presentation/copy";
import { measured, measuredZero, unmeasured, type Measured } from "@/lib/measure/measured";
import { rankOpen, weeklyDigest } from "@/lib/opportunities";
import { opportunityStore, readOpportunity } from "@/lib/opportunities/store";
import { accountForWeek, previousWeekStart, readPromptWindow, weekMovement, type UnmeasuredPart } from "@/lib/scan/weekly";
import type { MeasurementState } from "../shell/compose";
import { sendEmail } from "../send";
import { buildWeekly, type WeeklyNeedsYou, type WeeklyNumbers, type WeeklyPage } from "../templates/weekly";

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
  is(column: string, value: unknown): MinimalQuery<T>;
  not(column: string, operator: string, value: unknown): MinimalQuery<T>;
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

  // Access has ended: no week is owed and none is announced.
  const account = await accountForWeek({ siteId: a.siteId, weekStart: a.weekStart, now });
  if (account.kind === "not_owed") return { sent: false, reason: "not-measured" };

  const recipient = await readRecipient(a.siteId);
  if (recipient === null) return { sent: false, reason: "no-account" };

  const { mail, measurement } =
    account.kind === "not_measured"
      ? unmeasuredWeek(account.nextDueOn, now)
      : await measuredWeek(a.siteId, a.weekStart, account);

  const result = await sendEmail({
    kind: "weekly",
    to: recipient.email,
    userId: recipient.userId,
    subject: mail.subject,
    blocks: mail.blocks,
    reason: mail.reason,
    measurement,
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

type Composed = { mail: ReturnType<typeof buildWeekly>; measurement: MeasurementState };

/** A week with no measurement: every section unmeasured, so every one is
 *  omitted, and the whole-mail line says so with the next due date. */
function unmeasuredWeek(nextDueOn: Date, now: Date): Composed {
  const gap = unmeasured<never>("undeterminable", now);
  return {
    // No numbers at all: the whole-mail line says the week was not
    // measured, once, and four rows saying it again would repeat it.
    mail: buildWeekly({ pages: gap, next: gap }),
    measurement: { state: "none", nextDueOn },
  };
}

/** A week that was measured, in whole or in part: its stored figures. */
async function measuredWeek(
  siteId: string,
  weekStart: string,
  account: { kind: "complete" | "partial"; measuredAt: Date; unmeasured?: readonly UnmeasuredPart[] }
): Promise<Composed> {
  const a = { siteId, weekStart };

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
    ...(standing.indexState === undefined ? {} : { indexState: standing.indexState }),
  }));

  const needsYou = await oneNeedsYou(a.siteId);
  const mail = buildWeekly({
    // SPEC §8 (2026-10-07, issue 1329): the headline numbers lead.
    numbers: {
      ...(await headlineNumbers(a.siteId, a.weekStart, at)),
      // Issue 1551: the pages' own questions cited lead, from the same
      // stored week the movement is read from.
      ...(movement.pagesCited.kind === "unmeasured"
        ? {}
        : {
            pageQuestions: {
              cited: counted(movement.pagesCited.value.cited, at),
              asked: movement.pagesCited.value.asked,
            },
          }),
    },
    ...(needsYou === undefined ? {} : { needsYou }),
    // Measured, and measured-empty where the week judged nothing: "you
    // have published nothing yet" is a result, and the template's own
    // empty line states it.
    pages: measured(pages, at),
    next: await nextThree(a.siteId, at),
    // SPEC §9 on Monday: the checks whose count moved, from the same two
    // stored weeks the deltas are read from.
    issues: movement.issueChanges,
    // SPEC §8 2026-09-29 (D16): the tracked questions that now name the
    // site, each with its answer's address. No page is credited here.
    nowNamed: measured(
      movement.nowNamed.map((question) => ({ search: question.search, answerUrl: answerUrlOf(question.search) })),
      at
    ),
    // D28 (#1185): what ReachKit changed about the market this week.
    marketChanges: await marketChangesSince(a.siteId, a.weekStart),
  });
  return { mail, measurement: measurementStateOf(account) };
}

/** Where the answer to a tracked question is read: the search it was
 *  phrased from, on Google, which is the engine the reading is counted
 *  from (SPEC §4 2026-09-17). */
function answerUrlOf(search: string): string {
  const url = new URL("https://www.google.com/search");
  url.searchParams.set("q", search);
  return url.toString();
}

/**
 * D22's four headline numbers (SPEC §4, 2026-10-02), each from stored rows.
 *
 * Every read fails soft into `unmeasured`, and the row then says the number
 * was not measured: the mail is never held back for one number, and a read
 * that failed is never a zero.
 */
async function headlineNumbers(siteId: string, weekStart: string, at: Date): Promise<WeeklyNumbers> {
  const [prompts, top20, aiVisits] = await Promise.all([
    promptNumbers(siteId, weekStart, at),
    top20Pages(siteId, weekStart, at),
    aiVisitsOf(siteId, at),
  ]);
  return { ...prompts, weeks: ANSWER_RATE_WEEKS, ...top20, ...(aiVisits === undefined ? {} : { aiVisits }) };
}

/**
 * D22 · D19 (#1162): the AI mention rate as the Overview states it — the
 * same window, the same measure — and the pages those answers cited. Both
 * are unmeasured where no pass in the window asked the prompts, or the
 * window cannot be read.
 */
async function promptNumbers(
  siteId: string,
  weekStart: string,
  at: Date
): Promise<Pick<WeeklyNumbers, "mentions" | "pagesCited">> {
  const gap = unmeasured<number>("undeterminable", at);
  const none = { mentions: { kind: "rate", rate: gap, low: 0, high: 0 }, pagesCited: gap } as const;
  try {
    const window = await readPromptWindow({ siteId, weekStart });
    const measure = measurePrompts(window.weeks.flatMap((week) => week.samples));
    if (measure.rate === null) return none;
    const percent = (fraction: number): number => Math.round(fraction * 100);
    const mentioned = measure.rate.linked + measure.rate.named;
    return {
      // D58: no rate before two weeks of the current prompt set — the
      // count and its sample stand in its place.
      mentions:
        window.weeks.length >= MENTION_RATE_MIN_WEEKS
          ? {
              kind: "rate",
              rate: counted(percent(measure.rate.rate), at),
              low: percent(measure.rate.low),
              high: percent(measure.rate.high),
            }
          : { kind: "count", mentioned: counted(mentioned, at), answers: measure.rate.samples },
      pagesCited: counted(measure.pages.length, at),
    };
  } catch {
    return none;
  }
}

/** A count that was taken: a zero is a result, in its own arm. */
function counted(value: number, at: Date): Measured<number> {
  return value === 0 ? measuredZero(0, at) : measured(value, at);
}

/** The best place D22's third number counts (SPEC §4, 2026-10-02). */
const TOP_PLACES = 20;

/**
 * D22's third: the published pages whose search the site holds a top-20
 * place for, counted from the week's own verdict rows — the place
 * `judgeWeek` stored beside each verdict (`page_verdicts.measured`). The
 * same rows the mail's *pages judged* list is read from, so the count and
 * the list cannot disagree, and nothing is measured again for it.
 *
 * A week that judged no page holds no place, which is a zero that was
 * measured: this function is reached only for a week that was. A week that
 * judged pages and stored a place for none of them is unmeasured.
 *
 * The change is against the Monday before, where that week stored places
 * too: two measurements or no change stated.
 */
async function top20Pages(
  siteId: string,
  weekStart: string,
  at: Date
): Promise<Pick<WeeklyNumbers, "top20" | "top20Change">> {
  try {
    const { verdictStore } = await import("@/lib/opportunities/verdicts/store");
    const store = verdictStore();
    const [thisWeek, weekBefore] = await Promise.all([
      store.verdictsForWeek({ siteId, week: weekStart }),
      store.verdictsForWeek({ siteId, week: previousWeekStart(weekStart) }),
    ]);
    const now = placedInTop(thisWeek.map((row) => row.measured));
    if (now === null) return { top20: unmeasured<number>("undeterminable", at) };
    const before = weekBefore.length === 0 ? null : placedInTop(weekBefore.map((row) => row.measured));
    return {
      top20: counted(now, at),
      ...(before === null ? {} : { top20Change: counted(now - before, at) }),
    };
  } catch {
    return { top20: unmeasured<number>("undeterminable", at) };
  }
}

/** How many of a week's stored places are inside the top twenty. `null`
 *  where rows exist and none of them stored a place. */
function placedInTop(places: readonly (Measured<number> | null)[]): number | null {
  const read = places.filter((place) => place !== null && place.kind !== "unmeasured");
  if (places.length > 0 && read.length === 0) return null;
  return read.filter((place) => place?.kind === "measured" && place.value >= 1 && place.value <= TOP_PLACES).length;
}

/**
 * D22's fourth: pages an answer engine fetched on the hosted blog, over the
 * window the AI answers tab reads — the same facts and the same model, so
 * the mail and the tile state one number. `undefined` off a hosted blog or
 * before a page is live there, and the mail then has no such row.
 */
async function aiVisitsOf(siteId: string, at: Date): Promise<WeeklyNumbers["aiVisits"]> {
  try {
    const [{ readBlogReadFacts }, { assembleBlogReads }] = await Promise.all([
      import("@/lib/publish/reads/facts"),
      import("@/lib/publish/reads/model"),
    ]);
    const reads = assembleBlogReads(await readBlogReadFacts({ siteId }, at, BLOG_READS_WINDOW_D), BLOG_READS_WINDOW_D, at);
    return reads.show ? { fetches: reads.fetches, windowDays: reads.windowDays } : undefined;
  } catch {
    return undefined;
  }
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

/**
 * SPEC §8 (2026-09-20, #933) — "one needs-you item".
 *
 * One, and the newest: a page resting in `needs_attention` is the one thing
 * a customer must act on for the product to keep publishing, and a mail
 * that listed them all would be a second calendar. `undefined` where
 * nothing is waiting — the mail then says nothing about it, rather than
 * saying nothing is wrong.
 *
 * It states *that* a page needs them and opens it; **why** is the page's
 * own to say, on the screen that can also fix it (`needs-you.ts` derives
 * the cause, and the draft screen states it). A cause restated here would
 * be the second place the product words it.
 */
async function oneNeedsYou(siteId: string): Promise<WeeklyNeedsYou | undefined> {
  try {
    const { data, error } = await untyped()
      .from<{ id: string; title: string | null }>("drafts")
      .select("id, title")
      .eq("site_id", siteId)
      .eq("state", "needs_attention")
      .limit(1);
    if (error !== null) return undefined;
    const row = data?.[0];
    if (row === undefined) return undefined;
    const title = (row.title ?? "").trim();
    return {
      line: "mail.weekly.needsYou",
      // The page's own title where it has one — model text, and it reaches
      // the reader through a slot in a written sentence, never as a
      // sentence of ours. A page with no title yet is named by nothing, and
      // the line's slot then carries its address in the app instead.
      vars: { page: title === "" ? row.id : title },
      href: new URL(`/app/draft/${encodeURIComponent(row.id)}`, env.NEXT_PUBLIC_APP_URL).toString(),
    };
  } catch {
    return undefined;
  }
}

/** D28 (#1185): the change ReachKit's latest conclusion made, where it was
 *  made this week — the category it now measures and the rivals it added or
 *  dropped, each with its reason. Fails soft: no line rather than no mail. */
async function marketChangesSince(
  siteId: string,
  weekStart: string
): Promise<{ line: "mail.weekly.market.changed" | "mail.weekly.rival.added" | "mail.weekly.rival.dropped"; vars: Record<string, string> }[]> {
  try {
    const { readSiteMarket } = await import("@/lib/market/infer/stored");
    const change = (await readSiteMarket(siteId))?.stored.lastChange ?? null;
    if (change === null || change.at.slice(0, 10) < weekStart) return [];
    return [
      ...(change.category === null
        ? []
        : [{ line: "mail.weekly.market.changed" as const, vars: { category: change.category.to, reason: change.category.reason } }]),
      ...change.added.map((rival) => ({ line: "mail.weekly.rival.added" as const, vars: { rival: rival.name, reason: rival.reason } })),
      ...change.dropped.map((rival) => ({ line: "mail.weekly.rival.dropped" as const, vars: { rival } })),
    ];
  } catch {
    return [];
  }
}
