// BUILD §9 — "A regression is shown, never hidden."
//
// REQ-063 c3, in full: "given a page whose measurement for its target
// search is worse this week than at the previous re-measurement … that
// decline is shown beside its verdict rather than hidden, rounded away or
// replaced by the better earlier figure."
//
// So nothing here rounds, averages, clamps or substitutes. Both raw
// `Measured<number>` values are carried through to the stored row and read
// back as they were written; `declined` is computed once, here, and never
// re-derived on a render path where a formatter could smooth it.
//
// c4 adds the interval: "where the measurement it is compared against is
// not the previous week's, the interval that change spans". `spansWeeks`
// is that number, 1 in the ordinary case.
import type { Measured } from "@/lib/measure/measured";
import type { Movement, WeekStart } from "./types";

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

function startOfWeek(week: WeekStart): number {
  const at = Date.parse(`${week}T00:00:00Z`);
  if (Number.isNaN(at)) {
    throw new Error(`verdicts: "${week}" is not a week start this module can read.`);
  }
  return at;
}

/**
 * How many weeks the change spans. Rounded to the nearest week rather than
 * divided exactly: both dates are site-local Mondays, and a daylight-saving
 * transition inside the interval makes it 6 days 23 hours rather than 7 —
 * an interval that must still read as one week.
 */
export function weeksBetween(previous: WeekStart, current: WeekStart): number {
  return Math.round((startOfWeek(current) - startOfWeek(previous)) / MS_PER_WEEK);
}

/**
 * Is `to` a worse place than `from`?
 *
 * A search position is better the smaller it is, and holding no place at
 * all (`zero` — measured, and the customer is absent) is worse than
 * holding any place. An `unmeasured` value on either side is not a
 * comparison at all: nothing declined, because nothing was measured to
 * decline. The parameter, chosen once and recorded here (rule 1.1);
 * reversing it is this function and its fixtures.
 */
function isWorse(from: Measured<number>, to: Measured<number>): boolean {
  if (from.kind === "unmeasured" || to.kind === "unmeasured") return false;
  if (from.kind === "zero") return false;
  if (to.kind === "zero") return true;
  return to.value > from.value;
}

/**
 * The movement between the previous **recorded** measurement and this
 * week's, or `null` where there is no previous one to compare against.
 *
 * "Recorded" and not "last week's": the comparison is against the figure
 * the last verdict was actually taken at, which is what makes a gap in the
 * series visible as `spansWeeks` rather than silently closed.
 */
export function movementFor(a: {
  previous: { week: WeekStart; value: Measured<number> } | null;
  current: Measured<number>;
  week: WeekStart;
}): Movement | null {
  if (a.previous === null) return null;
  return {
    previousWeek: a.previous.week,
    spansWeeks: weeksBetween(a.previous.week, a.week),
    from: a.previous.value,
    to: a.current,
    declined: isWorse(a.previous.value, a.current),
  };
}
