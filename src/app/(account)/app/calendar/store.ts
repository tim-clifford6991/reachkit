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
// **Two engine calls and no third.** `committedWeek` is the week the
// weekly pass committed: each row lands on the date it was committed for,
// and its spares are listed under the week. Plan never ranks (SPEC §7, E5).
// `explainChoice` fills the day panel's "Why
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
  committedWeek,
  explainChoice,
  supplyDepth,
  supplyMeasured,
  type Choice,
} from "@/lib/opportunities";
import { writtenLine } from "../_shell/written";
import { whySentenceOf } from "./card-lines";
import { pageTargetOf } from "../_shell/page-target";
import { dayKeyOf, daysOfMonth, planHorizonEnd, type DayKey, type MonthKey } from "./dates";
import {
  declaredAnswers,
  declaredTimezone,
  generationHold,
  measuredAnswers,
  pendingChanges,
} from "@/lib/market/changes";
import { readStop } from "../_shell/stop";
import { plannedByDay } from "@/lib/opportunities/days";
import { readPublishingFacts, type ScheduledPage } from "./drafts-read";
import { weekStartFor } from "@/lib/scan/weekly/week";
import type { PageStanding } from "./day-number";
import type { BestRival } from "./target";
import type { CalendarFacts, DraftOnDay, WhyThisPage } from "./month";

/** The site one calendar belongs to. Which site that is, is
 *  `currentSession()`'s (issue #35) — `provider.ts` names the gap. */
export interface CalendarSite {
  siteId: string;
  /** REQ-073 c1's stated zone. Every date on this screen is site-local. */
  timeZone: string;
  /** When the account signed up, which Plan counts its weeks of service from. */
  createdAt?: Date;
}

// ── The "Why this page" rows, from the evidence stored at creation ───────

/** §7's `Best rival`: who holds the answer today, and where they stand
 *  (issue 930). A Write target records both; an Earn target records the
 *  rival a source named and no place for it, which is `unmeasured` rather
 *  than a `#0`; an Improve target is the customer's own page, so nobody
 *  else holds it and there is no rival at all. */
function bestRival(choice: Choice, at: Date): BestRival | null {
  const evidence = choice.evidence;
  if (evidence.family === "write") {
    return { domain: evidence.rival.domain, position: evidence.rival.position };
  }
  if (evidence.family === "earn") {
    return { domain: evidence.rival.domain, position: unmeasured<number>("undeterminable", at) };
  }
  return null;
}

/** Whether a page is an update of one the site already has, rather than a
 *  new one (SPEC §7, 2026-09-20). The opportunity's own family, read: an
 *  Improve or a Fix rewrites a page that exists; a Write or an Earn adds
 *  one. Total over the four, so a fifth family is a decision here. */
function isUpdate(choice: Choice): boolean {
  const family = choice.evidence.family;
  return family === "improve" || family === "fix";
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
export function askedAs(choice: Choice, search: string): string {
  return choice.acceptance.form === "named_on" ? choice.acceptance.question : templateQuestion(search);
}

/** §4.6's `done-when`: the acceptance test recorded at creation, in the
 *  owner's words. Owner-owed, so it renders as nothing until written —
 *  never as a placeholder and never as a sentence this file composes.
 *  `gate_cleared` is unreachable on the calendar: the Fix family is excluded
 *  from the ranked list by the store, once, and is never a page on a date.
 *  It is reachable from the draft screen, which reads any draft's own
 *  opportunity (issue 867), and the arm answers it.
 *
 *  Exported for that screen: both this and `askedAs` word a fact the draft
 *  screen states too, and one wording of one fact is the rule this whole
 *  projection follows. */
export function doneWhen(choice: Choice): string {
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
  // The rows the draft screen states too, from the one projection (issue
  // 867). A Fix choice has no target at all — the ranked list excludes the
  // family, so this is the defensive arm and not a state a panel draws.
  const target = pageTargetOf({ choice, askedAs: askedAs(choice, search), doneWhen: doneWhen(choice), at });
  return {
    ...(target ?? {
      search,
      askedAs: askedAs(choice, search),
      volume: unmeasured<number>("undeterminable", at),
      difficulty: unmeasured<number>("undeterminable", at),
      ceiling: null,
      // Non-null for everything the ranked list can hold: `fit_band` is null
      // for exactly the Fix family, which the list excludes.
      winnability: choice.fitBand ?? "not-yet",
      engines: [],
      doneWhen: doneWhen(choice),
    }),
    bestRival: bestRival(choice, at),
    youStand: youStand(choice, at),
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
  /** Where the site stands for this page's search this week, as §9's
   *  weekly judgement recorded it — or `null` where this week measured
   *  none (issue 930). Read once for the site and handed in. */
  standing: PageStanding | null;
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
    verification: a.page.verification,
    unpublishOutcome: a.page.unpublishOutcome,
    // Issue 880: why the page needs them, as §9's record derived it.
    needsYou: a.page.needsYou,
    // Issue 930: this week's place, read and never re-measured.
    standing: a.standing,
    update: isUpdate(a.choice),
    whyLine: whySentenceOf(a.choice.planReason),
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
    // Nothing has been delivered for a planned date, so no check will run
    // and there is no unpublish call to have found anything.
    verification: { kind: "never", because: "no_live_address" },
    unpublishOutcome: null,
    // A planned date has no draft, so nothing is wanted of the founder
    // for it (issue 880).
    needsYou: null,
    // Nothing is published for a planned date, so there is no place to
    // stand in (issue 930): its card carries the demand it was planned
    // against, which is `day-number.ts`'s `volume` arm.
    standing: null,
    update: isUpdate(choice),
    whyLine: whySentenceOf(choice.planReason),
  };
}

// ── The month ───────────────────────────────────────────────────────────

/**
 * The dates this month that supply may fill, in order.
 *
 * At most one page a day, and only where one is ready (`calendar.head`,
 * owner 2026-09-11) — so every site-local date from today forward,
 * weekends included, is a date supply *may* fill. Dates already past are not filled: supply
 * that was never used on them was never scheduled for them, and a calendar
 * that back-filled yesterday would be claiming work nobody did.
 *
 * And no later than the plan horizon, six days after today (issue 1455).
 */
export function fillableDates(a: { month: MonthKey; today: DayKey }): readonly DayKey[] {
  const last = planHorizonEnd(a.today);
  return daysOfMonth(a.month).filter((day) => day >= a.today && day <= last);
}

/**
 * Where the site stands **this week** for each page it has live, by the
 * address that page is served at (issue 930).
 *
 * §9's own weekly judgement, read (`readWeek` → `weeklyDigest`): the verdict
 * row carries the measurement it was taken from and the movement against
 * the previous one, both written by `judgeWeek` on Monday. Nothing here
 * re-measures a place, re-computes a change or falls back to an earlier
 * week — REQ-063 c5 forbids the last of those in terms, and the card's own
 * `first-measure` arm is what a week with no measurement looks like.
 *
 * **Keyed by the live address**, which both sides — the digest's and
 * `scheduledPagesFor`'s — compose the same way, so the join is the
 * publication's own identity rather than a title or a search that two rows
 * could share. Since issue 896 that address is the one the page answers at
 * **now**, on both sides and for the same reason: a hosted page follows
 * its site's host (SPEC §7, 2026-09-18), and a side that re-addressed
 * alone would empty this join instead of mending it.
 *
 * A standing that is not an ordinary verdict contributes nothing: a page
 * `not_judgeable`, one this week did not reach, and a week that was never
 * measured are all "no place this week", which is the honest reading of
 * each of them and the one the card already has a word for.
 *
 * Lazily imported, for the reason `_overview/store.ts` gives at its own
 * `readWeek` call: a static import of a `@/lib/db`-reaching module from a
 * module the job suites load hangs them.
 */
async function readStandings(a: {
  siteId: string;
  now: Date;
  timeZone: string;
  /** The addresses this month's live pages are served at. **Empty means no
   *  read at all**: a month with nothing live has no place to state, and
   *  §9's judgement is read for a question this month is asking rather
   *  than on every render. */
  liveUrls: readonly string[];
}): Promise<ReadonlyMap<string, PageStanding>> {
  const byUrl = new Map<string, PageStanding>();
  if (a.liveUrls.length === 0) return byUrl;
  const wanted = new Set(a.liveUrls);
  try {
    const { weeklyDigest } = await import("@/lib/opportunities");
    const week = weekStartFor({ at: a.now, zone: a.timeZone });
    const { standings } = await weeklyDigest({ siteId: a.siteId, week });
    for (const page of standings) {
      if (page.liveUrl === null || !wanted.has(page.liveUrl)) continue;
      const standing = page.standing;
      if (standing.kind !== "verdict") continue;
      const movement = standing.movement;
      // The place itself is the movement's `to`: it is the very figure the
      // verdict was decided from, written down at judgement. A page judged
      // with no movement at all was judged on its first measurement, and
      // has a place and no change; a page whose `to` could not be measured
      // has no place to state, which is the card's `first-measure` arm.
      if (movement === null) continue;
      const to = movement.to;
      if (to.kind === "unmeasured") continue;
      const from = movement.from;
      byUrl.set(page.liveUrl, {
        position: to.value,
        previous: from.kind === "unmeasured" ? null : from.value,
      });
    }
  } catch (error) {
    // A standing nobody could read is not a page with no place: every live
    // card then draws the day its place is first measured, which is what a
    // founder would be told by a week that has not run. Never a zero and
    // never last week's number.
    console.warn(
      JSON.stringify({ event: "calendar_standings_unreadable", siteId: a.siteId, detail: String(error) })
    );
  }
  return byUrl;
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
  const [depth, week, publishing, stop, changeHold] = await Promise.all([
    supplyDepth(a.site.siteId).then(
      (d) => d.unused,
      () => null
    ),
    committedWeek(a.site.siteId),
    // §9's own answers about this month (#175).
    readPublishingFacts({ siteId: a.site.siteId, month: a.month, today }),
    // §11's stop, read where the shell reads it and not a second time
    // (#113). A read that throws is not a claim that nothing stopped, and
    // not a claim that something did: the day's own account falls to
    // `unattributed`, which has its own words (issue 1321).
    readStop().catch(() => null),
    // REQ-071 c11's hold (#204). A read that could not answer is not a site
    // replacing nothing — but it is also not a licence to hold every date
    // on a guess, and the day's account falls through to the arms below,
    // which are read from their own rows. `generationHold` picks the one
    // reason; nothing here picks between two.
    marketHold(a.site.siteId, a.now).catch(() => null),
  ]);

  // Issue 930: this week's place for every live page on this month, read
  // once for the site rather than once per card — and not read at all for a
  // month with nothing live on it.
  const standings = await readStandings({
    siteId: a.site.siteId,
    now: a.now,
    timeZone: a.site.timeZone,
    liveUrls: [...publishing.pagesByDay.values()]
      .map((page) => page.liveUrl)
      .filter((url): url is string => url !== null),
  });

  // #765: a zero depth is either a market used up or one never measured,
  // and the empty day says which. Read only where the depth is a proven
  // zero — no other day can reach either supply arm — and a read that
  // throws states neither.
  const measured = depth === 0 ? await supplyMeasured(a.site.siteId).catch(() => null) : null;

  // Each committed row on the date it was committed for; a date no commit
  // covers stays empty and says why (issue 1559).
  const dates = fillableDates({ month: a.month, today });

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
        standing: page.liveUrl === null ? null : (standings.get(page.liveUrl) ?? null),
        now: a.now,
      })
    );
  }

  // 2 — the dates left, each with the row committed for it. A date §9 has
  //     already spoken for keeps its page.
  //
  //     Nothing is planned at all where §9's facts could not be read: a
  //     month drawn as planned dates over pages that may be in review or
  //     already live is worse than a month that says something of ours
  //     failed, which is what every date then resolves to
  //     (`drafts-read.ts`'s own note, and ADR-061 point 2).
  for (const [day, opportunityId] of plannedByDay(week.days, publishing.pagesByDay, publishing.readable ? dates : [])) {
    const choice = await explainChoice(opportunityId);
    if (choice === null) continue;
    drafts.push(plannedOn(day, choice, a.now));
  }

  return {
    timeZone: a.site.timeZone,
    now: a.now,
    stop,
    drafts,
    // The search each spare targets, as a planned date's title is (ADR-012).
    spares: week.spares.flatMap((spare) => (spare.targetQuery === null ? [] : [spare.targetQuery])),
    // REQ-047 c5's dated instruction and §11's stopped-work record are
    // still other subsystems' rows (#42, #39). Empty here is what is true
    // of them: neither is read, so neither is claimed.
    instructions: {},
    stoppedDays: [],
    // §9's, read (#175).
    heldDays: publishing.heldDays,
    // §9's, read (issue 880): what the site publishes to and whether it
    // works, which decides the control a page waiting on it earns.
    destination: publishing.destination,
    customerChangeHoldsPages: publishing.customerChangeHoldsPages,
    changeHoldsGeneration: changeHold,
    // A month whose §9 facts are unreadable states no supply either: the
    // exhausted arm is a proven claim (ADR-061 point 1) and a depth read
    // beside pages nobody could see is not one.
    unusedSupply: publishing.readable ? depth : null,
    supplyMeasured: publishing.readable ? measured : null,
  };
}
