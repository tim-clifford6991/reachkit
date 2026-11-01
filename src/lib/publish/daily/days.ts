// SPEC §7 — every draft day kept, and a day with no page told, since `job_runs` is overwritten hourly and logs are short:
//   * The day's reason (`draft_days`): in a site's due hour the tick writes how the day ended under the site and date;
//     a later tick never overwrites another site's or date's row.
//   * The publish time, checked at the end of the site's run: a date with no page and nothing going out after it is mailed
//     to the owner once, with the recorded reason. A day the customer acted on is not mailed, nor a site's first day.
// The runs are sent for `sitesForDailyTick`'s sites, so a stopped or lapsed site is never checked.
// Nothing here throws into the tick: a failed record or alert logs one line and must not cost the site its page.
import { AUTOPILOT_STALL } from "@/lib/config/constants";
import { nextPublishTimeAtOrAfter, publishDateAtOrAfter } from "../settings/clock";
import { publishDb } from "../db";
import type { DailySite } from "./sites";

const MS_PER_HOUR = 3_600_000;

/** How a due hour ended for one site. */
export type DayOutcome = "drafted" | "no_page" | "failed";

/** A day held until the customer's address is connected: not a fault, so no missing-draft mail. */
const WAITING_FOR_ADDRESS = "waiting_for_address";

/** One site's page for one date. */
export interface DraftDay {
  readonly siteId: string;
  readonly publishDate: string;
}

/** A day is accounted for when its page is going out, out, or stopped or taken down by the customer. */
const ACCOUNTED: ReadonlySet<string> = new Set(["in_review", "approved", "publishing", "published", "skipped", "unpublished"]);

export interface DraftDayStore {
  record(a: { siteId: string; publishDate: string; outcome: DayOutcome; reason: string | null; at: Date }): Promise<void>;
  /** The states of the drafts dated `publishDate`. */
  statesOn(siteId: string, publishDate: string): Promise<readonly string[]>;
  /** Whether a draft dated `publishDate` or later is going out or out. */
  goingOutFrom(siteId: string, publishDate: string): Promise<boolean>;
  /** Whether the site holds a draft dated before `publishDate`. */
  draftedBefore(siteId: string, publishDate: string): Promise<boolean>;
  /** The reason the date's due hour recorded, or `null`. */
  reasonOn(siteId: string, publishDate: string): Promise<string | null>;
  /** Of these days, the ones whose due hour recorded how it ended. */
  decidedOn(days: readonly DraftDay[]): Promise<readonly DraftDay[]>;
  domainOf(siteId: string): Promise<string | null>;
  /** Marks the date told about once; true only for the caller that made the claim and sends the mail. */
  claimMissingAlert(siteId: string, publishDate: string, at: Date): Promise<boolean>;
  /** When the site's latest page was delivered, or `null`; absent, no stall is checked. */
  lastDeliveredAt?(siteId: string): Promise<Date | null>;
  /** Marks the stall since `lastDelivered` told once; true only for the caller that made the claim and sends the mail. */
  claimStallAlert?(siteId: string, lastDelivered: string, at: Date): Promise<boolean>;
  /** The days over `from`…`to` a due hour recorded and no mail told, with the recorded reason. */
  untoldBetween(from: string, to: string): Promise<readonly (DraftDay & { reason: string })[]>;
  /** Every draft dated `from`…`to`, with its state. */
  pagesBetween(from: string, to: string): Promise<readonly (DraftDay & { state: string })[]>;
  /** Whether the destination is not connected yet (hosted: Overview's connect state; WordPress: no credential). */
  waitingForAddress?(siteId: string): Promise<boolean>;
}

let store: DraftDayStore | null = null;

/** The swap door. `null` restores the database store. */
export function setDraftDayStore(next: DraftDayStore | null): void {
  store = next;
}

function draftDays(): DraftDayStore {
  store ??= databaseDraftDayStore();
  return store;
}

function warn(outcome: string): void {
  console.warn(JSON.stringify({ event: "draft_day", outcome }));
}

function settingsOf(site: DailySite) {
  return { mode: "autopilot" as const, vetoHours: site.vetoHours, publishTime: site.publishTime, timezone: site.timeZone };
}

/** Keeps how one site's due hour ended. Never throws. */
export async function recordDraftDay(a: {
  siteId: string;
  publishDate: string;
  outcome: DayOutcome;
  reason: string | null;
  at: Date;
}): Promise<void> {
  try {
    await draftDays().record(a);
  } catch {
    warn("record-failed");
  }
}

/** Why the day's page is held, or `null`: until the address is connected only the first page is written. Never throws. */
export async function dayHold(siteId: string, publishDate: string): Promise<string | null> {
  try {
    const store = draftDays();
    const held = (await store.waitingForAddress?.(siteId)) === true && (await store.draftedBefore(siteId, publishDate));
    return held ? WAITING_FOR_ADDRESS : null;
  } catch {
    warn("hold-read-failed");
    return null;
  }
}

/** The owed days no due hour recorded (a missed tick, or a run killed first); a first day was not owed. An unreadable
 *  store gives none, and the next tick asks again. Never throws. */
export async function missedDays<T extends DraftDay>(days: readonly T[]): Promise<readonly T[]> {
  if (days.length === 0) return [];
  try {
    const store = draftDays();
    const decided = new Set((await store.decidedOn(days)).map((day) => `${day.siteId}/${day.publishDate}`));
    const missed: T[] = [];
    for (const day of days) {
      if (decided.has(`${day.siteId}/${day.publishDate}`)) continue;
      if (await store.draftedBefore(day.siteId, day.publishDate)) missed.push(day);
    }
    return missed;
  } catch {
    warn("missed-read-failed");
    return [];
  }
}

/** The states of a date's page that is going out or out. */
const GOING_OUT: ReadonlySet<string> = new Set(["in_review", "approved", "publishing", "published"]);

const MS_PER_DAY = 86_400_000;

/** A calendar date, as the site's own zone reads the instant. */
function localDate(at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
}

/** The site-local date of the latest publish time before the hour `hour` starts has ended. */
export function lastPublishDate(hour: Date, site: DailySite): string {
  const end = hour.getTime() + MS_PER_HOUR;
  const after = (instant: number) => nextPublishTimeAtOrAfter(new Date(instant), settingsOf(site));
  // Publish times are at most 25 hours apart, so one falls in the 26 before the hour ends.
  let at = after(end - 26 * MS_PER_HOUR);
  for (let next = after(at.getTime() + 1); next.getTime() < end; next = after(next.getTime() + 1)) at = next;
  return publishDateAtOrAfter(at, settingsOf(site));
}

/** The date's reason, once the date is claimed as a publish time passed with no page owed and none accounted for. */
async function claimedMiss(days: DraftDayStore, siteId: string, date: string, at: Date): Promise<string | null> {
  const states = await days.statesOn(siteId, date);
  if (states.some((state) => ACCOUNTED.has(state)) || !(await days.draftedBefore(siteId, date))) return null;
  const reason = await days.reasonOn(siteId, date);
  if (reason === `no_page:${WAITING_FOR_ADDRESS}` || !(await days.claimMissingAlert(siteId, date, at))) return null;
  return reason ?? (states.length === 0 ? "not-recorded" : `state:${states[0]}`);
}

/** The stall, once it is claimed: `AUTOPILOT_STALL.stallFactor` times the cadence without a page delivered, told once
 *  until the next delivery. A site with none delivered yet is not stalled. */
async function claimedStall(days: DraftDayStore, site: DailySite, date: string, at: Date): Promise<{ lastDelivered: string; days: number } | null> {
  const last = (await days.lastDeliveredAt?.(site.siteId)) ?? null;
  if (last === null || days.claimStallAlert === undefined) return null;
  const lastDelivered = localDate(last, site.timeZone);
  const since = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${lastDelivered}T00:00:00Z`)) / MS_PER_DAY);
  if (since < AUTOPILOT_STALL.cadenceDays * AUTOPILOT_STALL.stallFactor) return null;
  return (await days.claimStallAlert(site.siteId, lastDelivered, at)) ? { lastDelivered, days: since } : null;
}

/** At the end of a site's run, mails the owner at most once when nothing of the site's is going out: the latest publish
 *  date with no page (once a date) and a stall (once until the next delivery), in one mail. A page going out on that date
 *  or a later one, drafted or rescued, means the system already covered it, so nothing is mailed and the day is left to
 *  the Monday digest (`untoldMisses`). Never throws. */
export async function alertSiteDay(a: { site: DailySite; hour: Date }): Promise<number> {
  try {
    const days = draftDays();
    const { siteId } = a.site;
    const date = lastPublishDate(a.hour, a.site);
    if (await days.goingOutFrom(siteId, date)) return 0;
    const missed = await claimedMiss(days, siteId, date, a.hour);
    const stalled = await claimedStall(days, a.site, date, a.hour);
    if (missed === null && stalled === null) return 0;
    const domain = (await days.domainOf(siteId)) ?? "unknown";
    const { reportIncident } = await import("@/lib/mail/ops");
    await reportIncident(
      missed === null
        ? { occasion: "autopilot-stalled", domain, ...stalled! }
        : { occasion: "no-draft-at-publish", domain, date, reason: missed, ...(stalled === null ? {} : { stalled }) }
    );
    return 1;
  } catch {
    warn("alert-failed");
    return 0;
  }
}

/** The recorded days over `from`…`to` (both inclusive) with no page accounted for that the owner was not mailed about,
 *  each with its reason; a day held for the address is not one. Throws when the store cannot be read. */
export async function untoldMisses(a: { from: string; to: string }): Promise<readonly (DraftDay & { reason: string })[]> {
  const days = draftDays();
  const [untold, pages] = await Promise.all([days.untoldBetween(a.from, a.to), days.pagesBetween(a.from, a.to)]);
  const accounted = new Set(pages.filter((page) => ACCOUNTED.has(page.state)).map((page) => `${page.siteId}/${page.publishDate}`));
  return untold.filter((day) => !accounted.has(`${day.siteId}/${day.publishDate}`) && day.reason !== `no_page:${WAITING_FOR_ADDRESS}`);
}

function databaseDraftDayStore(): DraftDayStore {
  return {
    async record(a) {
      const { error } = await publishDb()
        .from("draft_days")
        .upsert(
          {
            site_id: a.siteId,
            publish_date: a.publishDate,
            outcome: a.outcome,
            reason: a.reason,
            decided_at: a.at.toISOString(),
          },
          { onConflict: "site_id,publish_date" }
        );
      if (error !== null) throw new Error(error.message);
    },
    async statesOn(siteId, publishDate) {
      const { data, error } = await publishDb()
        .from<{ state: string }>("drafts")
        .select("state")
        .eq("site_id", siteId)
        .eq("scheduled_for", publishDate);
      if (error !== null) throw new Error(error.message);
      return (data ?? []).map((row) => row.state);
    },
    async goingOutFrom(siteId, publishDate) {
      const { data, error } = await publishDb()
        .from<{ id: string }>("drafts")
        .select("id")
        .eq("site_id", siteId)
        .gte("scheduled_for", publishDate)
        .in("state", [...GOING_OUT])
        .limit(1);
      if (error !== null) throw new Error(error.message);
      return (data ?? []).length > 0;
    },
    async untoldBetween(from, to) {
      const { data, error } = await publishDb()
        .from<{ site_id: string; publish_date: string; outcome: string; reason: string | null }>("draft_days")
        .select("site_id, publish_date, outcome, reason")
        .gte("publish_date", from)
        .lte("publish_date", to)
        .not("outcome", "is", null)
        .is("missing_alerted_at", null);
      if (error !== null) throw new Error(error.message);
      return (data ?? []).map((row) => ({
        siteId: row.site_id,
        publishDate: row.publish_date,
        reason: row.reason === null ? row.outcome : `${row.outcome}:${row.reason}`,
      }));
    },
    async pagesBetween(from, to) {
      const { data, error } = await publishDb()
        .from<{ site_id: string; scheduled_for: string; state: string }>("drafts")
        .select("site_id, scheduled_for, state")
        .gte("scheduled_for", from)
        .lte("scheduled_for", to);
      if (error !== null) throw new Error(error.message);
      return (data ?? []).map((row) => ({ siteId: row.site_id, publishDate: row.scheduled_for, state: row.state }));
    },
    async draftedBefore(siteId, publishDate) {
      const { data, error } = await publishDb()
        .from<{ id: string }>("drafts")
        .select("id")
        .eq("site_id", siteId)
        .lte("scheduled_for", dayBefore(publishDate))
        .limit(1);
      if (error !== null) throw new Error(error.message);
      return (data ?? []).length > 0;
    },
    async reasonOn(siteId, publishDate) {
      const { data, error } = await publishDb()
        .from<{ outcome: string | null; reason: string | null }>("draft_days")
        .select("outcome, reason")
        .eq("site_id", siteId)
        .eq("publish_date", publishDate)
        .limit(1);
      if (error !== null) throw new Error(error.message);
      const row = data?.[0];
      if (row === undefined || row.outcome === null) return null;
      return row.reason === null ? row.outcome : `${row.outcome}:${row.reason}`;
    },
    async decidedOn(days) {
      const { data, error } = await publishDb()
        .from<{ site_id: string; publish_date: string }>("draft_days")
        .select("site_id, publish_date")
        .in("site_id", [...new Set(days.map((day) => day.siteId))])
        .in("publish_date", [...new Set(days.map((day) => day.publishDate))])
        .not("outcome", "is", null);
      if (error !== null) throw new Error(error.message);
      return (data ?? []).map((row) => ({ siteId: row.site_id, publishDate: row.publish_date }));
    },
    async domainOf(siteId) {
      const { data, error } = await publishDb().from<{ domain: string }>("sites").select("domain").eq("id", siteId).limit(1);
      if (error !== null) throw new Error(error.message);
      return data?.[0]?.domain ?? null;
    },
    async waitingForAddress(siteId) {
      const { data, error } = await publishDb()
        .from<{ kind: string; health_reason: string | null; hostname: string | null; hostname_state: string | null }>("destinations")
        .select("kind, health_reason, hostname, hostname_state")
        .eq("site_id", siteId)
        .is("deleted_at", null)
        .limit(1);
      if (error !== null) throw new Error(error.message);
      const row = data?.[0];
      if (row === undefined) return false;
      if (row.kind === "hosted") return row.hostname !== null && row.hostname_state !== "live";
      return row.health_reason === "never_connected";
    },
    async lastDeliveredAt(siteId) {
      const { data, error } = await publishDb()
        .from<{ published_at: string }>("publications")
        .select("published_at")
        .eq("site_id", siteId)
        .not("published_at", "is", null)
        .order("published_at", { ascending: false })
        .limit(1);
      if (error !== null) throw new Error(error.message);
      const at = data?.[0]?.published_at;
      return at === undefined ? null : new Date(at);
    },
    claimMissingAlert: (siteId, publishDate, at) => claimOnce(siteId, publishDate, "missing_alerted_at", at),
    // Keyed to the day last delivered, so the next delivery starts a new episode with its own claim.
    claimStallAlert: (siteId, lastDelivered, at) => claimOnce(siteId, lastDelivered, "stall_alerted_at", at),
  };
}

/** Seeds the date's row if there is none, then sets `column` only where it is still null: one caller wins. */
async function claimOnce(siteId: string, publishDate: string, column: "missing_alerted_at" | "stall_alerted_at", at: Date): Promise<boolean> {
  const seeded = await publishDb()
    .from("draft_days")
    .upsert({ site_id: siteId, publish_date: publishDate }, { onConflict: "site_id,publish_date", ignoreDuplicates: true });
  if (seeded.error !== null) throw new Error(seeded.error.message);
  const { data, error } = await publishDb()
    .from<{ site_id: string }>("draft_days")
    .update({ [column]: at.toISOString() })
    .eq("site_id", siteId)
    .eq("publish_date", publishDate)
    .is(column, null)
    .select("site_id");
  if (error !== null) throw new Error(error.message);
  return (data ?? []).length === 1;
}

function dayBefore(date: string): string {
  const at = new Date(`${date}T00:00:00Z`);
  at.setUTCDate(at.getUTCDate() - 1);
  return at.toISOString().slice(0, 10);
}
