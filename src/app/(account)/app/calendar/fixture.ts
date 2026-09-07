// BUILD §4.6 — the calendar's facts, as a fixture.
//
// Issue #16 builds the calendar and its day panel on FIXTURE data behind
// the typed provider in `provider.ts`. Every field below stands in for a
// read that does not exist yet, each naming the issue that will supply it:
//
//   drafts / state / veto deadline  → §9 publishing (#45, #46)
//   why / doneWhen / winnability    → §7 opportunities (#40)
//   youStand / measuredAt           → §11 weekly measurement (#41)
//   instructions                    → REQ-047's outstanding instruction (#40)
//   stoppedDays                     → §11's stopped-work record (#39)
//   heldDays                        → §9's held set (#45, REQ-092 c5)
//   unusedSupply                    → §7 `supplyDepth()` (#40)
//
// It is one exported constant with a **fixed** `now`, not a generator: a
// fixture that moved with the clock would make the layout conformance sweep
// non-deterministic, and "today" is the thing this screen is most opinionated
// about. 2026-09-15 is a Tuesday in the site's zone; the month it sits in
// carries every state the grid can draw, including both weekend columns, so
// one screenshot exercises the whole of §4.6.
import { measured, measuredZero, unmeasured } from "@/lib/measure/measured";
import type { CalendarFacts, DraftOnDay, WhyThisPage } from "./month";
import type { DayKey } from "./dates";
import type { PublishState } from "./stages";

export const FIXTURE_TIME_ZONE = "America/New_York";
/** 10:00 in the site's zone on 2026-09-15. */
export const FIXTURE_NOW = new Date(Date.UTC(2026, 8, 15, 14, 0, 0));
export const FIXTURE_MONTH = "2026-09";

/** The date the fixture's one measurement was taken — REQ-043 c10's single
 *  provenance line states this and nothing beside each value. */
const MEASURED_AT = new Date(Date.UTC(2026, 8, 14, 6, 0, 0));

/** Specimen opportunity evidence. Customer data, not product voice: a
 *  search query and a page title are values the engine will read from
 *  `opportunities.evidence` (#40), and the copy registry does not speak
 *  them. */
interface Specimen {
  title: string;
  search: string;
  askedAs: string;
  answeredTodayBy: readonly string[];
  youStand: WhyThisPage["youStand"];
  doneWhen: string;
  winnability: WhyThisPage["winnability"];
}

const SPECIMENS: readonly Specimen[] = [
  {
    title: "How to choose a CRM for a small team",
    search: "best crm for small teams",
    askedAs: "What CRM should a small team use?",
    answeredTodayBy: ["hubspot.com", "zoho.com"],
    youStand: measured(14, MEASURED_AT),
    doneWhen: "Ranked in the top 20 for the target search within 3 weeks",
    winnability: "winnable",
  },
  {
    title: "CRM pricing, compared",
    search: "crm pricing comparison",
    askedAs: "How much does a CRM cost?",
    answeredTodayBy: ["capterra.com"],
    youStand: measuredZero(0, MEASURED_AT),
    doneWhen: "Named in an AI answer for the target question within 6 weeks",
    winnability: "reach",
  },
  {
    title: "Moving from spreadsheets to a CRM",
    search: "spreadsheet to crm migration",
    askedAs: "How do I move my spreadsheet into a CRM?",
    answeredTodayBy: ["reddit.com", "salesforce.com"],
    youStand: unmeasured("undeterminable", MEASURED_AT),
    doneWhen: "Ranked in the top 20 for the target search within 3 weeks",
    winnability: "not-yet",
  },
];

function whyOf(index: number): WhyThisPage {
  const s = SPECIMENS[index % SPECIMENS.length] as Specimen;
  return {
    search: s.search,
    askedAs: s.askedAs,
    answeredTodayBy: s.answeredTodayBy,
    youStand: s.youStand,
    doneWhen: s.doneWhen,
    winnability: s.winnability,
  };
}

/** date → state. Every state the calendar can draw appears, and both
 *  weekend columns carry a page (§4.6: "weekends included"). The dates with
 *  no row here are the empty ones, and each is emptied by a different arm
 *  of `EMPTY_PRECEDENCE`. */
const SCHEDULE: Readonly<Record<DayKey, PublishState>> = {
  "2026-09-01": "published",
  "2026-09-02": "published",
  "2026-09-03": "published",
  "2026-09-04": "published",
  "2026-09-05": "published", // Saturday
  "2026-09-06": "published", // Sunday
  "2026-09-07": "published",
  "2026-09-08": "unpublished", // → empties its date (page_cannot_go_live)
  "2026-09-09": "published",
  "2026-09-10": "needs_attention",
  "2026-09-11": "published",
  "2026-09-12": "skipped", // → empties its date (page_cannot_go_live)
  "2026-09-14": "published",
  "2026-09-15": "in_review", // today
  "2026-09-16": "approved",
  "2026-09-17": "approved",
  "2026-09-18": "planned",
  "2026-09-19": "planned",
  "2026-09-20": "planned",
  "2026-09-21": "planned",
  "2026-09-22": "generating",
};

/** The states a page can only be in by having passed through review. */
const REVIEWED: readonly PublishState[] = Object.freeze([
  "in_review",
  "approved",
  "publishing",
  "published",
  "unpublished",
] as const);

const DRAFTS: readonly DraftOnDay[] = Object.entries(SCHEDULE).map(([day, state], index) => {
  const specimen = SPECIMENS[index % SPECIMENS.length] as Specimen;
  const [y, m, d] = day.split("-").map(Number);
  return {
    draftId: `draft-${day}`,
    title: specimen.title,
    state,
    scheduledFor: day,
    why: whyOf(index),
    measuredAt: MEASURED_AT,
    liveUrl: state === "published" ? `https://content.example.com/${day}` : null,
    vetoDeadline: state === "in_review" ? new Date(Date.UTC(2026, 8, 16, 14, 0, 0)) : null,
    publishAt:
      state === "approved" || state === "publishing"
        ? new Date(Date.UTC(y ?? 2026, (m ?? 9) - 1, d ?? 1, 13, 0, 0))
        : null,
    // Whether the draft ever reached review. A page that is in review, or
    // past it, has by definition; one still on its way there has not. The
    // fixture's `needs_attention` page is §8 rule 4's — generation failed
    // twice and no one ever read it — which is the state the restart
    // control is open on (#143).
    enteredReview: REVIEWED.includes(state),
  };
});

/** REQ-092's stop, as the fixture account's own. The stopped day below is
 *  what the owner reviews the three lines on: c1's line, c2's `needs
 *  nothing` and c4's `no time promised` — the two arms a day with no record
 *  behind it truthfully takes (issue #113). */
const FIXTURE_STOP = Object.freeze({
  since: new Date(Date.UTC(2026, 8, 13, 0, 0, 0)),
  resumes: { promised: false } as const,
  needs: { kind: "nothing" } as const,
  partial: false,
});

export const FIXTURE_CALENDAR_FACTS: CalendarFacts = Object.freeze({
  timeZone: FIXTURE_TIME_ZONE,
  now: FIXTURE_NOW,
  stop: FIXTURE_STOP,
  drafts: Object.freeze(DRAFTS),
  // REQ-047 c5: while an instruction stands against a date, it is that
  // date's one account — outranking even ReachKit's own stop (ADR-061 point 3).
  instructions: Object.freeze({ "2026-09-24": "opportunity-24" }),
  // REQ-092 c1: a day ReachKit did not do the work. It carries the
  // stopped-work line, never the exhausted-supply one.
  stoppedDays: Object.freeze(["2026-09-13"] as const),
  // REQ-092 c5 (#116): a date whose planned page was held and went out
  // later. Empty, and honestly so — the held set is
  // `src/lib/publish/switch`'s and no reader of it exists yet (#45's
  // provider). A fixture date here would put an owner-owed line on the
  // owner's own preview of the month, which renders as nothing.
  heldDays: Object.freeze([] as readonly string[]),
  customerChangeHoldsPages: null,
  // Read, and zero: the one condition ADR-061 point 1 lets the
  // exhausted-supply arm fire on. `null` here would send every remaining
  // date to `unattributed` instead, which is the behaviour that ADR's
  // mutation check pins.
  unusedSupply: 0,
});
