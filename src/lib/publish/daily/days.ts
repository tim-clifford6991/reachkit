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
import { nextPublishTimeAtOrAfter, publishDateAtOrAfter } from "../settings/clock";
import { publishDb } from "../db";
import type { DailySite } from "./sites";

const MS_PER_HOUR = 3_600_000;

/** How a due hour ended for one site. */
export type DayOutcome = "drafted" | "no_page" | "failed";

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
  domainOf(siteId: string): Promise<string | null>;
  /** Marks the date told about, only if it has not been. True for the one
   *  caller that made the claim — the one that sends the mail. */
  claimMissingAlert(siteId: string, publishDate: string, at: Date): Promise<boolean>;
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
    async domainOf(siteId) {
      const { data, error } = await publishDb().from<{ domain: string }>("sites").select("domain").eq("id", siteId).limit(1);
      if (error !== null) throw new Error(error.message);
      return data?.[0]?.domain ?? null;
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
