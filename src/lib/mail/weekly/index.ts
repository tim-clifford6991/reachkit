// BUILD §12, §11 — the occasion of the Monday digest, once per `(site_id, week_start)`, stamped as `scans.digest_sent_at` on the week's row.
// Stamped only where the seam accepted the mail: a refusal (unwritten line, switch off, vendor) leaves the week for the next tick,
// so the mail goes the moment a missing line is written.
// An unmeasured week still sends, saying so, with the next due date (SPEC §8). No row means no key, so nothing is sent, nor for `not_owed`
// (access ended). A partial week names the sections it missed (REQ-064 c4).
// Composed from stored figures, never re-measured, so the mail reports the week it announces.
import { dbAdmin } from "@/lib/db";
import { env } from "@/lib/config/env";
import { PAGES_LANDING_PATH } from "@/lib/account/identity/addresses";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { unmeasured, measured, type Measured } from "@/lib/measure/measured";
import { readPublishedPages } from "@/lib/measure/published-store";
import { pageTitle } from "@/lib/presentation/page-title";
import { resultsOf, type TilePass } from "@/lib/measure/results";
import { readTileRows } from "@/lib/measure/results-store";
import { committedWeek, opportunityById } from "@/lib/opportunities";
import { placedByDay, plannedByDay, serviceWeek } from "@/lib/opportunities/days";
import { plannedStopToken } from "@/lib/opportunities/stop";
import { whyOf } from "@/lib/opportunities/why";
import { vetoLinkPath } from "@/lib/publish/publishable";
import { scheduledPagesFor } from "@/lib/publish/record";
import { becameUpdate, critical, needsYouOf, setAsideOf } from "@/lib/publish/record/needs-you";
import { fromMail } from "@/lib/publish/reads/count";
import { heldPages } from "@/lib/publish/switch";
import { pauseTokenFor } from "@/lib/publish/switch/pause-link";
import { readPublishingSettings } from "@/lib/publish/settings/settings";
import { accountForWeek, weekStartFor, type UnmeasuredPart } from "@/lib/scan/weekly";
import { localDay } from "@/lib/scan/weekly/week";
import { formatMailClock } from "../blocks/format";
import { unsubscribeTokenFor } from "../notifications/unsubscribe";
import type { MeasurementState } from "../shell/compose";
import { sendEmail } from "../send";
import {
  buildWeekly,
  nameOf,
  type WeeklyCalendar,
  type WeeklyDid,
  type WeeklyDidPage,
  type WeeklyNeedsYou,
  type WeeklyNext,
  type WeeklyResults,
} from "../templates/weekly";

/** Why a digest did not go out. `not-composable` is its own arm: "the line is not written yet" is owed distinctly to whoever asks why Monday was quiet. */
export type WeeklyDigestOutcome =
  | { sent: true; id: string }
  | {
      sent: false;
      reason: "already-sent" | "not-measured" | "no-account" | "not-composable" | "mail";
    };

/** The six parts a partial week can miss, by product name; a `Record`, so each needs a name the customer can identify (REQ-064 c4). */
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
  gte(column: string, value: unknown): MinimalQuery<T>;
  lte(column: string, value: unknown): MinimalQuery<T>;
  not(column: string, operator: string, value: unknown): MinimalQuery<T>;
  limit(n: number): MinimalQuery<T>;
  update(values: Record<string, unknown>): MinimalQuery<T>;
}
interface MinimalClient {
  from<T>(table: string): MinimalQuery<T>;
}

/** The narrow cast the other occasions document: some columns read here are missing from the generated `Database` type. */
function untyped(): MinimalClient {
  return dbAdmin() as unknown as MinimalClient;
}

interface WeekRow {
  id: string;
  digest_sent_at: string | null;
}

/** Sends one site's digest for one week, from the weekly tick after the measurement, never inside it. */
export async function sendWeeklyDigest(a: {
  siteId: string;
  weekStart: string;
  now?: Date;
}): Promise<WeeklyDigestOutcome> {
  const now = a.now ?? new Date();

  // The week's row and its stamp, read first so a re-run reaches neither the digest nor the seam.
  const week = await readWeekRow(a);
  if (week === null) return { sent: false, reason: "not-measured" };
  if (week.digest_sent_at !== null) return { sent: false, reason: "already-sent" };

  // Access has ended: no week is owed and none is announced.
  const account = await accountForWeek({ siteId: a.siteId, weekStart: a.weekStart, now });
  if (account.kind === "not_owed") return { sent: false, reason: "not-measured" };

  const recipient = await readRecipient(a.siteId);
  if (recipient === null) return { sent: false, reason: "no-account" };

  const connect = await addressToConnect(a.siteId, recipient);
  const needsYou = await oneNeedsYou(a.siteId, now);
  const settings = await readPublishingSettings(a.siteId).catch(() => null);
  const zone = settings?.timezone ?? "UTC";
  // `created_at` is not null in the schema; a row read without one counts this as its first week.
  const since = recipient.createdAt === null ? a.weekStart : localDay(recipient.createdAt, zone);
  const greeting = { name: recipient.name, week: serviceWeek(since, a.weekStart), business: recipient.domain };
  const calendar: WeeklyCalendar | undefined =
    settings === null
      ? undefined
      : {
          today: localDay(now, zone),
          time: formatMailClock(settings.publishTime),
          planHref: appHref("/app/calendar"),
        };
  const head = { greeting, ...(connect === undefined ? {} : { connect }), ...(needsYou === undefined ? {} : { needsYou }) };
  const { mail, measurement } =
    account.kind === "not_measured"
      ? // No numbers: the whole-mail line already says the week was not measured.
        { mail: buildWeekly({ ...head, next: unmeasured("undeterminable", now) }), measurement: { state: "none", nextDueOn: account.nextDueOn } as const }
      : {
          mail: buildWeekly({ ...head, ...(calendar === undefined ? {} : { calendar }), ...(await measuredWeek({ siteId: a.siteId, domain: recipient.domain, weekStart: a.weekStart, zone, now })) }),
          measurement: measurementStateOf(account),
        };

  // The footer's ways out: pause every page, the mail settings, and this mail's unsubscribe, which an inbox can press too.
  const unsubscribe = encodeURIComponent(unsubscribeTokenFor({ userId: recipient.userId, kind: "weekly" }));
  const result = await sendEmail({
    kind: "weekly",
    to: recipient.email,
    event: `${a.siteId}/${a.weekStart}`,
    userId: recipient.userId,
    subject: mail.subject,
    ...(mail.subjectVars === undefined ? {} : { subjectVars: mail.subjectVars }),
    preheader: mail.preheader,
    blocks: mail.blocks,
    reason: mail.reason,
    measurement,
    footerLinks: [
      { label: "mail.weekly.footer.pause", href: appHref(`/pause/${encodeURIComponent(pauseTokenFor(a.siteId))}`) },
      { label: "mail.weekly.footer.settings", href: appHref("/app/settings/pages#mail") },
    ],
    optOut: { href: appHref(`/unsubscribe/${unsubscribe}`), oneClickHref: appHref(`/api/unsubscribe/${unsubscribe}`), mechanism: "unsubscribe" },
  });

  if (!result.sent) {
    // `not-composable` is reported as itself; nothing is stamped, so the next tick offers the week again.
    return { sent: false, reason: result.reason === "not-composable" ? "not-composable" : "mail" };
  }

  await stampSent(week.id, now);
  return { sent: true, id: result.id };
}

type Connect = { host: string; href: string; text?: CopyKey };

function appHref(path: string): string {
  return new URL(path, env.NEXT_PUBLIC_APP_URL).toString();
}

/** The date `days` after `day`, both `YYYY-MM-DD`. */
function plusDays(day: string, days: number): string {
  return new Date(Date.parse(`${day}T12:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

/** Monday to Sunday of the week that starts on `weekStart`. */
function weekDates(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => plusDays(weekStart, i));
}

const CONNECT_WORDPRESS = "mail.weekly.connect.wordpress" satisfies CopyKey;

/** The address waiting to be connected, with the step that connects it; `undefined` once live, with none, on a failed
 *  read, or with no address to name. */
async function addressToConnect(siteId: string, recipient: { userId: string; email: string; domain: string }): Promise<Connect | undefined> {
  try {
    const { hostedHostFor } = await import("@/lib/publish/destinations/hosted/hostname");
    const host = await hostedHostFor(siteId);
    if (host !== null) {
      if (host.state === "live" || host.hostname === "") return undefined;
      return { host: host.hostname, href: new URL("/setup/connect", env.NEXT_PUBLIC_APP_URL).toString() };
    }
    const { destinationWaitingOnWordPress } = await import("@/lib/publish/destinations");
    if (recipient.domain === "" || !(await destinationWaitingOnWordPress(siteId))) return undefined;
    // Signed so the press lands on Settings › Pages; with no link issued the notice still goes, unsigned.
    const { signInLinkTo } = await import("@/lib/account/identity/wire");
    const signed = await signInLinkTo({ userId: recipient.userId, to: recipient.email, landsOn: PAGES_LANDING_PATH }).catch(() => null);
    return { host: recipient.domain, href: signed ?? appHref(PAGES_LANDING_PATH), text: CONNECT_WORDPRESS };
  } catch {
    return undefined;
  }
}

/** A measured week, whole or in part: what we did last week, Overview's tiles at send time, and this week's pages. */
async function measuredWeek(a: {
  siteId: string;
  domain: string;
  weekStart: string;
  zone: string;
  now: Date;
}): Promise<{ did: WeeklyDid; results?: WeeklyResults; next: Measured<readonly WeeklyNext[]> }> {
  const { siteId, weekStart, zone, now } = a;
  // Overview's own reads over the same rows, read at the send; a failed read draws no results, never zeros.
  const week = weekStartFor({ at: now, zone });
  const [rows, published, pages, setAside, market, next] = await Promise.all([
    readTileRows({ siteId, domain: a.domain, week }).catch(() => null),
    readPublishedPages(siteId, now).catch(() => null),
    pagesLiveLastWeek(siteId, weekStart, zone).catch(() => []),
    setAsideLastWeek(siteId, weekStart).catch(() => undefined),
    marketChangesSince(siteId, weekStart),
    theWeek(siteId, weekStart, now),
  ]);
  const pass = rows?.passes.find((each) => each.weekStart === weekStart);
  const asked = pass === undefined ? null : askedOf(pass);
  const did: WeeklyDid = {
    at: now,
    pages,
    ...(setAside === undefined ? {} : { setAside }),
    market,
    ...(asked === null || asked.searches === 0 ? {} : { checked: asked }),
  };
  const firstDay = next.kind === "unmeasured" ? undefined : next.value[0]?.day;
  if (rows === null || published === null) return { did, next };
  const results = resultsOf({ published: { pages: published, now }, passes: rows.passes, rows: rows.pages, rivals: null, gsc: rows.gsc, week, domain: a.domain, coming: 0, goLive: firstDay !== undefined });
  if (results === null) return { did, next };
  // Told once: readings are written by the weekly pass, so the site's first page-1 date falls inside this week's pass only once.
  const reached = published.flatMap((page) => (page.reading?.reached.firstPage === undefined ? [] : [Date.parse(page.reading.reached.firstPage)]));
  const first = reached.length === 0 ? null : Math.min(...reached);
  const firstPage = pass !== undefined && first !== null && first > Date.parse(pass.at) && first <= now.getTime();
  return {
    did,
    next,
    results: { tiles: results.model.tiles, at: now, due: plusDays(weekStart, 7), goLive: firstDay ?? null, zone, firstPage },
  };
}

/** This week's pass: the Google searches it read and the AI questions it asked; `null` with no questions stored. */
function askedOf(pass: TilePass): { searches: number; questions: number } | null {
  const asked = pass.prompts?.asked;
  if (!Array.isArray(asked)) return null;
  const questions = pass.report.questions;
  return { searches: questions.kind === "unmeasured" ? 0 : questions.value.length, questions: asked.length };
}

/** The pages that went live in the site-local week before `weekStart` and are still up, newest last, each by its search. */
async function pagesLiveLastWeek(siteId: string, weekStart: string, zone: string): Promise<readonly WeeklyDidPage[]> {
  type Row = {
    live_url: string | null;
    destination: string;
    published_at: string;
    unpublished_at: string | null;
    drafts: { meta: unknown; opportunities: { target_query: string | null; family: string | null } | null } | null;
  };
  const lastWeek = plusDays(weekStart, -7);
  const { data, error } = await untyped()
    .from<Row>("publications")
    .select("live_url, destination, published_at, unpublished_at, drafts(meta, opportunities(target_query, family))")
    .eq("site_id", siteId)
    .gte("published_at", `${plusDays(lastWeek, -1)}T00:00:00Z`);
  if (error !== null) return [];
  return (data ?? [])
    .filter((row) => row.live_url !== null && row.unpublished_at === null && weekStartFor({ at: new Date(row.published_at), zone }) === lastWeek)
    .sort((x, y) => x.published_at.localeCompare(y.published_at))
    .map((row) => {
      const opportunity = row.drafts?.opportunities ?? null;
      return {
        search: nameOf(opportunity?.target_query, row.live_url!),
        liveUrl: row.destination === "hosted" ? fromMail(row.live_url!) : row.live_url!,
        update: opportunity?.family === "improve" || opportunity?.family === "fix" || becameUpdate(row.drafts?.meta),
      };
    });
}

/** Pages the daily re-check set aside in the seven days before `weekStart`, so each is told on exactly one Monday, and
 *  what filled those days by their stored rows: a day without a page, or rows unread, claims no replacement. */
async function setAsideLastWeek(siteId: string, weekStart: string): Promise<WeeklyDid["setAside"]> {
  const to = Date.parse(`${weekStart}T00:00:00Z`);
  const { data, error } = await untyped().from<{ transitions: unknown }>("drafts").select("transitions").eq("site_id", siteId).eq("state", "skipped");
  if (error !== null) return undefined;
  const n = (data ?? []).filter((row) => {
    const at = Date.parse(String((Array.isArray(row.transitions) ? (row.transitions as { at?: unknown }[]) : []).at(-1)?.at));
    return setAsideOf({ state: "skipped", transitions: row.transitions }) && at >= to - 7 * 86_400_000 && at < to;
  }).length;
  if (n === 0) return undefined;
  return { n, arm: await filledBy(siteId, weekDates(new Date(to - 7 * 86_400_000).toISOString().slice(0, 10)), n) };
}

/** No set-aside page is paired with the date it gave up, so the claim is the week's: updated only where updates could
 *  have filled every set-aside page's day, and never for a mixed week. */
async function filledBy(siteId: string, days: readonly string[], n: number): Promise<NonNullable<WeeklyDid["setAside"]>["arm"]> {
  const [first, last] = [days[0]!, days.at(-1)!];
  const [outcomes, drafts] = await Promise.all([
    untyped().from<{ publish_date: string; outcome: string | null }>("draft_days").select("publish_date, outcome").eq("site_id", siteId).gte("publish_date", first).lte("publish_date", last),
    untyped().from<{ state: string; meta: unknown }>("drafts").select("state, meta").eq("site_id", siteId).gte("scheduled_for", first).lte("scheduled_for", last),
  ]);
  if (outcomes.error !== null || drafts.error !== null) return "unreplaced";
  const drafted = new Set((outcomes.data ?? []).filter((day) => day.outcome === "drafted").map((day) => day.publish_date));
  const updates = (drafts.data ?? []).filter((draft) => becameUpdate(draft.meta));
  // An update that never went live, stopped or not, filled nothing: its day is a gap.
  if (days.some((day) => !drafted.has(day)) || updates.some((draft) => draft.state !== "published")) return "unreplaced";
  const u = updates.length;
  return u === 0 ? "replaced" : u >= n ? "updated" : "unreplaced";
}

/** The week's pages by Plan's rule: each date's scheduled draft, else its committed row. */
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

/** The week's pages with day, update flag, why and links. An empty week is one stated line, never padded. */
async function theWeek(siteId: string, weekStart: string, at: Date): Promise<Measured<readonly WeeklyNext[]>> {
  const { entries, committed } = await weekEntries(siteId, weekStart);
  const open = new Map(committed.days.map(({ opportunity }) => [opportunity.id, opportunity]));
  const days: WeeklyNext[] = [];
  for (const entry of entries) {
    const opportunity = open.get(entry.opportunityId) ?? (await opportunityById(entry.opportunityId).catch(() => null));
    // No target search, nothing to name: another name would be a second identity.
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
  return measured(days, at);
}

function stopHrefOf(siteId: string, opportunityId: string, day: string): string {
  const token = plannedStopToken({ siteId, opportunityId, day });
  return new URL(vetoLinkPath(token), env.NEXT_PUBLIC_APP_URL).toString();
}

/** The account as the shell states it: complete carries no line, partial names its missing sections. */
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

/** SPEC §8's one needs-you item: one `needs_attention` page whose cause is critical (owner O7), since listing all would be a
 *  second calendar; `undefined` says nothing. Why is the page's own to say (`needs-you.ts`), on the screen that can fix it. */
async function oneNeedsYou(siteId: string, now: Date): Promise<WeeklyNeedsYou | undefined> {
  try {
    const { data, error } = await untyped()
      .from<{ id: string; title: string | null; transitions: unknown; meta: unknown; sites?: { language: string | null } | null }>("drafts")
      .select("id, title, transitions, meta, sites(language)")
      .eq("site_id", siteId)
      .eq("state", "needs_attention");
    if (error !== null) return undefined;
    const row = data?.find((each) => critical(needsYouOf({ state: "needs_attention", transitions: each.transitions, meta: each.meta }), now));
    if (row === undefined) return undefined;
    const title = pageTitle((row.title ?? "").trim(), row.sites?.language);
    return {
      line: "mail.weekly.needsYou",
      // The title is model text, so it reaches the reader in a slot, never as our sentence; with none, the slot carries the app address.
      vars: { page: title === "" ? row.id : title },
      href: new URL(`/app/draft/${encodeURIComponent(row.id)}`, env.NEXT_PUBLIC_APP_URL).toString(),
    };
  } catch {
    return undefined;
  }
}

/** D28: the latest conclusion's change made this week (category, rivals added or dropped, reasons). Fails soft: no line, not no mail. */
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
