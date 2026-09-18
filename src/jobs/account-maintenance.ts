// src/jobs/account-maintenance.ts — BUILD §11
//
// The seventh id. `BUILD.md` §11's table names six jobs; twelve obligations
// in the rest of the spec fall due on a clock and no read path can serve
// them — a payment awaiting sign-in, a payment with no account, a
// hosting-end notice, a hosting stop, an account due for purge, a founder
// who paid and never finished setup (§4.3, issue #36), and a free scan
// left `running` by an invocation the platform froze (§6.4, issue #438), and
// SPEC §8's five retention mails (issue #569). This tick is their trigger
// and nothing more.
//
// **No domain logic here.** One tick is seven due-work queries and seven
// hand-offs: each returned subject goes straight back to the module that
// owns its rule. This file holds no predicate over a timestamp, no
// threshold and no ordering — a tick whose seven queries return nothing is
// seven indexed reads and no writes.
//
// Not in the kill switch's scope: halting it would hold a purge, withhold a
// hosting notice and strand a paid customer waiting for a sign-in link,
// none of which is spend and none of which §11's stop is about.
//
// **What makes a second delivery of one tick harmless** (issue 886).
// Delivery is at-least-once and a clock tick carries no payload, so
// `idempotencyKey` is empty, as `types.ts` describes for a tick: "whose
// idempotency is a database constraint owned by the engine, not by the
// trigger". Nothing is held here — this file has no rule to hold — and each
// obligation's own module holds it:
//
//   * **The two that spend.** The onboarding pass a lost enqueue owes is
//     re-sent as `scan/run` with `setup-<siteId>` as its key, so every
//     delivery's send is one delivery of one event and one pass. A pass a
//     ceiling stopped is measured again on a fresh row keyed to the pass it
//     re-measures (`scans.remeasure_of`), so two deliveries claim one row
//     and one of them pays.
//   * **The mails.** Each sender re-reads, re-decides, sends and stamps the
//     row it sent against, so a delivery arriving after the first has sent
//     finds nothing due. Two arriving *together* both read the row before
//     either stamp, and the cost of losing that race is one duplicate mail
//     — stated here as what it is rather than claimed protected.
//   * **The moves.** A purge, a hosting stop, a destination's health and a
//     stuck free pass are all a state the subject is moved *to*, and the
//     move is idempotent: a second delivery writes the same state again.
import {
  accountsDueCancellation,
  accountsDueForPurge,
  accountsDueInactivity,
  accountsDuePaymentFailed,
  accountsDueWinback,
  draftsDueVetoReminder,
  noticeCancellation,
  noticePaymentFailed,
  nudgeInactive,
  remindVeto,
  winBack,
  backstopProvision,
  chaseSignIn,
  finishScanLeftRunning,
  hostedDestinationsDueHealth,
  marketDigestsDue,
  noticeHostingEnd,
  paymentsAwaitingSignIn,
  paymentsWithoutAccounts,
  EngineNotBuilt,
  purgeAccount,
  refreshDestinationHealth,
  remindSetup,
  sendMarketDigest,
  scansLeftRunning,
  sitesDueHostingEndNotice,
  sitesDueHostingStop,
  sitesDueSetupReminder,
  stopHosting,
  type EngineResult,
} from "@/jobs/engine";
import { deepPassBackstop } from "./deep-pass-backstop";
import { MAINTENANCE_TICK_MINUTES } from "@/lib/config/constants";
import { fanOut, settle } from "./fan-out";
import type { JobDefinition, Outcome } from "./types";

/** Every `MAINTENANCE_TICK_MINUTES`, derived from the pin rather than
 *  written twice, so the mail lands inside the first tick after the promise
 *  falls due. */
export const MAINTENANCE_CRON = `*/${MAINTENANCE_TICK_MINUTES} * * * *`;

/** The obligations, each a query and the hand-off that owns its rule.
 *  Adding one is an edit to this list — never a predicate in
 *  the body below. */
const DUE_WORK: readonly {
  readonly due: () => Promise<readonly string[]>;
  readonly handOff: (subjectId: string) => Promise<EngineResult>;
}[] = Object.freeze([
  { due: paymentsAwaitingSignIn, handOff: chaseSignIn },
  { due: paymentsWithoutAccounts, handOff: backstopProvision },
  { due: sitesDueHostingEndNotice, handOff: noticeHostingEnd },
  { due: sitesDueHostingStop, handOff: stopHosting },
  { due: accountsDueForPurge, handOff: purgeAccount },
  // §4.3's setup reminders (REQ-025 c6). The tick asks who is due *now*
  // rather than scheduling three mails per founder in advance, which is
  // what makes "stopped at send time" true by construction: a founder who
  // finishes at hour 71 is simply not returned by the query at hour 72,
  // and there is no queue entry anywhere to cancel.
  { due: sitesDueSetupReminder, handOff: remindSetup },
  // §6.4's in-flight bound, kept honest (issue #438). A free pass runs
  // inside the request that started it, and an invocation the platform
  // froze at its own ceiling leaves the claimed row `running` — which is
  // the column the in-flight refusal reads, so the frozen pass goes on
  // refusing that network's next visitor until something finishes the row.
  // The tick asks which rows those are rather than the route guessing on
  // the way in: staleness is a fact about a clock, and the sweep is the
  // one place in the product allowed to decide a pass is not coming back.
  { due: scansLeftRunning, handOff: finishScanLeftRunning },
  // SPEC §8's retention sequence (issue #569): idle 7 days, a veto window
  // closing on an unopened draft, a failed payment, a cancellation, and the
  // win-back 30 days after access ended. Asked, like the setup reminders,
  // at every tick and re-decided at send time.
  { due: accountsDueInactivity, handOff: nudgeInactive },
  { due: draftsDueVetoReminder, handOff: remindVeto },
  { due: accountsDuePaymentFailed, handOff: noticePaymentFailed },
  { due: accountsDueCancellation, handOff: noticeCancellation },
  { due: accountsDueWinback, handOff: winBack },
  // Issue #791: a hosted destination's health, refreshed once its window
  // has passed, so `destination_working` stops depending on a founder
  // opening Settings after their record verifies.
  { due: hostedDestinationsDueHealth, handOff: refreshDestinationHealth },
  deepPassBackstop,
  // Issue 796: the weekly passes that found too little market, told to the
  // owner as one digest per Monday rather than one mail per site.
  { due: marketDigestsDue, handOff: sendMarketDigest },
]);

export const accountMaintenance: JobDefinition = {
  id: "account/maintenance",
  trigger: { kind: "cron", cron: MAINTENANCE_CRON },
  idempotencyKey: [],
  async run(): Promise<Outcome> {
    // Every obligation runs, whatever the one before it did (issue #797).
    // A tick that returned at the first degraded or throwing check starved
    // everything behind it in the list — one unprovisionable payment held
    // every hosting notice, purge, reminder, stuck-scan finish and
    // retention mail for as long as it stayed due. So each check is its own
    // try: what it degraded and what it threw are collected, and reported
    // together once the last one has run.
    let handedOff = 0;
    const degraded: string[] = [];
    const failures: unknown[] = [];
    for (const { due, handOff } of DUE_WORK) {
      try {
        const subjects = await due();
        handedOff += subjects.length;
        const settled = settle(await fanOut(subjects, (subjectId) => handOff(subjectId)), null);
        if (settled.outcome === "degraded") degraded.push(settled.step);
      } catch (error) {
        // An obligation whose engine has not shipped is skipped, loudly —
        // an absence, not a fault, so it fails nothing.
        if (error instanceof EngineNotBuilt) {
          console.warn(
            JSON.stringify({ event: "maintenance_obligation_not_built", engine: error.engine })
          );
          continue;
        }
        console.error(
          JSON.stringify({
            event: "maintenance_obligation_failed",
            message: error instanceof Error ? error.message : String(error),
          })
        );
        failures.push(error);
      }
    }
    // A fault still fails the run, so the platform records it — but only
    // after every other obligation has had its turn.
    if (failures.length === 1) throw failures[0];
    if (failures.length > 1) {
      throw new AggregateError(failures, `account/maintenance: ${failures.length} obligations failed`);
    }
    if (degraded.length > 0) return { outcome: "degraded", subjectId: null, step: degraded.join(",") };
    return handedOff === 0
      ? { outcome: "skipped", subjectId: null, reason: "no-subject" }
      : { outcome: "ran", subjectId: null };
  },
};
