// BUILD §4.6, §7 — the calendar's facts, read from the opportunity engine.
//
// The other half of `provider.ts`: what `readMonth` assembles from when the
// site is a real one rather than the reserved fixture account. Everything
// here is a projection of rows §7 already wrote — this file measures
// nothing, buys nothing, and **creates nothing**. "Supply is the cap: never
// invent an opportunity to fill a day; the calendar is never padded"
// (DECISIONS 2026-08-28) is kept the only way a read can keep it: the day
// list stops when the ranked list does.
//
// **Three engine calls and no fourth.** `nextForDay` is the one
// opportunity the first fillable day takes; `rankOpen` is the order the
// days after it take, and the two agree by construction (`nextForDay` is
// that list's head, loaded). `explainChoice` fills the day panel's "Why
// this page" rows from the evidence stored at creation — never
// re-measured, so the panel still reads correctly after the next Monday
// has moved every number.
//
// **What is honestly absent, and whose it is.** A date carries a *page*
// when §9's publishing puts a draft on it (#45); until then every date
// this file fills is `planned`, with no draft id — §8 generates the draft
// on the morning the date is due. So `drafts` here are planned pages and
// nothing else, and the four facts that are not §7's are their honest
// empty rather than a fixture value:
//
//   instructions                  REQ-047 c5's dated instruction (#42)
//   stoppedDays                   §11's stopped-work record (#39)
//   heldDays                      §9's held set (#45, REQ-092 c5)
//   customerChangeHoldsPages      §4.7's saved settings (#42)
//
// **Two values a planned page does not speak.** Its `title` is the search
// it targets and not the model's proposed title: that title is
// model-written and reaches a customer only through `GeneratedText`
// (ADR-012), which this screen has no gate for — the written title arrives
// with the draft (#44). Its `askedAs` is `templateQuestion`, the
// deterministic question form, which is code and not copy (DECISIONS
// 2026-09-05, #82).
import { templateQuestion } from "@/lib/market/questions/phrase";
import { unmeasured, type Measured } from "@/lib/measure/measured";
import {
  explainChoice,
  nextForDay,
  rankOpen,
  supplyDepth,
  type Choice,
} from "@/lib/opportunities";
import { writtenLine } from "../_shell/written";
import { addDays, dayKeyOf, daysOfMonth, type DayKey, type MonthKey } from "./dates";
import {
  declaredAnswers,
  declaredTimezone,
  generationHold,
  measuredAnswers,
  pendingChanges,
} from "@/lib/market/changes";
import { readStop } from "../_shell/stop";
import { readPublishingFacts, type ScheduledPage } from "./drafts-read";
import type { CalendarFacts, DraftOnDay, WhyThisPage } from "./month";

/** The site one calendar belongs to. Which site that is, is
 *  `currentSession()`'s (issue #35) — `provider.ts` names the gap. */
export interface CalendarSite {
  siteId: string;
  /** REQ-073 c1's stated zone. Every date on this screen is site-local. */
  timeZone: string;
}

// ── The "Why this page" rows, from the evidence stored at creation ───────

/** §4.6's `answered-today-by`: who holds the answer today. A Write target
 *  records the rival it is written to overtake; an Improve target is the
 *  customer's own page, so nobody else holds it. */
function answeredTodayBy(choice: Choice): readonly string[] {
  return choice.evidence.family === "write" ? [choice.evidence.rival.domain] : [];
}

/** §4.6's `you`. An Improve target carries the customer's measured
 *  position; a Write target is one the customer is absent from, and the
 *  evidence records the rival's position and not a position of theirs — so
 *  `undeterminable`, which renders the dash and its own line, never a 0
 *  (REQ-004). */
function youStand(choice: Choice, at: Date): Measured<number> {
  const evidence = choice.evidence;
  if (evidence.family === "improve" && evidence.shortfall.kind === "position") {
    return evidence.shortfall.position;
  }
  return unmeasured<number>("undeterminable", at);
}

/** §4.6's `asked`. The acceptance test carries the question where the
 *  target was chosen against one; otherwise it is the search's own
 *  question form — `templateQuestion`, the deterministic shape, which is
 *  code and not a sentence the product speaks. */
function askedAs(choice: Choice, search: string): string {
  return choice.acceptance.form === "named_on" ? choice.acceptance.question : templateQuestion(search);
}

/** §4.6's `done-when`: the acceptance test recorded at creation, in the
 *  owner's words. Owner-owed, so it renders as nothing until written —
 *  never as a placeholder and never as a sentence this file composes.
 *  `gate_cleared` is unreachable here: the Fix family is excluded from the
 *  ranked list by the store, once, and is never a page on a date. */
function doneWhen(choice: Choice): string {
  const acceptance = choice.acceptance;
  if (acceptance.form === "top20") {
    return writtenLine("calendar.done-when.top20", { query: acceptance.query }) ?? "";
  }
  if (acceptance.form === "named_on") {
    return writtenLine("calendar.done-when.named-on", { question: acceptance.question }) ?? "";
  }
  return writtenLine("calendar.done-when.gate-cleared") ?? "";
}

/** The date the evidence under this choice was measured on — REQ-043 c10's
 *  one provenance line. The stored value's own date, never today's. */
function measuredAtOf(choice: Choice, fallback: Date): Date {
  const evidence = choice.evidence;
  return evidence.family === "fix" ? fallback : evidence.volume.at;
}

function whyOf(choice: Choice, at: Date): WhyThisPage {
  const search = choice.evidence.family === "fix" ? "" : choice.evidence.query;
  return {
    search,
    askedAs: askedAs(choice, search),
    answeredTodayBy: answeredTodayBy(choice),
    youStand: youStand(choice, at),
    doneWhen: doneWhen(choice),
    // Non-null for everything the ranked list can hold: `fit_band` is null
    // for exactly the Fix family, which the list excludes.
    winnability: choice.fitBand ?? "not-yet",
  };
}

/** One date §9 has put a page on. The page's own state, its two dates and
 *  its address come from the row; everything about *why* this page is on
 *  this date is §7's, read through the same `explainChoice` a planned date
 *  uses — so a page keeps its account of itself from the moment supply
 *  chose it to the moment it goes live, and the panel does not change its
 *  story when the draft is written.
 *
 *  The title is the search, not the draft's own written title: see
 *  `drafts-read.ts`'s note on ADR-012. */
function pageOn(a: {
  page: ScheduledPage;
  choice: Choice;
  publishAt: Date | null;
  now: Date;
}): DraftOnDay {
  const at = measuredAtOf(a.choice, a.now);
  return {
    draftId: a.page.draftId,
    title: a.choice.evidence.family === "fix" ? "" : a.choice.evidence.query,
    state: a.page.state,
    enteredReview: a.page.enteredReview,
    scheduledFor: a.page.scheduledFor as DayKey,
    why: whyOf(a.choice, at),
    measuredAt: at,
    liveUrl: a.page.liveUrl,
    vetoDeadline: a.page.vetoDeadline,
    publishAt: a.publishAt,
  };
}

/** One planned date. `draftId` is null and every §9 field is null: nothing
 *  has been written, scheduled or published for this date yet, and a date
 *  that says otherwise would offer controls with nothing to act on. */
function plannedOn(day: DayKey, choice: Choice, now: Date): DraftOnDay {
  const at = measuredAtOf(choice, now);
  return {
    draftId: null,
    title: choice.evidence.family === "fix" ? "" : choice.evidence.query,
    state: "planned",
    // A planned page has no draft at all yet, so it has certainly never
    // been in review (#143). Honest rather than defaulted: every §9 field
    // on this shape is its own empty for the same reason.
    enteredReview: false,
    scheduledFor: day,
    why: whyOf(choice, at),
    measuredAt: at,
    liveUrl: null,
    vetoDeadline: null,
    publishAt: null,
  };
}

// ── The month ───────────────────────────────────────────────────────────

/**
 * The dates this month that supply may fill, in order.
 *
 * "One page a day. Every day." — so every site-local date from today
 * forward, weekends included. Dates already past are not filled: supply
 * that was never used on them was never scheduled for them, and a calendar
 * that back-filled yesterday would be claiming work nobody did.
 *
 * The offset matters and is why this returns dates from *today* and not
 * from the month's first: a customer paging forward to next month must see
 * the supply that is left after this month has taken its share, not rank 1
 * again.
 */
export function fillableDates(a: { month: MonthKey; today: DayKey }): readonly DayKey[] {
  return daysOfMonth(a.month).filter((day) => day >= a.today);
}

/** How many days of supply stand between today and the first date of the
 *  month being viewed — the offset into the ranked list this month starts
 *  at. Zero for the month today falls in. */
export function offsetForMonth(a: { month: MonthKey; today: DayKey }): number {
  const first = daysOfMonth(a.month)[0];
  if (first === undefined || first <= a.today) return 0;
  let offset = 0;
  for (let day = a.today; day < first; day = addDays(day, 1)) offset += 1;
  return offset;
}

/**
 * REQ-071 c11's hold, for one site.
 *
 * Three reads and one call, all of them the change engine's: the answers as
 * declared, the answers as last measured, and the zone the effective date is
 * computed in. Nothing about *which* answer holds generation or *when* it
 * resumes is decided here — `generationHold` owns both, and a site with
 * nothing measured yet has nothing pending (ADR-030's own rule, and the
 * reason a site between setup and its first pass is not held).
 */
async function marketHold(
  siteId: string,
  now: Date
): Promise<{ because: "domain" | "category"; resumesOn: Date } | null> {
  const [declared, measured, timezone] = await Promise.all([
    declaredAnswers(siteId),
    measuredAnswers(siteId),
    declaredTimezone(siteId),
  ]);
  if (timezone === null) return null;
  const hold = generationHold(pendingChanges({ declared, measured, now, timezone }));
  return hold.held ? { because: hold.because, resumesOn: hold.resumesOn } : null;
}

/**
 * Everything the calendar reads, for one real site and one month.
 *
 * `unusedSupply` is read once and is the number ADR-061 point 1 turns on:
 * a count that came back is a proven claim about supply, and a read that
 * could not answer is `null` — never a 0, which would tell a customer
 * their market is empty on a day the database merely broke.
 */
export async function readCalendarFacts(a: {
  site: CalendarSite;
  month: MonthKey;
  now: Date;
}): Promise<CalendarFacts> {
  const today = dayKeyOf(a.now, a.site.timeZone);
  const [depth, head, ranked, publishing, stop, changeHold] = await Promise.all([
    supplyDepth(a.site.siteId).then(
      (d) => d.unused,
      () => null
    ),
    nextForDay(a.site.siteId),
    rankOpen(a.site.siteId),
    // §9's own answers about this month (#175).
    readPublishingFacts({ siteId: a.site.siteId, month: a.month, today }),
    // §11's stop, read where the shell reads it and not a second time
    // (#113). A read that throws is not a claim that nothing stopped: the
    // day's own account falls to `unattributed`, which is the same stop
    // said without a record behind it (ADR-061 point 2).
    readStop(a.site.siteId).catch(() => null),
    // REQ-071 c11's hold (#204). A read that could not answer is not a site
    // replacing nothing — but it is also not a licence to hold every date
    // on a guess, and the day's account falls through to the arms below,
    // which are read from their own rows. `generationHold` picks the one
    // reason; nothing here picks between two.
    marketHold(a.site.siteId, a.now).catch(() => null),
  ]);

  // The head is the first fillable date's page; the rest of the list, in
  // its own order, is the dates after it. One list, one order, and no
  // second ranking — `nextForDay` is this list's head, loaded.
  const queue = head === null ? [] : [head.id, ...ranked.slice(1).map((r) => r.opportunityId)];
  const dates = fillableDates({ month: a.month, today });
  const offset = offsetForMonth({ month: a.month, today });

  const drafts: DraftOnDay[] = [];

  // 1 — the pages §9 has actually put on dates. They come first and they
  //     win: a date that carries a draft is not a date supply may plan on,
  //     and drawing both would be the two-pages-on-one-date defect
  //     `month.ts` raises.
  for (const page of publishing.pagesByDay.values()) {
    const choice = await explainChoice(page.opportunityId);
    if (choice === null) continue;
    drafts.push(
      pageOn({
        page,
        choice,
        publishAt: publishing.publishAt.get(page.draftId) ?? null,
        now: a.now,
      })
    );
  }

  // 2 — the dates left, filled from supply in its own order. A date §9 has
  //     already spoken for is skipped without consuming a page from the
  //     queue: the page supply chose for it is the page that is on it.
  //
  //     Nothing is planned at all where §9's facts could not be read: a
  //     month drawn as planned dates over pages that may be in review or
  //     already live is worse than a month that says something of ours
  //     failed, which is what every date then resolves to
  //     (`drafts-read.ts`'s own note, and ADR-061 point 2).
  for (const [index, day] of publishing.readable ? dates.entries() : []) {
    const opportunityId = queue[offset + index];
    if (opportunityId === undefined) break; // supply ran out; the rest stay empty
    if (publishing.pagesByDay.has(day)) continue;
    const choice = await explainChoice(opportunityId);
    if (choice === null) continue;
    drafts.push(plannedOn(day, choice, a.now));
  }

  return {
    timeZone: a.site.timeZone,
    now: a.now,
    stop,
    drafts,
    // REQ-047 c5's dated instruction and §11's stopped-work record are
    // still other subsystems' rows (#42, #39). Empty here is what is true
    // of them: neither is read, so neither is claimed.
    instructions: {},
    stoppedDays: [],
    // §9's, read (#175).
    heldDays: publishing.heldDays,
    customerChangeHoldsPages: publishing.customerChangeHoldsPages,
    changeHoldsGeneration: changeHold,
    // A month whose §9 facts are unreadable states no supply either: the
    // exhausted arm is a proven claim (ADR-061 point 1) and a depth read
    // beside pages nobody could see is not one.
    unusedSupply: publishing.readable ? depth : null,
  };
}
