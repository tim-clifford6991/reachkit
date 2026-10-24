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
// Overview's numbers through Overview's own readers, the technical checks that moved
// from `weekMovement`, the week's pages and spares from the week this
// Monday committed (issue 1559). A mail that re-measured to state a movement would report a
// different week from the one it announces.
import { dbAdmin } from "@/lib/db";
import { env } from "@/lib/config/env";
import { ANSWER_RATE_WEEKS, BLOG_READS_WINDOW_D, WEEK_PLAN } from "@/lib/config/constants";
import { measurePrompts } from "@/lib/market/prompts/rate";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { aiPagesOf, bestMoverOf, isFirstMonday, monthFiguresOf } from "@/lib/measure/figures";
import { measured, measuredZero, unmeasured, type Measured } from "@/lib/measure/measured";
import { pageLadderOf } from "@/lib/measure/page-ladder";
import { contentOf } from "@/lib/measure/published";
import { readPublishedPages } from "@/lib/measure/published-store";
import { committedWeek, opportunityById, weeklyDigest } from "@/lib/opportunities";
import { placedByDay, plannedByDay, serviceWeek } from "@/lib/opportunities/days";
import { plannedStopToken } from "@/lib/opportunities/stop";
import { whyOf } from "@/lib/opportunities/why";
import { vetoLinkPath } from "@/lib/publish/publishable";
import { scheduledPagesFor } from "@/lib/publish/record";
import { heldPages } from "@/lib/publish/switch";
import { pauseTokenFor } from "@/lib/publish/switch/pause-link";
import { readPublishingSettings } from "@/lib/publish/settings/settings";
import { readBlogReadFacts } from "@/lib/publish/reads/facts";
import { assembleBlogReads, windowStartDay, type BlogReadsModel } from "@/lib/publish/reads/model";
import { readSearchVisits } from "@/lib/publish/reads/store";
import { readDeepReport } from "@/lib/scan/deep/report";
import { accountForWeek, readPromptWindow, readWeekScans, weekMovement, type UnmeasuredPart } from "@/lib/scan/weekly";
import { formatMailClock } from "../blocks/format";
import { unsubscribeTokenFor } from "../notifications/unsubscribe";
import type { MeasurementState } from "../shell/compose";
import { sendEmail } from "../send";
import {
  buildWeekly,
  type GoogleStep,
  type WeeklyCalendar,
  type WeeklyNeedsYou,
  type WeeklyNext,
  type WeeklyNumbers,
  type WeeklyPage,
} from "../templates/weekly";

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

  const connect = await addressToConnect(a.siteId);
  const settings = await readPublishingSettings(a.siteId).catch(() => null);
  const zone = settings?.timezone ?? "UTC";
  const greeting =
    recipient.createdAt === null
      ? undefined
      : { name: recipient.name, week: serviceWeek(dayIn(recipient.createdAt, zone), a.weekStart), business: recipient.domain };
  const calendar: WeeklyCalendar | undefined =
    settings === null
      ? undefined
      : {
          days: weekDates(a.weekStart),
          today: dayIn(now, zone),
          time: formatMailClock(settings.publishTime),
          planHref: appHref("/app/calendar"),
        };
  const { mail, measurement } =
    account.kind === "not_measured"
      ? unmeasuredWeek(account.nextDueOn, now, connect, greeting)
      : await measuredWeek(a.siteId, a.weekStart, account, connect, now, greeting, calendar);

  // The footer's three ways out: pause every page, the mail settings, and
  // this one mail's unsubscribe, which a mail client can also press itself.
  const unsubscribe = encodeURIComponent(unsubscribeTokenFor({ userId: recipient.userId, kind: "weekly" }));
  const result = await sendEmail({
    kind: "weekly",
    to: recipient.email,
    userId: recipient.userId,
    subject: mail.subject,
    blocks: mail.blocks,
    reason: mail.reason,
    measurement,
    footerLinks: [
      { label: "mail.weekly.footer.pause", href: appHref(`/pause/${encodeURIComponent(pauseTokenFor(a.siteId))}`) },
      { label: "mail.weekly.footer.settings", href: appHref("/app/settings/mail") },
    ],
    optOut: { href: appHref(`/unsubscribe/${unsubscribe}`), oneClickHref: appHref(`/api/unsubscribe/${unsubscribe}`), mechanism: "unsubscribe" },
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
type Connect = { host: string; href: string };
type Greeting = { name: string | null; week: number; business: string };

function appHref(path: string): string {
  return new URL(path, env.NEXT_PUBLIC_APP_URL).toString();
}

/** The site-local date an instant falls on, `YYYY-MM-DD`. */
function dayIn(at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
}

/** Monday to Sunday of the week that starts on `weekStart`. */
function weekDates(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => new Date(Date.parse(`${weekStart}T12:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10));
}

/** The hosted address still waiting for its record, with the setup step
 *  that connects it. `undefined` once it is live, for a site with no hosted
 *  address, and where the read fails: the mail is never held for it. */
async function addressToConnect(siteId: string): Promise<Connect | undefined> {
  try {
    const { hostedHostFor } = await import("@/lib/publish/destinations/hosted/hostname");
    const host = await hostedHostFor(siteId);
    if (host === null || host.state === "live") return undefined;
    return { host: host.hostname, href: new URL("/setup/connect", env.NEXT_PUBLIC_APP_URL).toString() };
  } catch {
    return undefined;
  }
}

/** A week with no measurement: every section unmeasured, so every one is
 *  omitted, and the whole-mail line says so with the next due date. */
function unmeasuredWeek(nextDueOn: Date, now: Date, connect: Connect | undefined, greeting: Greeting | undefined): Composed {
  const gap = unmeasured<never>("undeterminable", now);
  return {
    // No numbers at all: the whole-mail line says the week was not
    // measured, once, and four rows saying it again would repeat it.
    mail: buildWeekly({ pages: gap, next: gap, ...(connect === undefined ? {} : { connect }), ...(greeting === undefined ? {} : { greeting }) }),
    measurement: { state: "none", nextDueOn },
  };
}

/** A week that was measured, in whole or in part: its stored figures. */
async function measuredWeek(
  siteId: string,
  weekStart: string,
  account: { kind: "complete" | "partial"; measuredAt: Date; unmeasured?: readonly UnmeasuredPart[] },
  connect: Connect | undefined,
  now: Date,
  greeting: Greeting | undefined,
  calendar: WeeklyCalendar | undefined
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
  const week = await theWeek(a.siteId, a.weekStart, at);
  const mail = buildWeekly({
    ...(greeting === undefined ? {} : { greeting }),
    ...(calendar === undefined ? {} : { calendar }),
    ...(connect === undefined ? {} : { connect }),
    numbers: await weeklyNumbers(a.siteId, a.weekStart, now),
    ...(needsYou === undefined ? {} : { needsYou }),
    // Measured, and measured-empty where the week judged nothing: "you
    // have published nothing yet" is a result, and the template's own
    // empty line states it.
    pages: measured(pages, at),
    ...week,
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
 * Overview's weekly figures (the simple model, owner 2026-10-19: "app and
 * Monday email, same numbers"), read at `now` with Overview's own readers.
 *
 * Every read fails soft: a page list that cannot be read leaves the live
 * count unmeasured and draws no Google or AI row, and a figure nothing read
 * says so. The mail is never held back for one number.
 */
async function weeklyNumbers(siteId: string, weekStart: string, now: Date): Promise<WeeklyNumbers> {
  const [content, reads] = await Promise.all([
    readPublishedPages(siteId).then((pages) => contentOf({ pages, now })).catch(() => null),
    blogReadsOf(siteId, now),
  ]);
  const planned = await weekPages(siteId, weekStart).then(
    (n) => counted(n, now),
    () => unmeasured<number>("undeterminable", now)
  );
  const month = isFirstMonday(weekStart) ? await monthNumbers(siteId, weekStart, now) : undefined;
  const ladder = content === null ? null : pageLadderOf(content.pages, now, reads === null ? null : await reads.visits);
  if (ladder === null) {
    return { live: content === null ? unmeasured<number>("undeterminable", now) : counted(0, now), planned, ...(month === undefined ? {} : { month }) };
  }
  const live = (content?.pages ?? []).filter((page) => page.publishedAt <= now);
  const ai = aiPagesOf(live);
  const mover = bestMoverOf(live, now);
  const steps = ladder.google.flatMap((step) =>
    step.name === "draft.ladder.live"
      ? []
      : [{ name: step.name as GoogleStep, count: step.count === null ? unmeasured<number>("undeterminable", now) : counted(step.count, now), of: step.of }]
  );
  const showing = ladder.google.find((step) => step.name === "draft.ladder.showing")?.count;
  return {
    live: counted(ladder.live, now),
    planned,
    google: {
      steps,
      early: showing === 0,
      climbing: ladder.climbing,
      ...(ladder.visits === null || ladder.visits === 0 ? {} : { visits: counted(ladder.visits, now) }),
      ...(mover === undefined
        ? {}
        : { climb: mover === null ? null : { search: mover.search, from: mover.first.place, to: mover.place, climbing: mover.climbing } }),
    },
    ai: {
      linked: ai === null ? unmeasured<number>("not_attempted", now) : counted(ai.linked.length, now),
      asked: ai?.asked.length ?? 0,
      ...(reads === null || reads.model.fetches.kind === "unmeasured" ? {} : { reads: reads.model.fetches }),
    },
    ...(month === undefined ? {} : { month }),
  };
}

async function weekPages(siteId: string, weekStart: string): Promise<number> {
  return (await weekEntries(siteId, weekStart)).entries.length;
}

/** The pages this week carries, Monday to Sunday, by Plan's rule (Overview's
 *  "We chose {n} pages"): each date's scheduled draft, else its committed row. */
async function weekEntries(
  siteId: string,
  weekStart: string
): Promise<{
  entries: { day: string; opportunityId: string; draftId: string | null }[];
  committed: Awaited<ReturnType<typeof committedWeek>>;
}> {
  const days = weekDates(weekStart);
  const [pages, held, committed] = await Promise.all([
    scheduledPagesFor({ siteId, from: days[0]!, to: days[6]! }),
    heldPages(siteId),
    committedWeek(siteId),
  ]);
  const placed = placedByDay(pages, new Set(held.draftIds), weekStart).byDay;
  const planned = plannedByDay(committed.days, placed, days);
  const entries = days.flatMap((day): { day: string; opportunityId: string; draftId: string | null }[] => {
    const page = placed.get(day);
    if (page !== undefined) return [{ day, opportunityId: page.opportunityId, draftId: page.draftId }];
    const id = planned.get(day);
    return id === undefined ? [] : [{ day, opportunityId: id, draftId: null }];
  });
  return { entries, committed };
}

/** The hosted pages' AI reads and Google visits, as Overview's providers read
 *  them; `null` off a hosted blog, before a page is live there, or on a failed read. */
async function blogReadsOf(
  siteId: string,
  now: Date
): Promise<{ model: BlogReadsModel; visits: Promise<number | null> } | null> {
  try {
    const model = assembleBlogReads(await readBlogReadFacts({ siteId }, now, BLOG_READS_WINDOW_D), BLOG_READS_WINDOW_D, now);
    if (!model.show) return null;
    return { model, visits: readSearchVisits({ siteId, sinceDay: windowStartDay(now, BLOG_READS_WINDOW_D) }).catch(() => null) };
  } catch {
    return null;
  }
}

/**
 * The first mail of a month (M-b): the figures Overview's *Measures that move
 * over months* reads from this same first-Monday pass — its score and market
 * against the customer's scan, and reputation over the prompt window to it.
 * `undefined` where none of them was stored.
 */
async function monthNumbers(siteId: string, weekStart: string, now: Date): Promise<WeeklyNumbers["month"]> {
  const [reading, scan, rate] = await Promise.all([
    readWeekScans({ siteId, weekStarts: [weekStart] })
      .then((weeks) => monthFiguresOf(weeks.get(weekStart)?.report ?? null))
      .catch(() => monthFiguresOf(null)),
    readDeepReport(siteId)
      .then((deep) => monthFiguresOf(deep?.report ?? null))
      .catch(() => monthFiguresOf(null)),
    readPromptWindow({ siteId, weekStart })
      .then((window) => measurePrompts(window.weeks.flatMap((week) => week.samples)).rate)
      .catch(() => null),
  ]);
  const change = (value: number, before: number | null) => (before === null ? {} : { change: counted(value - before, now) });
  const month = {
    ...(reading.score === null ? {} : { score: { value: counted(reading.score, now), ...change(reading.score, scan.score) } }),
    ...(reading.market === null
      ? {}
      : {
          market: {
            value: counted(reading.market.top10, now),
            of: reading.market.of,
            ...change(reading.market.top10, scan.market?.top10 ?? null),
          },
        }),
    ...(rate === null
      ? {}
      : { reputation: { value: counted(rate.linked + rate.named, now), answers: rate.samples, weeks: ANSWER_RATE_WEEKS } }),
  };
  return Object.keys(month).length === 0 ? undefined : month;
}

/** A count that was taken: a zero is a result, in its own arm. */
function counted(value: number, at: Date): Measured<number> {
  return value === 0 ? measuredZero(0, at) : measured(value, at);
}

/** The week's pages, Monday to Sunday, by the rule the planned count uses:
 *  each with its day, whether it updates a page, why it was chosen, and the
 *  links that stop or open it; and the spares. An empty week is a result the
 *  template states in one line — the calendar is never padded. */
async function theWeek(
  siteId: string,
  weekStart: string,
  at: Date
): Promise<{ next: Measured<readonly WeeklyNext[]>; spares: Measured<readonly { targetQuery: string }[]>; skippedDays: number }> {
  const { entries, committed } = await weekEntries(siteId, weekStart);
  const open = new Map(committed.days.map(({ opportunity }) => [opportunity.id, opportunity]));
  const days: WeeklyNext[] = [];
  for (const entry of entries) {
    const opportunity = open.get(entry.opportunityId) ?? (await opportunityById(entry.opportunityId).catch(() => null));
    // An opportunity with no target search has nothing to name, and naming it
    // some other way would be a second identity for one row.
    if (opportunity === null || opportunity === undefined || opportunity.targetQuery === null) continue;
    const why = whyOf(opportunity.planReason);
    const draftHref = entry.draftId === null ? null : appHref(`/app/draft/${encodeURIComponent(entry.draftId)}`);
    days.push({
      targetQuery: opportunity.targetQuery,
      day: entry.day,
      update: opportunity.evidence.family === "improve" || opportunity.evidence.family === "fix",
      ...(why === undefined ? {} : { why: copy(why.sentence) }),
      // A written page is stopped where it is read; a planned one by its own signed link.
      stopHref: draftHref ?? stopHrefOf(siteId, opportunity.id, entry.day),
      editHref: draftHref ?? appHref("/app/calendar"),
    });
  }
  const named = committed.spares.flatMap((row) => (row.targetQuery === null ? [] : [{ targetQuery: row.targetQuery }]));
  return { next: measured(days, at), spares: measured(named, at), skippedDays: WEEK_PLAN.days - entries.length };
}

function stopHrefOf(siteId: string, opportunityId: string, day: string): string {
  const token = plannedStopToken({ siteId, opportunityId, day });
  return new URL(vetoLinkPath(token), env.NEXT_PUBLIC_APP_URL).toString();
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

async function readRecipient(
  siteId: string
): Promise<{ email: string; userId: string; name: string | null; domain: string; createdAt: Date | null } | null> {
  const { data: sites, error: siteError } = await untyped()
    .from<{ id: string; user_id: string; domain: string; created_at: string | null }>("sites")
    .select("id, user_id, domain, created_at")
    .eq("id", siteId)
    .limit(1);
  if (siteError !== null) throw new Error(`sendWeeklyDigest(${siteId}): ${siteError.message}`);
  const site = sites?.[0];
  if (site === undefined) return null;

  const { data: users, error: userError } = await untyped()
    .from<{ email: string; name: string | null }>("users")
    .select("email, name")
    .eq("id", site.user_id)
    .limit(1);
  if (userError !== null) throw new Error(`sendWeeklyDigest(${siteId}): ${userError.message}`);
  const user = users?.[0];
  if (user === undefined) return null;
  const created = site.created_at == null ? Number.NaN : Date.parse(site.created_at);
  return {
    email: user.email,
    userId: site.user_id,
    name: user.name ?? null,
    domain: site.domain,
    createdAt: Number.isNaN(created) ? null : new Date(created),
  };
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
