// BUILD §4.6 — "one event per day, every day filled while supply lasts,
// weekends included", and the stage filter cards' counts.
//
// The month read: the site-local days of one month, each resolved into
// **exactly one** of a page or an empty account, plus the counts All and
// each of the five stages hold. Grid and counts come out of one call, so
// the filter can never disagree with the grid it filters (REQ-043 c6).
//
// `assembleMonth` is pure — facts in, model out. Reading the facts is
// `provider.ts`'s, and today that is a fixture (this issue builds the
// calendar on fixture data behind the typed provider; §7's opportunities
// (#40) and §9's publishing (#45) supply the real ones later). Keeping the
// assembly pure is what lets every REQ-043 criterion be decided by a test
// with no database at all.
//
// **This module writes nothing.** There is no code path here that creates a
// draft, and there must not be: §4.6's supply rule and DECISIONS 2026-08-28
// ("Supply is the cap: never invent an opportunity to fill a day; the
// calendar is never padded") are kept by a read that cannot pad.
import type { Measured } from "@/lib/measure/measured";
import { accountFor, type EmptyAccount, type EmptyFacts } from "./empty";
import { STAGE_OF, type PublishState, type Stage, type StageFilter } from "./stages";
import { dayKeyOf, monthGrid, monthOf, type DayKey, type MonthKey } from "./dates";

/** REQ-043 criterion 8's evidence, and §4.6's "Why this page" rows —
 *  "search / asked / answered-today-by / you / done-when — all mono
 *  values". `youStand` is a `Measured<number>` and not a number: REQ-004's
 *  trichotomy is what keeps an outage from rendering as a zero. */
export interface WhyThisPage {
  search: string;
  askedAs: string;
  answeredTodayBy: readonly string[];
  youStand: Measured<number>;
  doneWhen: string;
  /** Rendered through `BAND_LABELS.winnability` (ADR-001), never as a word
   *  this module chooses. */
  winnability: "winnable" | "reach" | "not-yet";
}

/** One draft, on the site-local date it is scheduled for. */
export interface DraftOnDay {
  draftId: string;
  title: string;
  state: PublishState;
  scheduledFor: DayKey;
  why: WhyThisPage;
  /** REQ-043 c10: the one date the panel's provenance line states. Not
   *  repeated beside each value. */
  measuredAt: Date;
  /** Where the page went, for a page ReachKit has delivered. `null`
   *  otherwise — never an empty string, which would read as an address. */
  liveUrl: string | null;
  /** BUILD §9's veto window, for a page in review. */
  vetoDeadline: Date | null;
  /** When a scheduled page goes out. */
  publishAt: Date | null;
}

export interface PageOnDay extends DraftOnDay {
  /** Never optional and never derived twice — `STAGE_OF` is the one table
   *  (REQ-043 c2: "no page renders without a stage"). */
  stage: Stage;
}

export interface DayCell {
  day: DayKey;
  /** `false` for a cell that exists only to hold a column position in the
   *  first or last week. Such a cell carries neither a page nor an account,
   *  because it is not a date this calendar has anything to say about. */
  inMonth: boolean;
  today: boolean;
  /** Exactly one of `page` / `empty` is non-null on an in-month cell; both
   *  are `null` on an out-of-month one. */
  page: PageOnDay | null;
  empty: EmptyAccount | null;
}

export interface MonthModel {
  month: MonthKey;
  timeZone: string;
  /** The site-local today — the day the panel opens on (REQ-043 c7). */
  today: DayKey;
  cells: readonly DayCell[];
  /** REQ-043 c6, from the same result as the grid. */
  counts: Readonly<Record<StageFilter, number>>;
}

/** Everything the calendar reads, before it is a model. One shape, so the
 *  fixture and a future query answer the same question. */
export interface CalendarFacts {
  timeZone: string;
  /** The instant "today" is resolved from, in the site's zone. A parameter,
   *  never `Date.now()` read inside the assembly: a model that reads a
   *  clock cannot be tested for the UTC+13 case REQ-043's `rests-on` row
   *  names. */
  now: Date;
  drafts: readonly DraftOnDay[];
  /** REQ-047 c5's outstanding instructions, by the date each stands
   *  against. */
  instructions: Readonly<Record<DayKey, string>>;
  /** The dates on which ReachKit stopped its own work (REQ-092 c1). */
  stoppedDays: readonly DayKey[];
  customerChangeHoldsPages: "publishing_off" | "destination_disconnected" | null;
  /** `supplyDepth().unused`, **read** — or `null` where it could not be.
   *  ADR-061 point 1 turns on this distinction. */
  unusedSupply: number | null;
}

/** Thrown rather than rendered: two pages on one date is a data defect and
 *  REQ-043 criterion 1 says there is no such day ("no date carries more
 *  than one page"). Picking one silently would put the calendar in a state
 *  the requirement says cannot exist and hide the reason it did. */
export class TwoPagesOnOneDateError extends Error {
  constructor(public readonly day: DayKey) {
    super(`Two drafts are scheduled for ${day}; REQ-043 c1 allows one page per date.`);
    this.name = "TwoPagesOnOneDateError";
  }
}

function emptyFactsFor(day: DayKey, facts: CalendarFacts, cannotGoLive: PublishState | null): EmptyFacts {
  const instruction = facts.instructions[day];
  return {
    instruction: instruction === undefined ? null : { opportunityId: instruction },
    reachkitStopped: facts.stoppedDays.includes(day),
    // Only the two states `STAGE_OF` sends to `null` reach here, and the
    // narrowing is by that table rather than by a second list of state
    // names this file would have to keep in step.
    pageCannotGoLive:
      cannotGoLive === "skipped" || cannotGoLive === "unpublished" ? cannotGoLive : null,
    customerChangeHoldsPages: facts.customerChangeHoldsPages,
    unusedSupply: facts.unusedSupply,
  };
}

export function assembleMonth(facts: CalendarFacts, month: MonthKey): MonthModel {
  const today = dayKeyOf(facts.now, facts.timeZone);

  const byDay = new Map<DayKey, DraftOnDay>();
  for (const draft of facts.drafts) {
    if (monthOf(draft.scheduledFor) !== month) continue;
    if (byDay.has(draft.scheduledFor)) throw new TwoPagesOnOneDateError(draft.scheduledFor);
    byDay.set(draft.scheduledFor, draft);
  }

  const cells: DayCell[] = monthGrid(month).map(({ day, inMonth }) => {
    if (!inMonth) return { day, inMonth, today: day === today, page: null, empty: null };

    const draft = byDay.get(day);
    const stage = draft === undefined ? null : STAGE_OF[draft.state];
    if (draft !== undefined && stage !== null) {
      return { day, inMonth, today: day === today, page: { ...draft, stage }, empty: null };
    }
    return {
      day,
      inMonth,
      today: day === today,
      page: null,
      empty: accountFor(emptyFactsFor(day, facts, draft?.state ?? null)),
    };
  });

  return { month, timeZone: facts.timeZone, today, cells, counts: countsOf(cells) };
}

/** Counted off the very cells the grid renders, so REQ-043 c6's "every
 *  stage shows how many items it holds" is a projection of the grid and not
 *  a second query that can disagree with it. */
function countsOf(cells: readonly DayCell[]): Record<StageFilter, number> {
  const counts: Record<StageFilter, number> = {
    all: 0,
    live: 0,
    your_review: 0,
    scheduled: 0,
    planned: 0,
    needs_you: 0,
  };
  for (const cell of cells) {
    if (cell.page === null) continue;
    counts.all += 1;
    counts[cell.page.stage] += 1;
  }
  return counts;
}

/** The cell a day panel is opened on. `undefined` only for a day outside
 *  the month that was assembled — never for a date the grid drew. */
export function cellFor(model: MonthModel, day: DayKey): DayCell | undefined {
  return model.cells.find((cell) => cell.day === day && cell.inMonth);
}
