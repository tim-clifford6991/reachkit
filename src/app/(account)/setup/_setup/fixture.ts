// BUILD §4.3 — setup's facts, and the deep pass's, as fixtures.
//
// The screen model behind `/setup` and `/setup/waiting`, in the idiom the
// app shell established (`src/app/(account)/app/_shell/fixture.ts`).
//
// **What is live and what is drawn from here.** `provider.ts`'s
// `setupStore()` is `liveSetupStore()` and `readReportFor` reads the stored
// report, so a founder's submission writes real rows against the account
// `currentSession()` names. What still comes from this file is the *screen
// model* — `readSetupScreen` and `readPassProgress` — which is what keeps
// the layout and visual sweeps deterministic.
//
// Where each field comes from for a live account:
//
//   measured        → §4.1's stored report, `readCurrentReport()`
//   suggestedRivals → §6.6's `deriveRivals` over the confirmed market
//   the store       → the `users` and `sites` rows, through `liveSetupStore`
//   the pass        → §6.3's `runScan` at tier `deep` and its stage stream
//
// **The two fixtures are two moments of one journey, not two accounts.**
// `FIXTURE_SETUP_FACTS` is a founder at setup, with nothing submitted;
// `FIXTURE_PASS` is the same founder a second after they pressed the one
// submit, with the pass running. Each screen exists to show one of those
// moments, so each renders the moment it is for. When the real reads land,
// one account's state answers both and the moment is a fact rather than a
// choice made here.
//
// One exported constant each, not a generator: a fixture that varied per
// call would make the layout conformance sweep non-deterministic.
import type { SetupFacts } from "./facts";
import type { PassProgress } from "./progress";
import type { SetupProgressState, SetupStore, SetupSubmission } from "../submit";

export const FIXTURE_DOMAIN = "example.com";
export const FIXTURE_SITE_ID = "site-fixture";
export const FIXTURE_USER_ID = "user-fixture";
export const FIXTURE_SCAN_ID = "scan-fixture";

/** A founder who bought from a report: the address was measured, so the
 *  market card is `inferred` and the address is shown to confirm or change
 *  (REQ-021 c6, REQ-026 c1). The scanless arms — an empty address field and
 *  an empty market card (REQ-021 c7, REQ-026 c3) — are exercised by
 *  `tests/market/setup/state.test.ts`, which drives the state machine
 *  directly. */
export const FIXTURE_SETUP_FACTS: SetupFacts = Object.freeze({
  measured: Object.freeze({
    domain: FIXTURE_DOMAIN,
    report: Object.freeze({
      scanId: FIXTURE_SCAN_ID,
      category: "project management software for agencies",
      rivals: Object.freeze(["asana.com", "monday.com", "clickup.com"]),
    }),
  }),
  suggestedRivals: Object.freeze(["asana.com", "monday.com", "clickup.com", "notion.so"]),
  // Overwritten by `provider.ts` with `env.HOSTED_EDGE_CNAME_TARGET`; the
  // value here is only what a test that drives `assembleSetup` directly
  // sees, and it is a hostname, never a sentence.
  cnameTarget: "content.dev.reachkit.app",
});

/** The pass, mid-flight. `running: true` carries a stage and nothing else
 *  — no elapsed, estimate, countdown, clock or percentage exists to
 *  carry. */
export const FIXTURE_PASS: PassProgress = Object.freeze({
  running: true,
  stage: "reading_your_market",
});

export const FIXTURE_PAID_AT = new Date(Date.UTC(2026, 8, 5, 9, 30, 0));

/**
 * An honest stub of `SetupStore`: it refuses nothing it should not, it
 * records what it was asked to do, and it claims no row was written. It is
 * not a mock of a database — there is no database behind setup yet — and
 * every method says what it stands in for.
 *
 * `resolvesInDns` answers `true`: this store makes no network call (the
 * test suite forbids one) and the fixture founder's address is reachable.
 * A test that needs a refusal builds its own store.
 */
export function fixtureSetupStore(): SetupStore & {
  readonly committed: { siteId: string; submission: SetupSubmission }[];
  readonly enqueued: string[];
} {
  const committed: { siteId: string; submission: SetupSubmission }[] = [];
  const enqueued: string[] = [];

  return {
    committed,
    enqueued,
    // §13's `hasActiveAccess()` (#42). The fixture founder has paid —
    // reaching `/setup` at all means a webhook provisioned them.
    hasActiveAccess: async () => true,
    // §6.4's `resolvesInDns` (#22). Not called through here in the
    // fixture: no test in this corpus may reach a resolver.
    resolvesInDns: async () => true,
    // `sites.setup_completed_at` (#42). Always incomplete: this store is
    // never handed a completed account, and `completeSetup`'s
    // `already_complete` arm is driven by its own store in the tests.
    readProgress: async (): Promise<SetupProgressState> => ({
      complete: false,
      siteId: FIXTURE_SITE_ID,
      paidAt: FIXTURE_PAID_AT,
    }),
    commitSetup: async (a) => {
      committed.push(a);
    },
    enqueueDeepPass: async (siteId) => {
      enqueued.push(siteId);
    },
  };
}
