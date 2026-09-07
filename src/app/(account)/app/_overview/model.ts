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
import type { ChangeMarker } from "@/lib/market/changes/markers";
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
  /** The window's own length, from `OVERVIEW_TRAILING_WEEKS`. */
  readonly of: number;
}

export interface OverviewModel {
  head: { key: CopyKey; direction: HeadDirection; badgeKey?: CopyKey; weeksMeasured: number };
  growth: GrowthModule;
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
   *  break in the drawn series, which is #205's. Empty for a site whose
   *  answers have not changed, which is most of them. */
  changes: readonly ChangeMarker[];
  pagesPublished: Measured<number>;
  pagesPublishedPrevious?: Measured<number>;
  rivals: RivalFacts;
  /** Today, in the site's zone, and the seven days of its week. */
  today: Date;
  supply: SupplyFacts;
  waiting: readonly WaitingItem[];
}

export function assembleOverview(facts: OverviewFacts): OverviewModel {
  const growth = readGrowth({ points: facts.points, firstDueOn: facts.firstDueOn });
  const direction = headDirection(facts.points);
  const measuredPoints = facts.points.filter((p) => p.value.kind !== "unmeasured");
  const latest = measuredPoints.at(-1);
  const previous = measuredPoints.at(-2);
  const { alerts, overflow } = readAlerts(facts.waiting);
  const supply = readSupplyStatement(facts.supply);
  const window = aiWindow(facts.points, facts.aiPresence);

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
    },
    rivals: resolveRivals(facts.rivals),
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
function weekOf(at: Date): string {
  const midnight = Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate());
  const weekday = (new Date(midnight).getUTCDay() + 6) % 7;
  return new Date(midnight - weekday * 86_400_000).toISOString().slice(0, 10);
}

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
  presence: readonly (boolean | null)[]
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

  return { weeks: [...padding, ...inWindow], of: OVERVIEW_TRAILING_WEEKS };
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
