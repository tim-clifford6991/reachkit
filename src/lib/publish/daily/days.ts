// SPEC §7, issue 1455 — every draft day kept, and a day with no page told.
//
// reachkit.app published nothing on 15 and 16 October and nothing said so.
// `draft/generate` recorded `degraded generate:no_opportunity` in
// `job_runs`, the next hourly `skipped` overwrote it, and Vercel keeps an
// hour of logs. Two things here mean that cannot happen quietly again:
//
//   * **The day's reason, kept** (`draft_days`). In a site's due hour the
//     tick writes how the day ended — a page drafted, no page and why, or
//     the step that threw — under the site and the date the page was for.
//     A later tick never overwrites another site's or another date's row.
//   * **The publish time, checked.** In the hour a site's publish time
//     falls in, a date that holds no page going out is mailed to the owner
//     once, with the reason the due hour recorded. A day the customer acted
//     on — a page they stopped or took down — is not mailed: that is their
//     choice and not a fault. Neither is a site's first day, before it has
//     any page dated earlier: nothing was owed yet.
//
// The selection is `sitesForDailyTick`'s, so a site whose customer stopped
// publishing, or whose access ended, is never checked.
//
// **Nothing here throws into the tick.** A record or an alert that fails
// logs one line and returns: it must not cost the site its page.
import { AUTOPILOT_STALL } from "@/lib/config/constants";
import { nextPublishTimeAtOrAfter, publishDateAtOrAfter } from "../settings/clock";
import { publishDb } from "../db";
import type { DailySite } from "./sites";

const MS_PER_HOUR = 3_600_000;

/** How a due hour ended for one site. */
export type DayOutcome = "drafted" | "no_page" | "failed";

/** The reason a day held until the customer's address is connected is
 *  recorded under. Not a fault, so no missing-draft mail is sent for it. */
const WAITING_FOR_ADDRESS = "waiting_for_address";

/** One site's page for one date. */
export interface DraftDay {
  readonly siteId: string;
  readonly publishDate: string;
}

/** The states a date's page holds when the day is accounted for: going out,
 *  out, or stopped or taken down by the customer. A page still generating,
 *  stopped by the checks, or failed at the destination is not. */
const ACCOUNTED: ReadonlySet<string> = new Set(["in_review", "approved", "publishing", "published", "skipped", "unpublished"]);

export interface DraftDayStore {
  record(a: { siteId: string; publishDate: string; outcome: DayOutcome; reason: string | null; at: Date }): Promise<void>;
  /** The states of the drafts dated `publishDate`. */
  statesOn(siteId: string, publishDate: string): Promise<readonly string[]>;
  /** Whether the site holds a draft dated before `publishDate`. */
  draftedBefore(siteId: string, publishDate: string): Promise<boolean>;
  /** The reason the date's due hour recorded, or `null`. */
  reasonOn(siteId: string, publishDate: string): Promise<string | null>;
  /** Of these days, the ones whose due hour recorded how it ended. */
  decidedOn(days: readonly DraftDay[]): Promise<readonly DraftDay[]>;
  domainOf(siteId: string): Promise<string | null>;
  /** Marks the date told about, only if it has not been. True for the one
   *  caller that made the claim — the one that sends the mail. */
  claimMissingAlert(siteId: string, publishDate: string, at: Date): Promise<boolean>;
  /** When the site's latest page was delivered, or `null` where none has
   *  been (issue 1536). Absent, no stall is checked. */
  lastDeliveredAt?(siteId: string): Promise<Date | null>;
  /** Whether the site's destination is not connected yet: Overview's
   *  `connect_blog` reading for hosted, no credential for WordPress. Absent,
   *  never. */
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

/** The site-local date whose publish time falls in the hour `hour` starts,
 *  or `null` where none does. */
export function publishDateInHour(hour: Date, site: DailySite): string | null {
  const publishes = nextPublishTimeAtOrAfter(hour, settingsOf(site));
  return publishes.getTime() - hour.getTime() < MS_PER_HOUR ? publishDateAtOrAfter(hour, settingsOf(site)) : null;
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

/** Why the day's page is held, or `null`: until the site's address is
 *  connected only its first page is written. A read that fails holds
 *  nothing. Never throws. */
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

/** Of these days, the ones a site was owed and no due hour recorded an
 *  ending for: a tick the platform missed, or a run killed before it
 *  recorded. A site's first day, before it has any page dated earlier, was
 *  not owed. On an unreadable store, none — the next tick asks again. Never
 *  throws. */
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

/** Mails the owner about every site among `sites` whose publish time falls
 *  in this hour and whose date holds no page going out. Once a date. Never
 *  throws. Returns how many were told. */
export async function alertMissingDrafts(a: { sites: readonly DailySite[]; hour: Date }): Promise<number> {
  let told = 0;
  for (const site of a.sites) {
    try {
      const date = publishDateInHour(a.hour, site);
      if (date === null) continue;
      const days = draftDays();
      const states = await days.statesOn(site.siteId, date);
      if (states.some((state) => ACCOUNTED.has(state))) continue;
      if (!(await days.draftedBefore(site.siteId, date))) continue;
      if ((await days.reasonOn(site.siteId, date)) === `no_page:${WAITING_FOR_ADDRESS}`) continue;
      if (!(await days.claimMissingAlert(site.siteId, date, a.hour))) continue;
      const [domain, reason] = await Promise.all([days.domainOf(site.siteId), days.reasonOn(site.siteId, date)]);
      const { reportIncident } = await import("@/lib/mail/ops");
      await reportIncident({
        occasion: "no-draft-at-publish",
        domain: domain ?? "unknown",
        date,
        reason: reason ?? (states.length === 0 ? "not-recorded" : `state:${states[0]}`),
      });
      told += 1;
    } catch {
      warn("alert-failed");
    }
  }
  return told;
}

/** The states of a date's page that is going out or out. */
const GOING_OUT: ReadonlySet<string> = new Set(["in_review", "approved", "publishing", "published"]);

const MS_PER_DAY = 86_400_000;

/** A calendar date, as the site's own zone reads the instant. */
function localDate(at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
}

/**
 * Issue 1536: mails the owner about every site among `sites` whose publish
 * time falls in this hour and that has gone `AUTOPILOT_STALL.stallFactor`
 * times its cadence with no page delivered — on that day, and on each such
 * span after it while none is. reachkit.app's last page went out on 14
 * October and nothing said so for five days: each day was told on its own,
 * never the run of them. A site with no page delivered yet, and a date
 * whose page is going out, are not told. Never throws. Returns how many
 * were told.
 */
export async function alertStalledSites(a: { sites: readonly DailySite[]; hour: Date }): Promise<number> {
  const span = AUTOPILOT_STALL.cadenceDays * AUTOPILOT_STALL.stallFactor;
  let told = 0;
  for (const site of a.sites) {
    try {
      const date = publishDateInHour(a.hour, site);
      if (date === null) continue;
      const days = draftDays();
      const last = (await days.lastDeliveredAt?.(site.siteId)) ?? null;
      if (last === null) continue;
      const lastDelivered = localDate(last, site.timeZone);
      const since = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${lastDelivered}T00:00:00Z`)) / MS_PER_DAY);
      if (since < span || since % span !== 0) continue;
      if ((await days.statesOn(site.siteId, date)).some((state) => GOING_OUT.has(state))) continue;
      const { reportIncident } = await import("@/lib/mail/ops");
      await reportIncident({ occasion: "autopilot-stalled", domain: (await days.domainOf(site.siteId)) ?? "unknown", lastDelivered, days: since });
      told += 1;
    } catch {
      warn("stall-alert-failed");
    }
  }
  return told;
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
    async claimMissingAlert(siteId, publishDate, at) {
      const seeded = await publishDb()
        .from("draft_days")
        .upsert({ site_id: siteId, publish_date: publishDate }, { onConflict: "site_id,publish_date", ignoreDuplicates: true });
      if (seeded.error !== null) throw new Error(seeded.error.message);
      const { data, error } = await publishDb()
        .from<{ site_id: string }>("draft_days")
        .update({ missing_alerted_at: at.toISOString() })
        .eq("site_id", siteId)
        .eq("publish_date", publishDate)
        .is("missing_alerted_at", null)
        .select("site_id");
      if (error !== null) throw new Error(error.message);
      return (data ?? []).length === 1;
    },
  };
}

function dayBefore(date: string): string {
  const at = new Date(`${date}T00:00:00Z`);
  at.setUTCDate(at.getUTCDate() - 1);
  return at.toISOString().slice(0, 10);
}
