// BUILD §4.5 — Overview's facts, as a fixture.
//
// **This is the reserved fixture account's Overview, and nobody else's.**
// `provider.ts` answers `isReservedFixtureAccount` from here and reads every
// other account's facts live, so what this file holds is one account's data
// rather than a placeholder for a missing read. It is what keeps the layout
// and visual sweeps deterministic.
//
// Where each field comes from for a live account:
//
//   points / firstDueOn / aiPresence → §11 weekly measurement
//   pagesPublished                   → §9 publishing
//   rivals                           → §6.6 rival sizing, and setup's answers
//   waiting                          → §9's drafts in review / needing attention
//   supply                           → §7 supply depth
//   timeZone / today                 → the `sites` row
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

  // No answer has changed under this customer, so nothing breaks the series
  // and the week count spans all of it (REQ-071 c12/c13). The fixture shows
  // the ordinary frame; the change arms are exercised by
  // `tests/app/overview/`.
  changes: Object.freeze([]),

  // UI-SPEC S12's own tiles. The score is 62 in the band "Hard to find",
  // eight points up on the week before — the set's `62 ▲ 8` — and the
  // pages count carries the six of its seventeen that are already ranking:
  // the set's `17  6 already ranking`, which is the whole of that tile's
  // row and carries no goal chip (issue #536).
  score: measured({ score: 62, band: "hard-to-find" as const }, MONDAY(31)),
  scorePrevious: measured({ score: 54, band: "hard-to-find" as const }, MONDAY(17)),
  // The header's trend (SPEC §4, 2026-09-20), aligned to `points` above:
  // the week that did not run is `null`, never a zero.
  scorePoints: Object.freeze([31, 54, null, 62]),
  pagesPublished: measured(17, MONDAY(31)),
  pagesRanking: measured(6, MONDAY(31)),

  rivals: Object.freeze({
    own: measured(81, MONDAY(31)),
    previousOwn: measured(36, MONDAY(17)),
    rivals: Object.freeze([
      // Sized, and banded `far`: against an own count of 81 the middle bar
      // is `max(500, 5×81) = 500`, so 6,318 is beyond it. That is what
      // makes REQ-096 c6's line and its one control part of the densest
      // frame this screen can hold, which is what a fixture is for
      // (issue #223).
      {
        domain: "bigcompetitor.com",
        confirmed: true,
        ranked: measured(6318, MONDAY(31)),
        previousRanked: measured(9936, MONDAY(17)),
        series: Object.freeze([276, 214, 168, 121, 96, 78]),
        size: Object.freeze({
          domain: "bigcompetitor.com",
          state: "sized" as const,
          rankedCount: 6318,
          band: "far" as const,
          at: MONDAY(31),
          current: true,
        }),
      },
      // Sized too, and `middle` — so it carries **no** offer, and the frame
      // shows the two arms side by side rather than one at a time.
      //
      // Its count moved from 2,511 to 420 when the bands started rendering
      // (issue #223): against an own count of 81 the middle bar is
      // `max(500, 5×81) = 500`, so 2,511 was `far` and this row would have
      // carried a second offer. A fixture whose stored band and stored
      // counts disagree is a fixture that teaches the wrong rule, and the
      // one this screen most needs to show is *one* rival beyond reach
      // among rivals that are not.
      {
        domain: "secondplace.io",
        confirmed: true,
        ranked: measured(420, MONDAY(31)),
        previousRanked: measured(430, MONDAY(17)),
        series: Object.freeze([12, 11, 9, 8, 6, 5]),
        size: Object.freeze({
          domain: "secondplace.io",
          state: "sized" as const,
          rankedCount: 420,
          band: "middle" as const,
          at: MONDAY(31),
          current: true,
        }),
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

  supply: Object.freeze({ exhausted: false, unmeasured: false, measuring: false, outsized: false, short: true, firstArrivalShortfall: false }),

  // Three items waiting: two render, one becomes the overflow count.
  waiting: Object.freeze([
    {
      kind: "pending_veto" as const,
      title: "How teams pick an onboarding tool",
      since: new Date(Date.UTC(2026, 8, 4, 6, 0, 0)),
      vetoDeadline: new Date(Date.UTC(2026, 8, 5, 6, 0, 0)),
      href: "/app/draft/fixture-veto",
    },
    {
      kind: "needs_you" as const,
      title: "Connect the publishing destination",
      since: new Date(Date.UTC(2026, 8, 2, 6, 0, 0)),
      vetoDeadline: null,
      href: "/app/settings",
    },
    {
      kind: "pending_veto" as const,
      title: "Onboarding checklists that actually get used",
      // The oldest veto item, so this is the one the cap shows — and its
      // window is still open: its stored deadline closes at 20:42 on the
      // 4th, which is 6 h 12 m after `FIXTURE_TODAY`, the very duration
      // UI-SPEC S12 prints. It used to start a full day earlier, so the
      // panel stated `0 h 0 m` — true, but a picture of an expired window
      // rather than of the screen the set draws.
      since: new Date(Date.UTC(2026, 8, 3, 20, 42, 0)),
      vetoDeadline: new Date(Date.UTC(2026, 8, 4, 20, 42, 0)),
      href: "/app/draft/fixture-veto-2",
    },
  ]),

  // SPEC §4 (2026-09-20): the page waiting for review, which the Overview
  // leads with. It is the same draft the first alert below is about — one
  // page, stated twice on one screen would be two pages to a reader — and it
  // carries the densest arm the card can draw: a measured demand, a rival
  // holding the answer today, a band, and a body to preview.
  waitingPage: Object.freeze({
    draftId: "fixture-veto",
    title: "How teams pick an onboarding tool",
    stage: "your_review" as const,
    goesLiveAt: new Date(Date.UTC(2026, 8, 5, 6, 0, 0)),
    target: Object.freeze({
      search: "onboarding tool comparison",
      volume: measured(1900, MONDAY(31)),
      winnability: "winnable" as const,
      answeredTodayBy: Object.freeze(["bigcompetitor.com"]),
    }),
    update: false,
    lead: "Most teams compare onboarding tools on price first and switch within a year. The three questions below sort the shortlist faster, and none of them is about the monthly fee.",
    readerHost: "content.example.com",
  }),

  // Issue 1362: what went live last, so the head's quiet line is drawn on
  // the owner's preview and measured by the layout gate.
  lastLive: Object.freeze({
    title: "What an onboarding checklist should hold",
    at: new Date(Date.UTC(2026, 8, 4, 13, 0, 0)),
  }),

  // SPEC §4 (2026-09-20): what each day of the fixture's week holds. Friday
  // is today, Sunday carries the page in review, and Wednesday holds none —
  // so the strip shows all three of the words it can say.
  weekPages: Object.freeze([
    "calendar.stage.live" as const,
    "calendar.stage.live" as const,
    null,
    "calendar.stage.live" as const,
    "calendar.stage.live" as const,
    "calendar.stage.scheduled" as const,
    "calendar.stage.your-review" as const,
  ]),

  // Issue 867: the engines the reserved account's pass asked, and what this
  // week's pages are aimed at.
  aiEngines: Object.freeze(["ai_overview", "ai_mode", "chatgpt"] as const),
  weekSearches: Object.freeze([
    "best crm for small teams",
    "crm pricing comparison",
  ]),
});
