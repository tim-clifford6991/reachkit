// src/lib/account/billing/hosting-end.ts — BUILD §13, §9
//
// The two due-work queries behind the end of hosted serving: who is owed a
// notice, and whose pages may now stop. The `account/maintenance` tick owns
// the schedule (BUILD §11); this module owns the rule, and holds no cron
// expression, no fan-out and no mail.
//
// REQ-076 criterion 11 fixes two occasions, and this file is written around
// the fact that they are two and not one:
// Only a site with a hosted destination is ever in either queue. A customer
// who publishes to their own WordPress alone has no hosted page to lose, so
// there is no day to tell them about and nothing for the stop to stop —
// telling them one would be stating a fact about nothing.
//
//   · the instant access ends — **however it ends**. A customer who
//     cancelled and a customer whose renewal simply lapsed reach it by the
//     same door, because the criterion says "however it ends (criterion 8)"
//     and criterion 8 is `paid_through` alone. Nothing here reads
//     `cancelled_at` or `plan_status` to decide due-ness; a query that did
//     would silently exclude the lapsed customer, who is the one least
//     likely to be watching for the mail.
//   · `HOSTING_END_REMINDER_DAYS` before the day serving stops.
// Each is guarded by its own stamp, so a tick that runs twice sends once.
//
// **The retention window is stamped on the first of those two occasions.**
// `hosted_serving_ends_at = paid_through + HOSTED_RETENTION_DAYS` is
// written when access ends, which is also when the first notice falls due —
// one moment, one write, and the day the customer is told is the day the
// column holds.
//
// **A site missing either stamp is never stopped** (BP-060 decision 3). It
// is excluded from `sitesDueHostingStop` and raised instead: a page going
// dark unannounced is worse than a page served a day longer than promised,
// and the failure that produces it — a mail that did not send — is exactly
// the one a schedule-driven stop would not notice.
//
// **A deleted account is in neither queue.** Deletion takes the pages down
// at the moment it happens and carries no notice of a day the customer
// chose (REQ-076 c10, c11; REQ-079 c6). `hostedServingState` already
// refuses to serve such a site, so there is nothing here left to stop.
import { HOSTED_RETENTION_DAYS, HOSTING_END_REMINDER_DAYS } from "@/lib/config/constants";
import { billingStore, type HostingRow, type HostingNotice } from "./store";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function addDays(at: Date, days: number): Date {
  return new Date(at.getTime() + days * MS_PER_DAY);
}

/** One subject of the notice queue: which site, and which of the two
 *  notices it is due. The tick hands the id back to `sendHostingEndNotice`,
 *  which asks this module again rather than being told — so a subject that
 *  stopped being due between the two calls sends nothing. */
export interface HostingNoticeDue {
  readonly siteId: string;
  readonly which: HostingNotice;
}

/** Whether this site's owner's access has ended at `now`. `paid_through`
 *  alone, on the same footing as `hasActiveAccess` — the gate's rule read
 *  from the other side (REQ-076 c8). */
function accessEnded(site: HostingRow, now: Date): boolean {
  return new Date(site.owner_paid_through).getTime() <= now.getTime();
}

/** REQ-076 c11's two occasions, as one queue. Sites are returned with the
 *  notice each is due, and a site due neither is absent. */
export async function hostingEndNoticesDue(now: Date): Promise<readonly HostingNoticeDue[]> {
  const store = billingStore();
  const due: HostingNoticeDue[] = [];

  // Occasion one: access has ended and the window has not been opened yet.
  // The query asks for exactly that — an unstamped window under an expired
  // paid-through date — so the read is the handful of sites that crossed
  // the line since the last tick, never the whole table.
  const ended = await store.sitesWithEndedAccess(now);
  if (ended.ok) {
    for (const site of ended.sites) {
      if (!site.hasHostedPages) continue;
      if (site.owner_deleted_at !== null) continue;
      if (!accessEnded(site, now)) continue;
      if (site.hosting_end_notice_at !== null) continue;
      due.push({ siteId: site.id, which: "access_ended" });
    }
  }

  // Occasion two: the reminder, `HOSTING_END_REMINDER_DAYS` before the day
  // serving stops. Asked of the window rather than of the paid-through
  // date, because the window is what the customer was told.
  const approaching = await store.sitesServingEndingBy(addDays(now, HOSTING_END_REMINDER_DAYS));
  if (approaching.ok) {
    for (const site of approaching.sites) {
      if (!site.hasHostedPages) continue;
      if (site.owner_deleted_at !== null) continue;
      if (site.hosting_end_reminder_at !== null) continue;
      due.push({ siteId: site.id, which: "seven_days" });
    }
  }

  return due;
}

/** The tick's own signature: site ids alone. The notice each is due is
 *  re-derived by `sendHostingEndNotice`, so the queue and the send cannot
 *  disagree about which mail a site is owed. */
export async function sitesDueHostingEndNotice(now: Date): Promise<readonly string[]> {
  const due = await hostingEndNoticesDue(now);
  return [...new Set(due.map((d) => d.siteId))];
}

/** The day this site's serving stops, whether or not it has been stamped
 *  yet: `paid_through + HOSTED_RETENTION_DAYS`. Stamped on the first notice
 *  and read back afterwards, so the day the customer was told is the day
 *  that is enforced. */
export function hostedServingEndsAt(site: HostingRow): Date {
  return site.hosted_serving_ends_at !== null
    ? new Date(site.hosted_serving_ends_at)
    : addDays(new Date(site.owner_paid_through), HOSTED_RETENTION_DAYS);
}

/** REQ-076 c10's stop queue: sites whose window has elapsed **and which
 *  carry both notice stamps**.
 *
 *  A site missing either stamp is excluded and raised. This is the one
 *  place in the module that logs rather than returning a reason, because
 *  there is no caller who could act on it differently: the tick's job is to
 *  stop serving, and a site it must not stop is not the tick's problem to
 *  solve — it is an operator's. */
export async function sitesDueHostingStop(now: Date): Promise<readonly string[]> {
  const read = await billingStore().sitesServingEndingBy(now);
  if (!read.ok) return [];

  const stoppable: string[] = [];
  for (const site of read.sites) {
    // A site with no hosted destination has nothing to stop serving.
    if (!site.hasHostedPages) continue;
    // Deletion already stopped serving; it is not this queue's ending.
    if (site.owner_deleted_at !== null) continue;

    const missing: HostingNotice[] = [];
    if (site.hosting_end_notice_at === null) missing.push("access_ended");
    if (site.hosting_end_reminder_at === null) missing.push("seven_days");
    if (missing.length > 0) {
      console.warn(
        JSON.stringify({
          event: "hosting_stop_withheld",
          siteId: site.id,
          missingNotices: missing,
          because: "REQ-076 c11: no customer's live pages go dark without both notices having been sent",
        })
      );
      continue;
    }
    stoppable.push(site.id);
  }
  return stoppable;
}
