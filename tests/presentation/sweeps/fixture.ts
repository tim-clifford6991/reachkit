// tests/presentation/sweeps/fixture.ts — REQ-091, BUILD §6.6
//
// The cold-start fixture: a domain that resolves, serves a readable home
// document, **ranks for nothing and is cited in no AI answer**. It is the
// customer REQ-091's user story names, and the one the product exists for.
//
// Nothing here carries an estimate, a benchmark, a cohort average, or a
// manufactured rival, target, question or opportunity. That is what makes
// criterion 3's assertion mean something: a filler value seeded here would
// make "nothing stands in the place of what the customer does not have"
// vacuous.
//
// The report half is `src/app/(public)/scan/[domain]/_fixture/states.ts`'s
// `cold-start.example.com` arm, which issue #13 already built as exactly
// this case ("the measurement happened and the answer is zero"). This file
// defines no second one (rule 7.2); it names it, and adds the app-side
// facts the shell reads, which that file does not hold.
import type { ShellFacts } from "@/app/(account)/app/_shell/model";
import type { WorkStop } from "@/lib/presentation/stopped";

/** The domain that ranks for nothing. */
export const COLD_START_DOMAIN = "cold-start.example.com";

/** A domain with presence, for the comparison REQ-091 criterion 2's "no
 *  module is hidden" is decided by, and the stand-in for "another customer"
 *  criterion 3 forbids borrowing from. */
export const WARM_DOMAIN = "example.com";

/** What the warm fixture measured and the cold-start customer did not: its
 *  rivals and two of its searches. None may appear on a cold-start screen
 *  (criterion 3). Transcribed from `_fixture/states.ts`, which is where
 *  they are declared. */
export const BORROWABLE = Object.freeze([
  "rival-one.example.net",
  "rival-two.example.net",
  "rival-three.example.org",
  "amplitude alternative",
  "mixpanel vs amplitude",
]);

const MONDAY = (day: number): Date => new Date(Date.UTC(2026, 8, day, 6, 0, 0));

/** The app-side facts for a customer on their first day: no week measured
 *  yet, nothing waiting, and no page planned — every count a real zero, and
 *  none of them an absence. `nothing_planned` rather than no cause at all:
 *  ADR-061 rules an unattributed empty ReachKit's own stop, and a cold start
 *  is not a stop. */
export const COLD_START_SHELL_FACTS: ShellFacts = Object.freeze({
  domain: COLD_START_DOMAIN,
  timeZone: "America/New_York",
  mode: "autopilot",
  weeks: Object.freeze([]),
  firstDueOn: MONDAY(14),
  waiting: 0,
  next: null,
  stopped: null,
  noPublishCauses: Object.freeze({
    reachkit_stopped: false,
    publishing_paused: false,
    nothing_approved: false,
    nothing_planned: true,
  }),
});

/** A customer with presence and a scheduled publish — the ordinary state
 *  the shell fixture already carries. */
export const WARM_SHELL_FACTS: ShellFacts = Object.freeze({
  ...COLD_START_SHELL_FACTS,
  domain: WARM_DOMAIN,
  weeks: Object.freeze([
    { domain: WARM_DOMAIN, weekStart: MONDAY(7), measured: true },
    { domain: WARM_DOMAIN, weekStart: MONDAY(14), measured: true },
  ]),
  firstDueOn: MONDAY(7),
  waiting: 2,
  next: new Date(Date.UTC(2026, 8, 16, 13, 0, 0)),
  noPublishCauses: Object.freeze({
    reachkit_stopped: false,
    publishing_paused: false,
    nothing_approved: false,
    nothing_planned: false,
  }),
});

/** ReachKit stopped its own work. Note what it does **not** carry: no cap,
 *  no spend, no error, no status — `WorkStop` has no field for one, which
 *  is how REQ-092 criterion 8 is kept rather than filtered.
 *
 *  `publishing_paused` is true beside it on purpose: ADR-011's landmine
 *  case, where a second reason is also true and must not be named. */
export const STOP: WorkStop = Object.freeze({
  since: new Date(Date.UTC(2026, 8, 6, 9, 0, 0)),
  resumes: { on: new Date(Date.UTC(2026, 8, 8, 9, 0, 0)) },
  needs: { kind: "nothing" as const },
  partial: false,
});

export const STOPPED_SHELL_FACTS: ShellFacts = Object.freeze({
  ...WARM_SHELL_FACTS,
  stopped: STOP,
  noPublishCauses: Object.freeze({
    reachkit_stopped: false,
    publishing_paused: true,
    nothing_approved: false,
    nothing_planned: false,
  }),
});
