// BUILD §4.4 — the shell's facts, as a fixture.
//
// **This is the reserved fixture account's shell, and nobody else's.**
// `provider.ts` answers `isReservedFixtureAccount` from here and every other
// account from the live reads below, so what this file holds is one
// account's data rather than a placeholder for a missing one.
//
// Where each field comes from for a live account:
//
//   weeks / firstDueOn       → §11 `accountForWeek`
//   waiting                  → §9's drafts in review / needing attention
//   next / causes            → §9 `becomesPublishable`
//   domain / timeZone / mode → the `sites` row §4.3 and §4.7 write
//
// It is one exported constant, not a generator: a fixture that varied per
// call would make the layout conformance sweep non-deterministic. Its state
// is the ordinary one — a measured site with a scheduled publish — because
// that is the state every other screen is built against; the four
// no-publish arms and the never-measured arm are exercised by
// `tests/app/shell/`, which drives `assembleShell` directly.
import type { ShellFacts } from "./model";

/** A fixed instant, so the fixture's dates do not move with the clock.
 *  2026-09-07 is a Monday — the site-local week start `WEEK_START` names. */
const MONDAY = (weekOfSeptember: number): Date =>
  new Date(Date.UTC(2026, 8, weekOfSeptember, 6, 0, 0));

export const FIXTURE_DOMAIN = "example.com";

export const FIXTURE_SHELL_FACTS: ShellFacts = Object.freeze({
  domain: FIXTURE_DOMAIN,
  // REQ-073 c1's one stored preference. `SERP_LOCATION` fixes the MVP at
  // US-English (DECISIONS 2026-08-28), so the fixture's site sits in a US
  // zone rather than the machine's.
  timeZone: "America/New_York",
  publishingEnabled: true,
  weeks: Object.freeze([
    { domain: FIXTURE_DOMAIN, weekStart: MONDAY(17), measured: true },
    { domain: FIXTURE_DOMAIN, weekStart: MONDAY(24), measured: true },
    { domain: FIXTURE_DOMAIN, weekStart: MONDAY(31), measured: true },
  ]),
  firstDueOn: MONDAY(17),
  waiting: 2,
  next: new Date(Date.UTC(2026, 8, 8, 13, 0, 0)),
  // REQ-092 c3: the ordinary state is that ReachKit has not stopped, so
  // nothing states one. The stopped arm is exercised by
  // `tests/presentation/sweeps/stopped.test.tsx`, which renders every route
  // twice against a stop it supplies; a fixture that shipped a stop would
  // put the notice on the owner's preview of every other screen.
  stopped: null,
  noPublishCauses: Object.freeze({
    reachkit_stopped: false,
    publishing_paused: false,
    nothing_approved: false,
    nothing_planned: false,
  }),
});
