// src/jobs/account-maintenance.ts — BUILD §11
//
// The seventh id. `SPEC.md` §11's table names six jobs; seven obligations
// in the rest of the spec fall due on a clock and no read path can serve
// them — a payment awaiting sign-in, a payment with no account, a
// hosting-end notice, a hosting stop, an account due for purge, a founder
// who paid and never finished setup (§4.3, issue #36), and a free scan
// left `running` by an invocation the platform froze (§6.4, issue #438).
// This tick is their trigger and nothing more.
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
import {
  accountsDueForPurge,
  backstopProvision,
  chaseSignIn,
  finishScanLeftRunning,
  noticeHostingEnd,
  paymentsAwaitingSignIn,
  paymentsWithoutAccounts,
  EngineNotBuilt,
  purgeAccount,
  remindSetup,
  scansLeftRunning,
  sitesDueHostingEndNotice,
  sitesDueHostingStop,
  sitesDueSetupReminder,
  stopHosting,
  type EngineResult,
} from "@/jobs/engine";
import { MAINTENANCE_TICK_MINUTES } from "@/lib/config/constants";
import { fanOut, settle } from "./fan-out";
import type { JobDefinition, Outcome } from "./types";

/** Every `MAINTENANCE_TICK_MINUTES`, derived from the pin rather than
 *  written twice, so the mail lands inside the first tick after the promise
 *  falls due. */
export const MAINTENANCE_CRON = `*/${MAINTENANCE_TICK_MINUTES} * * * *`;

/** The seven obligations, each a query and the hand-off that owns its
 *  rule. Adding an eighth is an edit to this list — never a predicate in
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
]);

export const accountMaintenance: JobDefinition = {
  id: "account/maintenance",
  trigger: { kind: "cron", cron: MAINTENANCE_CRON },
  idempotencyKey: [],
  async run(): Promise<Outcome> {
    let handedOff = 0;
    for (const { due, handOff } of DUE_WORK) {
      // An obligation whose engine has not shipped is skipped, loudly, and
      // the other five still run. Before issue #36 the first unbuilt query
      // took the whole tick down with it, which meant the *built*
      // obligations behind it in this list never ran either — a purge held
      // and a hosting notice withheld because an unrelated node had not
      // landed. Only `EngineNotBuilt` is caught: a query that fails for any
      // other reason still stops the tick, because that is a fault, not an
      // absence.
      let subjects: readonly string[];
      try {
        subjects = await due();
      } catch (error) {
        if (!(error instanceof EngineNotBuilt)) throw error;
        console.warn(
          JSON.stringify({ event: "maintenance_obligation_not_built", engine: error.engine })
        );
        continue;
      }
      handedOff += subjects.length;
      const results = await fanOut(subjects, (subjectId) => handOff(subjectId));
      const settled = settle(results, null);
      if (settled.outcome === "degraded") return settled;
    }
    return handedOff === 0
      ? { outcome: "skipped", subjectId: null, reason: "no-subject" }
      : { outcome: "ran", subjectId: null };
  },
};
