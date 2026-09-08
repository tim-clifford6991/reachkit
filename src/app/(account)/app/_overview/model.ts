// BUILD §4.5 — the whole of what Overview states, in one shape.
//
// §4.5's data rule is the spine of this file, verbatim: "max one headline
// number per module; every value carries its delta or its goal, never bare."
// Both halves are made structural rather than reviewed:
//
//   - **One headline per module.** `Module<T>` has a single `headline` slot
//     and any number of `context` values. A module cannot carry two headline
//     numbers, because there is no second field to put one in. §4.5's own
//     last clause — a value shown alongside for comparison is not a headline
//     — is the `context` slot, and nothing in it is bound by the rule.
//   - **Never bare.** `goal` is required and `delta` is optional. A headline
//     with no previous measurement to compare against still carries its
//     goal, because the type will not let it be constructed without one.
//
// `assembleOverview` is pure: facts in, model out. Reading those facts is
// `provider.ts`'s, and today it reads a fixture (this issue builds the
// screen on FIXTURE data behind the typed provider; the queries arrive with
// §11's weekly measurement (#41), §9's publishing (#45) and the rival sizing
// (#27)). Keeping the assembly pure is what lets every rule above be decided
// by a test with no database and no browser at all.
import type { BandHandle } from "@/lib/measure/bands";
import type { ChangeMarker } from "@/lib/market/changes/markers";
import { weekOf, withBreaks, type SeriesEntry } from "./changes";
import type { Measured } from "@/lib/measure/measured";
import type { CopyKey } from "@/lib/presentation/copy";
import { OVERVIEW_TRAILING_WEEKS } from "@/lib/config/constants";
import type { GoalKey } from "./goals";
import { headDirection, OVERVIEW_HEAD, type HeadDirection } from "./head";
import { readGrowth, type GrowthModule, type WeeklyPoint } from "./growth";
import { resolveRivals, type RivalFacts, type RivalGapModule } from "./rivals";
import { readAlerts, type Alert, type Overflow, type WaitingItem } from "./alerts";
import { readSupplyStatement, type SupplyFacts, type SupplyStatement } from "./supply";
import { readWeek, type WeekModule } from "./week";

/** The single number a module leads with. `goal` is a pin, not a setting —
 *  the same value for every customer — and it is required. */
export interface HeadlineNumber<T> {
  value: Measured<T>;
  goal: GoalKey;
  /** The change since the previous measurement, where one exists. */
  delta?: Measured<T>;
}

/** A value a module shows alongside its headline, for comparison or
 *  context. §4.5's rule does not bind it, and it renders bare. */
export interface ContextValue<T> {
  value: Measured<T>;
  label: CopyKey;
}

export interface Module<T> {
  headline: HeadlineNumber<T>;
  context?: readonly ContextValue<unknown>[];
}

/** The AI-answers reading, and the only one this screen shows: DECISIONS
 *  2026-09-03 — "one reading only: weeks present in the trailing window".
 *  No change from the previous week's count, and no change for any single
 *  tracked question, appears anywhere on Overview; that is why this module's
 *  headline has no `delta` and why the per-week presence flags below are the
 *  matrix's cells rather than a second series. */
export interface AiPresenceWeek {
  weekStart: Date;
  /** `true` where the customer was named in at least one tracked question's
   *  AI answer that week. `null` is a week that was not measured — never a
   *  miss, and never a zero. */
  present: boolean | null;
}

export interface AiPresenceWindow {
  /** Exactly `of` entries, oldest first: the window is fixed, so a customer
   *  measured for three weeks is shown three readings and nine weeks that
   *  were not measured, rather than a window that quietly shrank to fit. */
  readonly weeks: readonly AiPresenceWeek[];
  /** The same weeks with a break standing wherever a change fell between
   *  two of them (REQ-071 c12, issue #205). The matrix draws this; `weeks`
   *  stays the weeks alone, so the count over them counts readings and
   *  never a rule. */
  readonly entries: readonly SeriesEntry<AiPresenceWeek>[];
  /** The window's own length, from `OVERVIEW_TRAILING_WEEKS`. */
  readonly of: number;
}

/** The Discoverability Score, as the set's first tile states it: the
 *  number, the change since the previous week, and the band word it stands
 *  in. `band` is `null` wherever the score is unmeasured — a band is a
 *  reading of a score, so a screen with no score has no band to name, and
 *  the tile shows the dash with its own line instead (S13). */
export type ScoreModule = Module<number> & { band: BandHandle | null };

export interface OverviewModel {
  head: { key: CopyKey; direction: HeadDirection; badgeKey?: CopyKey; weeksMeasured: number };
  growth: GrowthModule;
  /** UI-SPEC S12's first tile (ruling 6a). Not on this screen between
   *  DECISIONS 2026-09-03 and the owner's 2026-09-08 screen set; see
   *  `goals.ts` for the supersession. */
  score: ScoreModule;
  /** The searches-you-appear-in reading. No tile of its own since #353 —
   *  the approved set gives this number the growth card, which draws the
   *  whole series rather than one headline — and it is still assembled,
   *  still carries its delta, and is still what `headDirection` and the
   *  chart's own footnotes are read from. */
  searches: Module<number>;
  aiAnswers: Module<number> & { window: AiPresenceWindow };
  pagesPublished: Module<number>;
  rivals: RivalGapModule;
  week: WeekModule;
  /** REQ-095's one statement, never two. Absent where the product has
   *  nothing to say about supply. */
  supply?: SupplyStatement;
  /** At most two (§4.5: "up to two alerts"). */
  alerts: readonly Alert[];
  overflow?: Overflow;
}

/** Everything Overview reads, before it is a model. One shape, so a fixture
 *  and a future query answer the same question. */
export interface OverviewFacts {
  /** The zone every date this screen states is expressed in — the shell's
   *  own `sites.time_zone` (REQ-073 c1), read once and passed in. */
  timeZone: string;
  /** The weekly series, oldest first, one entry per week of the trailing
   *  window that exists. */
  points: readonly WeeklyPoint[];
  /** REQ-065's own clock (#41): when the first weekly measurement is due.
   *  Read, never computed here — the shell states the same date. */
  firstDueOn: Date;
  /** Weeks in which the customer was named in at least one tracked
   *  question's AI answer, oldest first; `null` where the week was not
   *  measured. */
  aiPresence: readonly (boolean | null)[];
  /** The dates inside the window at which an answer this site is measured
   *  under changed (REQ-071 c12/c13, issue #213). Supplied here and read
   *  by two things: the week count below, which may not span one, and the
   *  break in the drawn series, which `./changes.ts` places. Empty for a
   *  site whose answers have not changed, which is most of them. */
  changes: readonly ChangeMarker[];
  /** REQ-040's weekly score and the band it falls in — the same reading
   *  the report's verdict head states (`report.verdict.scoreAndBand`), so
   *  the two surfaces can never disagree about the number or the word. */
  score: Measured<{ score: number; band: BandHandle }>;
  /** The previous week's, where one was taken. The tile's `▲ 8` is the
   *  difference of the two; with no previous reading there is no delta and
   *  the tile carries its goal instead. */
  scorePrevious?: Measured<{ score: number; band: BandHandle }>;
  pagesPublished: Measured<number>;
  pagesPublishedPrevious?: Measured<number>;
  /** How many published pages are already ranking — the set's "6 already
   *  ranking" badge. A `ContextValue`, so §4.5's never-bare rule does not
   *  bind it: it is shown alongside the headline for comparison. */
  pagesRanking: Measured<number>;
  rivals: RivalFacts;
  /** Today, in the site's zone, and the seven days of its week. */
  today: Date;
  supply: SupplyFacts;
  waiting: readonly WaitingItem[];
}

export function assembleOverview(facts: OverviewFacts): OverviewModel {
  const growth = readGrowth({
    points: facts.points,
    firstDueOn: facts.firstDueOn,
    changes: facts.changes,
  });
  const direction = headDirection(facts.points);
  const measuredPoints = facts.points.filter((p) => p.value.kind !== "unmeasured");
  const latest = measuredPoints.at(-1);
  const previous = measuredPoints.at(-2);
  const { alerts, overflow } = readAlerts(facts.waiting, facts.today);
  const supply = readSupplyStatement(facts.supply);
  const window = aiWindow(facts.points, facts.aiPresence, facts.changes);
  const scoreDelta =
    facts.scorePrevious === undefined
      ? undefined
      : deltaOf(scoreValue(facts.score), scoreValue(facts.scorePrevious));

  return {
    head: {
      key: OVERVIEW_HEAD[direction],
      direction,
      // §4.5's badge is a claim about every week since the customer
      // started, so it is emitted on `rising` and nowhere else, and only
      // over the weeks actually measured (BP-038 decision 4).
      ...(direction === "rising" ? { badgeKey: "overview.head.badge" satisfies CopyKey } : {}),
      weeksMeasured: weeksSinceChange(measuredPoints, facts.changes),
    },
    growth,
    score: {
      headline: {
        value: scoreValue(facts.score),
        goal: "score",
        ...(scoreDelta === undefined ? {} : { delta: scoreDelta }),
      },
      band: facts.score.kind === "unmeasured" ? null : facts.score.value.band,
    },
    searches: {
      headline: {
        value: latest?.value ?? { kind: "unmeasured", reason: "not_attempted", at: facts.today },
        goal: "searches_appeared_in",
        ...(latest && previous ? { delta: deltaOf(latest.value, previous.value) } : {}),
      },
    },
    aiAnswers: {
      headline: {
        // No `delta`, ever: REQ-041 c12 forbids a second reading of
        // AI-answer movement anywhere on this screen.
        value: presenceCount(window, facts.today),
        goal: "ai_answers",
      },
      window,
    },
    pagesPublished: {
      headline: {
        value: facts.pagesPublished,
        goal: "pages_published",
        ...(facts.pagesPublishedPrevious
          ? { delta: deltaOf(facts.pagesPublished, facts.pagesPublishedPrevious) }
          : {}),
      },
      // The set's "6 already ranking". A context value and not a second
      // headline: §4.5's own last clause — "a value shown alongside for
      // comparison is not a headline" — is exactly this number's standing.
      context: [{ value: facts.pagesRanking, label: "overview.tile.pages.ranking" }],
    },
    rivals: resolveRivals(facts.rivals, facts.changes),
    week: readWeek({ today: facts.today, timeZone: facts.timeZone }),
    ...(supply ? { supply } : {}),
    alerts,
    ...(overflow ? { overflow } : {}),
  };
}

/**
 * How many weeks the count on this screen may speak for.
 *
 * REQ-071 c13: a count of weeks may not span a date the answers changed —
 * the weeks either side were measured under different answers, and one
 * number over both would be a number about two different sites. So the
 * count runs from the **last** change inside the window, and where there
 * has been none it is every measured week, which is what it was before
 * there was anything to break it (issue #213).
 *
 * The comparison is on the week's own Monday: a change measured mid-week
 * belongs to the week it was measured in, and that week is the first one
 * under the new answer.
 */
function weeksSinceChange(
  measuredPoints: readonly WeeklyPoint[],
  changes: readonly ChangeMarker[]
): number {
  const last = changes.reduce<Date | null>(
    (latest, marker) => (latest === null || marker.on > latest ? marker.on : latest),
    null
  );
  if (last === null) return measuredPoints.length;
  const changed = weekOf(last);
  return measuredPoints.filter((point) => weekOf(point.weekStart) >= changed).length;
}

/** The Monday of the week a date falls in, as a calendar date.
 *
 *  Compared as a **week** and never as an instant: a marker is stamped with
 *  the measurement's own time of day and a point with its week's, so two
 *  dates inside one week would otherwise order by hours and drop the very
 *  week the change happened in — the first week under the new answer, and
 *  the one the count must start from. */

/** The change since the previous measurement. Never computed across an
 *  unmeasured arm: a difference from a number that was never taken is not a
 *  change, so the result is `unmeasured` and the headline falls back to its
 *  goal. */
function deltaOf(now: Measured<number>, before: Measured<number>): Measured<number> {
  if (now.kind === "unmeasured") return now;
  if (before.kind === "unmeasured") return { ...before, at: now.at };
  const value = now.value - before.value;
  return value === 0 ? { kind: "zero", value, at: now.at } : { kind: "measured", value, at: now.at };
}

/** The fixed window, aligned to the weekly series so both readings on this
 *  screen mean the same weeks. `aiPresence[i]` is `points[i]`'s week; the
 *  window is then padded at the front, one week at a time, to its full
 *  length — those are weeks before the customer started, which were not
 *  measured and are not misses. */
function aiWindow(
  points: readonly WeeklyPoint[],
  presence: readonly (boolean | null)[],
  changes: readonly ChangeMarker[]
): AiPresenceWindow {
  const paired = points.map(
    (point, i): AiPresenceWeek => ({ weekStart: point.weekStart, present: presence[i] ?? null })
  );
  const inWindow = paired.slice(-OVERVIEW_TRAILING_WEEKS);
  const missing = OVERVIEW_TRAILING_WEEKS - inWindow.length;
  const firstStart = inWindow[0]?.weekStart;

  const padding: AiPresenceWeek[] = [];
  for (let back = missing; back > 0; back -= 1) {
    padding.push({
      weekStart:
        firstStart === undefined
          ? new Date(0)
          : new Date(firstStart.getTime() - back * MS_PER_WEEK),
      present: null,
    });
  }

  const weeks = [...padding, ...inWindow];
  return {
    weeks,
    entries: withBreaks(weeks, changes, (week) => week.weekStart),
    of: OVERVIEW_TRAILING_WEEKS,
  };
}

const MS_PER_WEEK = 7 * 86_400_000;

/** How many weeks of the window the customer was present in. A week that
 *  was not measured counts as neither present nor absent — it is skipped,
 *  and the window's own length says how many weeks the count is out of. */
function presenceCount(window: AiPresenceWindow, at: Date): Measured<number> {
  const measured = window.weeks.filter((w) => w.present !== null);
  if (measured.length === 0) return { kind: "unmeasured", reason: "not_attempted", at };
  const present = measured.filter((w) => w.present === true).length;
  return present === 0 ? { kind: "zero", value: 0, at } : { kind: "measured", value: present, at };
}

/** The score alone, out of the reading that carries its band. The band
 *  travels on the module rather than in the number, because the tile shows
 *  them in two places — the value and the badge beside it — and a delta is
 *  a difference of scores, never of bands. */
function scoreValue(m: Measured<{ score: number; band: BandHandle }>): Measured<number> {
  return m.kind === "unmeasured" ? m : { ...m, value: m.value.score };
}
