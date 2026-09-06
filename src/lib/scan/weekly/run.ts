// BUILD §11 — runWeekly: one measurement inside the week, stamped with the
// week it belongs to
//
// "`weekly/refresh` · Weekly scan per active site." The measurement is
// `runScan({ tier: 'weekly' })` and nothing else — one pipeline, tier a
// parameter (§6.3), so the standard SERP queue, the `WEEKLY` cap and every
// stage's degradation are the pipeline's own and are not re-decided here.
// This file is the four refusals before any spend, the claim that makes a
// second run in one week unrepresentable, and the account of what came
// back.
//
// **The claim, not the schedule, is what makes it once.** `claimWeek`
// inserts the `running` row carrying `week_start` before a cent is spent,
// and the partial unique index `(site_id, week_start) where tier =
// 'weekly'` rejects a second insert — so two ticks delivered at once
// resolve to one measurement and one `already_measured`, with no
// read-then-write window between them (ADR-060 point 3). `runScan` writes
// its report into that same row, so the pass never inserts a second one.
//
// **A pass that produced no report leaves no week behind it.** The claim
// is released, and the site is selected again on the very next hourly tick
// — inside the same site-local week. A pass that produced a report keeps
// its row whether it was whole or partial: a partly measured week is a
// measured week that says what it missed (REQ-065 c4), never a failure to
// repeat.
//
// **The kill switch stops it before any spend.** §11's switch names
// `scan+generate+publish`, and this starts a scan without passing through
// the `scan/run` job's own door, so it asks the same binding here — the
// same reader `src/lib/scan/admission.ts` already uses on the free path.
// The week then reads `not_measured` with its next due date, which is
// REQ-065 c3's account and not a silent skip.
import { env } from "@/lib/config/env";
import { accountForWeek, type UnmeasuredPart } from "./account";
import { sitesWithActiveAccess } from "./access";
import { claimWeek, readSiteZone, releaseWeek } from "./store";
import { runScan } from "../run";
import { isWeeklyDue, localClock, weekStartFor } from "./week";

/** Why a week was not measured, before anything was spent. */
export type WeeklyRefusal = "week_not_begun" | "already_measured" | "no_active_access" | "kill_switch";

export type WeeklyOutcome =
  | { readonly ran: true; readonly scanId: string; readonly status: "done" }
  | {
      readonly ran: true;
      readonly scanId: string;
      readonly status: "degraded";
      readonly unmeasured: readonly UnmeasuredPart[];
    }
  /** The pass produced no report at all. The claim is released and the
   *  week is due again on the next tick — so this is not `ran: false`,
   *  which would say nothing was attempted, and not `degraded`, which
   *  would say a partial measurement is readable. */
  | { readonly ran: true; readonly scanId: string; readonly status: "failed" }
  | { readonly ran: false; readonly because: WeeklyRefusal };

/**
 * One site's weekly measurement.
 *
 * `weekStart` is computed once, here, from the site's own zone, and is
 * written at insert. Nothing recomputes it on read: a customer who moves
 * zone moves no already-measured week.
 */
export async function runWeekly(a: {
  siteId: string;
  domain: string;
  /** The site's own zone. The caller has it — `dueSites` selected on it —
   *  so this never re-reads the row it came from. */
  zone?: string;
  now: Date;
}): Promise<WeeklyOutcome> {
  // A site that has stated no zone has no local Monday, so no week of its
  // own has begun — the one refusal that is literally true of it, and the
  // reason nothing is spent on it (REQ-073 c1 forbids a zone we chose).
  const zone = a.zone ?? (await readSiteZone(a.siteId));
  if (zone === null || zone === undefined) return refuse(a.siteId, "week_not_begun");

  // 1. The four refusals, all of them before any spend.
  if (env.KILL_SWITCH) return refuse(a.siteId, "kill_switch");

  const weekStart = weekStartFor({ at: a.now, zone });
  if (!hasBegun({ at: a.now, zone })) return refuse(a.siteId, "week_not_begun");

  const withAccess = await sitesWithActiveAccess("runWeekly", [a.siteId]);
  if (!withAccess.has(a.siteId)) return refuse(a.siteId, "no_active_access");

  const claim = await claimWeek({ siteId: a.siteId, domain: a.domain, weekStart });
  if (!claim.claimed) return refuse(a.siteId, "already_measured");

  // 2. The one pipeline. Everything about what a weekly pass buys — the
  //    standard queue, the `WEEKLY` cap, which stages degrade — is
  //    `TIER_PARAMETERS.weekly`'s and is not restated here.
  let status: "done" | "degraded" | "failed";
  try {
    ({ status } = await runScan({
      scanId: claim.scanId,
      siteId: a.siteId,
      domain: a.domain,
      tier: "weekly",
    }));
  } catch (error) {
    // A crash leaves no week: the claim goes, and the next tick retries
    // inside the same site-local week.
    await releaseWeek(claim.scanId);
    throw error;
  }

  if (status === "failed") {
    await releaseWeek(claim.scanId);
    logWeekly({ siteId: a.siteId, weekStart, outcome: "failed" });
    return { ran: true, scanId: claim.scanId, status: "failed" };
  }

  // 3. What came back, read through the one account of the week — so the
  //    parts a degraded run did not reach are named in exactly one place.
  const account = await accountForWeek({ siteId: a.siteId, weekStart, now: a.now });
  logWeekly({ siteId: a.siteId, weekStart, outcome: account.kind });
  if (account.kind === "partial") {
    return { ran: true, scanId: claim.scanId, status: "degraded", unmeasured: account.unmeasured };
  }
  return { ran: true, scanId: claim.scanId, status: "done" };
}

/**
 * Has this site's own week begun?
 *
 * `weekStartFor` answers for any instant, so the week containing `now`
 * always has a Monday — the question REQ-065 c1 asks ("never before it
 * begins") is whether that Monday's due hour has arrived. On the site's
 * Monday that is the due hour itself (the hourly tick's own window); on
 * any later day of the week it has plainly passed, which is what makes a
 * retry inside the week possible at all.
 */
function hasBegun(a: { at: Date; zone: string }): boolean {
  if (isWeeklyDue(a)) return true;
  return localClock(a.at, a.zone).date > weekStartFor(a);
}

function refuse(siteId: string, because: WeeklyRefusal): WeeklyOutcome {
  logWeekly({ siteId, weekStart: null, outcome: because });
  return { ran: false, because };
}

/** One line per site per tick, carrying the week and the outcome and
 *  nothing about a customer. */
function logWeekly(fields: { siteId: string; weekStart: string | null; outcome: string }): void {
  console.log(JSON.stringify({ event: "weekly_measurement", ...fields }));
}
