// BUILD §4.5 — Overview's facts, as a fixture.
//
// Issue #15 builds this screen on FIXTURE data behind the typed provider in
// `provider.ts`. Every field below stands in for a read that does not exist
// yet, each naming the issue that will supply it:
//
//   points / firstDueOn / aiPresence → §11 weekly measurement (#41)
//   pagesPublished                   → §9 publishing (#45)
//   rivals                           → §6.6 rival sizing (#27), setup (#14)
//   waiting                          → §9 drafts in review / needing attention (#45)
//   supply                           → §7 supply depth (#10)
//   timeZone / today                 → §4.3 setup, §4.7 settings (#14, #18)
//
// It is one exported constant, not a generator: a fixture that varied per
// call would make the layout conformance sweep non-deterministic, and a
// fixture keyed on the wall clock would make "today" a different day
// depending on when the sweep ran.
//
// **It agrees with the shell's fixture, and that is deliberate.** The
// sidebar states `Week 3` from `FIXTURE_SHELL_FACTS` (three measured
// weeks), so the series below carries three measured weeks too — a preview
// whose sidebar and chart disagreed about how long the customer has been
// measured would be worse than no preview. The domain and the zone are read
// from that fixture rather than restated, so they cannot drift.
//
// The state it shows is the ordinary one, chosen to exercise both halves of
// §4.5's data rule in a single frame: `searches` carries a **delta** (it has
// a previous measurement), `pagesPublished` carries its **goal** (it has
// none). The arms it does not show — cold start, no week measured, nothing
// waiting, the ratio's first crossing — are exercised by
// `tests/app/overview/`, which drives the resolvers directly.
import { measured, measuredZero, unmeasured } from "@/lib/measure/measured";
import type { OverviewFacts } from "./model";
import { FIXTURE_SHELL_FACTS } from "../_shell/fixture";

/** A fixed instant, so the fixture's dates do not move with the clock.
 *  Every date below is a site-local Monday (`WEEK_START`) in August 2026. */
const MONDAY = (dayOfAugust: number): Date => new Date(Date.UTC(2026, 7, dayOfAugust, 6, 0, 0));

/** The day the fixture is "opened" on: Friday 4 September 2026, so the week
 *  strip carries done days, a today and days still to come. */
const FIXTURE_TODAY = new Date(Date.UTC(2026, 8, 4, 14, 30, 0));

export const FIXTURE_OVERVIEW_FACTS: OverviewFacts = Object.freeze({
  timeZone: FIXTURE_SHELL_FACTS.timeZone,
  today: FIXTURE_TODAY,

  // §6.6: "Growth chart starts at 0 and that is the story: the line leaving
  // the floor." Three measured weeks — the count the sidebar states — and
  // one week that did not run, which the chart draws as a break.
  points: Object.freeze([
    { weekStart: MONDAY(10), value: measuredZero(0, MONDAY(10)) },
    { weekStart: MONDAY(17), value: measured(36, MONDAY(17)) },
    { weekStart: MONDAY(24), value: unmeasured<number>("not_attempted", MONDAY(24)) },
    { weekStart: MONDAY(31), value: measured(81, MONDAY(31)) },
  ]),
  firstDueOn: FIXTURE_SHELL_FACTS.firstDueOn,

  // DECISIONS 2026-09-03's one reading: which weeks of the trailing window
  // the customer was named in at least one tracked question's AI answer.
  // `null` is the week that was not measured — never a miss.
  aiPresence: Object.freeze([false, true, null, true]),

  // No previous measurement, so this headline carries its goal of 30.
  pagesPublished: measured(11, MONDAY(31)),

  rivals: Object.freeze({
    own: measured(81, MONDAY(31)),
    previousOwn: measured(36, MONDAY(17)),
    rivals: Object.freeze([
      {
        domain: "bigcompetitor.com",
        confirmed: true,
        ranked: measured(6318, MONDAY(31)),
        previousRanked: measured(9936, MONDAY(17)),
        series: Object.freeze([276, 214, 168, 121, 96, 78]),
      },
      {
        domain: "secondplace.io",
        confirmed: true,
        ranked: measured(2511, MONDAY(31)),
        previousRanked: measured(3384, MONDAY(17)),
        series: Object.freeze([94, 81, 63, 52, 40, 31]),
      },
      // Derived by §6.6's rival pass but never confirmed by the customer,
      // so it never renders (REQ-041 c8). Present in the fixture precisely
      // so the preview proves the filter, not just the test.
      {
        domain: "unconfirmed-candidate.com",
        confirmed: false,
        ranked: measured(1204, MONDAY(31)),
        series: Object.freeze([31, 30, 29, 28, 27, 26]),
      },
    ]),
  }),

  supply: Object.freeze({ exhausted: false, short: true, firstArrivalShortfall: false }),

  // Three items waiting: two render, one becomes the overflow count.
  waiting: Object.freeze([
    {
      kind: "pending_veto" as const,
      title: "How teams pick an onboarding tool",
      since: new Date(Date.UTC(2026, 8, 4, 6, 0, 0)),
      href: "/app/draft/fixture-veto",
    },
    {
      kind: "needs_you" as const,
      title: "Connect the publishing destination",
      since: new Date(Date.UTC(2026, 8, 2, 6, 0, 0)),
      href: "/app/settings",
    },
    {
      kind: "pending_veto" as const,
      title: "Onboarding checklists that actually get used",
      since: new Date(Date.UTC(2026, 8, 3, 6, 0, 0)),
      href: "/app/draft/fixture-veto-2",
    },
  ]),
});
