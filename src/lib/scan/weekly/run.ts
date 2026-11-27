// BUILD §11: `runWeekly`, one measurement inside the week, stamped with the week it belongs to. The measurement is `runScan({ tier: 'weekly' })`,
// so queue, cap and degradation are the pipeline's. This file holds the refusals before any spend, the claim and the account of what came back.
// The claim, not the schedule, makes it once: `claimWeek` inserts the `running` row before any spend and the partial unique index
// `(site_id, week_start) where tier = 'weekly'` rejects a second, so two ticks resolve to one measurement and one `already_measured`.
// A pass with no report, or refused for credit, releases its claim: the row is kept `failed` (the ledger references it) and the next hourly tick
// retakes it inside the same week, spending only what is left of its `WEEK` cap. A partial report is a measured week, never retried,
// except one whose market a call never answered: with no market there are no searches, rankings or panel, so it is released once, and its retake stands.
// What the week found becomes supply inside this pass's cost context and cap, through `spendOnStoredReport` after the store; access is passed on, not re-asked.
// The kill switch (`scan+generate+publish`) is asked here before any spend, since this starts a scan outside the `scan/run` job's door;
// the week then reads `not_measured` with its next due date.
import { env } from "@/lib/config/env";
import { cachedRivalRows, deriveForPass } from "@/lib/opportunities";
import { topUpSpend } from "@/lib/market/questions/top-up-buy";
import { FREE_SCAN_POLICY_VERSION } from "../ceilings";
import { accountForWeek, type UnmeasuredPart } from "./account";
import { hasActiveAccess } from "@/lib/account/billing";
import { dayRefused, isTestSite } from "./rerun";
import { claimRerun, claimWeek, readSiteZone, releaseWeek, supersedeWeek } from "./store";
import { reportSupplyFailed, runScan, spendOnStoredReport } from "../run";
import type { ScanStatus } from "../store";
import { readSiteCategory } from "../site-category";
import { localClock, weekHasBegun, weekStartFor, weekStartInstant } from "./week";

/** Why a week was not measured, before anything was spent. */
export type WeeklyRefusal = "week_not_begun" | "already_measured" | "no_active_access" | "kill_switch" | "not_next_week" | "not_this_week" | "not_a_test_site" | "spend_ceiling";

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
  | { readonly ran: true; readonly scanId: string; readonly status: "failed"; readonly because?: "vendor_funds" | "supply_failed" }
  | { readonly ran: false; readonly because: WeeklyRefusal };

/** One site's weekly measurement, as its job runs it: `claimWeekly`, `measureWeekly` and `finishWeekly`, each a step of its own. */
export async function runWeekly(a: WeeklyPass): Promise<WeeklyOutcome> {
  const claim = await claimWeekly(a);
  return "ran" in claim ? claim : finishWeekly(a, claim, await measureWeekly(a, claim));
}

export type WeeklyPass = {
  siteId: string;
  domain: string;
  /** The site's own zone. The caller has it — `dueSites` selected on it —
   *  so this never re-reads the row it came from. */
  zone?: string;
  now: Date;
  /** Sent by the owner: next week's pass, run now, which that Monday then finds measured. */
  early?: boolean;
  /** Sent by the owner for a listed test site: the named week measured again on a fresh budget. */
  rerun?: { readonly mail: boolean };
  weekStart?: string;
};

/** The row a pass claimed, as plain data: a retried step reads it back, so it measures on its own row and never claims a second. */
export type WeeklyClaim = { readonly scanId: string; readonly weekStart: string; readonly zone: string; readonly retaken?: true; readonly category?: string };

/** The refusals, all before any spend, then the claim. `weekStart` is computed once from the site's zone and written at insert, so moving zone moves no measured week. */
export async function claimWeekly(a: WeeklyPass): Promise<WeeklyClaim | Extract<WeeklyOutcome, { ran: false }>> {
  if (a.rerun !== undefined && !isTestSite(a.siteId)) return refuse(a.siteId, "not_a_test_site");
  // A site with no stated zone has no local Monday, so no week has begun; nothing is spent, and no zone is chosen for it.
  const zone = a.zone ?? (await readSiteZone(a.siteId));
  if (zone === null || zone === undefined) return refuse(a.siteId, "week_not_begun");

  if (env.KILL_SWITCH) return refuse(a.siteId, "kill_switch");

  const thisWeek = weekStartFor({ at: a.now, zone });
  const weekStart = a.early === true ? new Date(Date.parse(`${thisWeek}T00:00:00Z`) + 7 * 86_400_000).toISOString().slice(0, 10) : thisWeek;
  if ((a.early === true || a.rerun !== undefined) && a.weekStart !== weekStart) return refuse(a.siteId, a.early === true ? "not_next_week" : "not_this_week");
  if (!weekHasBegun({ at: a.now, zone })) return refuse(a.siteId, "week_not_begun");

  if (!(await hasActiveAccess(a.siteId))) return refuse(a.siteId, "no_active_access");

  // Read before the claim, so a failed read leaves no week to release. The category the founder confirmed is the one the week searches.
  const category = await readSiteCategory(a.siteId);

  // The site's day and the product's are the re-run's runaway guard, read before its row is claimed.
  if (a.rerun !== undefined && (await dayRefused(a.siteId, a.now))) return refuse(a.siteId, "spend_ceiling");
  const claim = a.rerun !== undefined ? await claimRerun(a) : await claimWeek({ siteId: a.siteId, domain: a.domain, weekStart });
  if (!claim.claimed) return refuse(a.siteId, "already_measured");
  return { scanId: claim.scanId, weekStart, zone, ...(claim.retaken === true ? { retaken: true as const } : {}), ...(category === undefined ? {} : { category }) };
}

/** The one pipeline on the claimed row. What a weekly pass buys — the standard queue, the `WEEK` cap, which stages degrade — is
 *  `TIER_PARAMETERS.weekly`'s. A retry measures on the same row, so its cap opens on what the dead attempt spent and its stored reads are served back. */
export async function measureWeekly(a: WeeklyPass, claim: WeeklyClaim): Promise<{ status: ScanStatus; fundsRefused?: true }> {
  try {
    const { status, fundsRefused } = await runScan({
      scanId: claim.scanId,
      siteId: a.siteId,
      domain: a.domain,
      tier: "weekly",
      // Only values measured this week, each dated this week: a read from before the site's Monday, or before an early pass began, is last week's.
      measuredSince: new Date(Math.min(+weekStartInstant({ weekStart: claim.weekStart, zone: claim.zone }), +a.now)),
      ...(claim.category === undefined ? {} : { category: claim.category }),
      concludesMarket: true,
      failsWhenFundsRefused: true,
    });
    return { status, ...(fundsRefused === true ? { fundsRefused } : {}) };
  } catch (error) {
    // A crash leaves no week: the claim goes, and the next tick retries inside the same site-local week.
    await releaseWeek(claim.scanId);
    throw error;
  }
}

/** The week's supply on the stored report, inside the pass's cost context and cap, then the account of what came back. */
export async function finishWeekly(a: WeeklyPass, claim: WeeklyClaim, measured: { status: ScanStatus; fundsRefused?: true }): Promise<WeeklyOutcome> {
  const { weekStart, zone } = claim;
  let marketUnanswered = false;
  let supplyFailed = false;
  try {
    await spendOnStoredReport({ scanId: claim.scanId, tier: "weekly" }, async ({ report, cost }) => {
      // Released only on a first claim, since an outage answers at 0¢ and would retake the week every hour; nothing more is spent on a released week.
      marketUnanswered = claim.retaken !== true && report.market.kind === "unmeasured" && report.market.reason === "undeterminable";
      if (marketUnanswered) return;
      let threw = false;
      try {
        try {
          // Typing goes first so the rival re-check spends what it leaves, never the reserve held for it.
          await deriveForPass(cost, {
            tier: "weekly",
            siteId: a.siteId,
            report,
            hasActiveAccess: true,
            topUp: topUpSpend(claim.scanId, FREE_SCAN_POLICY_VERSION),
            rivalRows: cachedRivalRows(a.siteId),
          });
        } finally {
          // A monthly re-check the cap refused stays due on every pass until one concludes.
          const { readSiteMarket } = await import("@/lib/market/infer/stored");
          const checkedAt = await readSiteMarket(a.siteId).then((site) => site?.stored.rivalsCheckedAt, () => undefined);
          if (rivalsDue(checkedAt, weekStart, zone)) {
            const { recheckRivalsOf } = await import("../market-conclusion");
            await recheckRivalsOf({ siteId: a.siteId, domain: a.domain, cost, report, at: a.now });
          }
        }
      } catch (error) {
        threw = true;
        throw error;
      } finally {
        // The pass checks its own health last, against the rivals it leaves in force. It never throws.
        const { recordPassHealth } = await import("../health-record");
        await recordPassHealth({ scanId: claim.scanId, siteId: a.siteId, domain: a.domain, report, asksPrompts: true, supplyFailed: threw });
      }
    });
  } catch (error) {
    supplyFailed = true;
    await reportSupplyFailed({ scanId: claim.scanId, siteId: a.siteId }, error);
  }

  // A week the vendor refused for credit was stored `failed` by the pass itself, so it stays due until a pass after the top-up measures it.
  if (measured.fundsRefused === true) {
    logWeekly({ siteId: a.siteId, weekStart, outcome: "vendor_funds" });
    return { ran: true, scanId: claim.scanId, status: "failed", because: "vendor_funds" };
  }

  // A week whose supply step threw measured but left no topics for its days: released and retaken as a failed pass is.
  if (measured.status === "failed" || marketUnanswered || supplyFailed) {
    await releaseWeek(claim.scanId);
    logWeekly({ siteId: a.siteId, weekStart, outcome: supplyFailed ? "supply_failed" : "failed" });
    return { ran: true, scanId: claim.scanId, status: "failed", ...(supplyFailed ? { because: "supply_failed" as const } : {}) };
  }

  if (a.rerun !== undefined) await supersedeWeek({ siteId: a.siteId, weekStart, scanId: claim.scanId, mail: a.rerun.mail });

  // What came back, read through the one account of the week, so the parts a degraded run did not reach are named in exactly one place.
  const account = await accountForWeek({ siteId: a.siteId, weekStart, now: a.now });
  logWeekly({ siteId: a.siteId, weekStart, outcome: account.kind });
  if (account.kind === "partial") {
    return { ran: true, scanId: claim.scanId, status: "degraded", unmeasured: account.unmeasured };
  }
  return { ran: true, scanId: claim.scanId, status: "done" };
}

/** No re-check has concluded yet in the site-local month the week starts in. */
function rivalsDue(checkedAt: string | undefined, weekStart: string, zone: string): boolean {
  return checkedAt === undefined || localClock(new Date(checkedAt), zone).date.slice(0, 7) < weekStart.slice(0, 7);
}

/** The knowledge base read again from the pages this week's crawl read; only changed pages are asked about. The tick's own step, since the read
 *  keeps its own clock. It spends on the scan's record, against the `WEEK` cap; a failed read costs the knowledge base, never the week. */
export async function refreshWeeklyKnowledge(a: { scanId: string; siteId: string; domain: string }): Promise<null> {
  try {
    await spendOnStoredReport({ scanId: a.scanId, tier: "weekly" }, async ({ cost }) => {
      const { buildKnowledge } = await import("@/lib/site-profile/knowledge/build");
      await buildKnowledge(cost, { siteId: a.siteId, domain: a.domain });
    });
  } catch (error) {
    console.log(
      JSON.stringify({ event: "site_knowledge_failed", scanId: a.scanId, because: error instanceof Error ? error.message : String(error) })
    );
  }
  return null;
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
