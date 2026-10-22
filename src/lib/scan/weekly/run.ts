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
// **A pass that produced no report, or that the vendor refused for credit,
// leaves no week behind it.** The claim is released — its row is marked
// `failed` and kept, because the ledger's rows reference it — and the site
// is selected again on the next hourly tick inside the same site-local
// week, where the claim takes that row back. A pass that produced a report keeps
// its row whether it was whole or partial: a partly measured week is a
// measured week that says what it missed (REQ-065 c4), never a failure to
// repeat.
//
// **What the week found becomes supply, before the account is read.**
// §7's derivation and 0¢ refill are additive and run inside this pass's own cost
// context and `WEEKLY` cap (§6.3 puts opportunity typing in the paid
// budgets); it is handed to `runScan` as the hook it calls once the
// report is stored, because the opportunity rows reference that row. The
// access gate is not re-decided for it: `sitesWithActiveAccess` answered
// a few lines above and that answer is passed on, so there is one
// definition of active and `deriveForPass` obeys rather than asks.
//
// **The kill switch stops it before any spend.** §11's switch names
// `scan+generate+publish`, and this starts a scan without passing through
// the `scan/run` job's own door, so it asks the same binding here — the
// same reader `src/lib/scan/admission.ts` already uses on the free path.
// The week then reads `not_measured` with its next due date, which is
// REQ-065 c3's account and not a silent skip.
import { env } from "@/lib/config/env";
import { deriveForPass } from "@/lib/opportunities";
import { accountForWeek, type UnmeasuredPart } from "./account";
import { sitesWithActiveAccess } from "./access";
import { claimWeek, readSiteZone, releaseWeek } from "./store";
import { runScan } from "../run";
import { readSiteCategory } from "../site-category";
import { localClock, weekHasBegun, weekStartFor, weekStartInstant } from "./week";

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
  | { readonly ran: true; readonly scanId: string; readonly status: "failed"; readonly because?: "vendor_funds" }
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
  if (!weekHasBegun({ at: a.now, zone })) return refuse(a.siteId, "week_not_begun");

  const withAccess = await sitesWithActiveAccess("runWeekly", [a.siteId]);
  if (!withAccess.has(a.siteId)) return refuse(a.siteId, "no_active_access");

  // Read before the claim, so a failed read leaves no week to release. The
  // category the founder confirmed is the one the week searches (#767).
  const category = await readSiteCategory(a.siteId);

  const claim = await claimWeek({ siteId: a.siteId, domain: a.domain, weekStart });
  if (!claim.claimed) return refuse(a.siteId, "already_measured");

  // 2. The one pipeline. Everything about what a weekly pass buys — the
  //    standard queue, the `WEEKLY` cap, which stages degrade — is
  //    `TIER_PARAMETERS.weekly`'s and is not restated here.
  let status: "done" | "degraded" | "failed";
  let fundsRefused: true | undefined;
  try {
    ({ status, fundsRefused } = await runScan({
      scanId: claim.scanId,
      siteId: a.siteId,
      domain: a.domain,
      tier: "weekly",
      // SPEC §6 (issue 1170): only values measured this week, each dated
      // this week — a read from before the site's Monday is last week's.
      measuredSince: weekStartInstant({ weekStart, zone }),
      ...(category === undefined ? {} : { category }),
      concludesMarket: true,
      afterReport: async ({ report, cost }) => {
        try {
          try {
            // Typing goes first so the rival re-check spends what it leaves, never the reserve held for it.
            await deriveForPass(cost, {
              tier: "weekly",
              siteId: a.siteId,
              report,
              hasActiveAccess: true,
            });
          } finally {
            // SPEC §6 (D28; monthly, ruling B5): a re-check the cap refused stays due on every pass until one concludes.
            const { readSiteMarket } = await import("@/lib/market/infer/stored");
            const checkedAt = await readSiteMarket(a.siteId).then((site) => site?.stored.rivalsCheckedAt, () => undefined);
            if (rivalsDue(checkedAt, weekStart, zone)) {
              const { recheckRivalsOf } = await import("../market-conclusion");
              await recheckRivalsOf({ siteId: a.siteId, domain: a.domain, cost, report });
            }
          }
        } finally {
          // SPEC §6 (owner D58, issue 1287): the pass checks its own health
          // last, against the rivals it leaves in force. It never throws.
          const { recordPassHealth } = await import("../health-record");
          await recordPassHealth({ scanId: claim.scanId, siteId: a.siteId, domain: a.domain, report, asksPrompts: true });
        }
      },
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

  // A week the vendor refused for credit was not measured, so it stays due until a pass after the top-up measures it.
  if (fundsRefused === true) {
    await releaseWeek(claim.scanId);
    logWeekly({ siteId: a.siteId, weekStart, outcome: "vendor_funds" });
    return { ran: true, scanId: claim.scanId, status: "failed", because: "vendor_funds" };
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

/** No re-check has concluded yet in the site-local month the week starts in. */
function rivalsDue(checkedAt: string | undefined, weekStart: string, zone: string): boolean {
  return checkedAt === undefined || localClock(new Date(checkedAt), zone).date.slice(0, 7) < weekStart.slice(0, 7);
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
