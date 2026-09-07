// BUILD §4.5 — the growth module: searches you appear in, week by week.
//
// §4.5 item 2, verbatim: "**Growth chart**: searches-you-appear-in, weekly
// points, area+line in `--chart-you`, endpoint labelled, footnote pair:
// start value · 'At 400 the big category terms unlock.' Hover tooltips."
//
// Two rules this file exists to make unbreakable:
//
//   1. **A week that was not measured is a break, never a segment.** Its
//      point carries no value and the run is cut there. Joining the week
//      before to the week after would draw a measurement nobody took, and
//      carrying the previous value forward would label an old number with a
//      new week's date. Neither has a code path here: the series is a list
//      of `Measured<number>`, and the `unmeasured` arm has no `value` field
//      to interpolate from.
//   3. **A date the answers changed is a break too** (REQ-071 c12, issue
//      #205). The weeks either side were measured against different
//      markets, so a line across one would draw movement that nobody
//      measured. It takes the same shape rule 1 already gives an
//      unmeasured week — a column of its own that cuts the run — so §2.4's
//      inventory gains no sixth chart and this file gains no second idea
//      of what a break is.
//
//   2. **Where nothing has been measured there is no chart at all.** The
//      `none` arm carries the date the first measurement is due — the same
//      date the shell states, passed in rather than computed, so the two
//      can never disagree — and the screen renders one written line in the
//      chart's place. An axis drawn over nothing reads as a measurement of
//      zero, which is a different claim.
import type { Measured } from "@/lib/measure/measured";
import { OVERVIEW_TRAILING_WEEKS } from "@/lib/config/constants";
import type { ChangeMarker } from "@/lib/market/changes/markers";
import { withBreaks, type SeriesEntry } from "./changes";

/** One site-local week of the series. `weekStart` is the week's own Monday
 *  (`WEEK_START`), and every value carries its own `at` — the date that
 *  week was measured, never the date the screen was opened. */
export interface WeeklyPoint {
  weekStart: Date;
  value: Measured<number>;
}

export type GrowthModule =
  | {
      kind: "series";
      points: readonly WeeklyPoint[];
      /** The same window, with a break standing wherever a change fell
       *  between two of its weeks. The renderer draws this; `points` stays
       *  the weeks alone, so anything counting weeks counts weeks. */
      entries: readonly SeriesEntry<WeeklyPoint>[];
    }
  | { kind: "none"; firstDueOn: Date };

/**
 * The trailing window's points, or the arm that says none has been taken.
 *
 * The window is `OVERVIEW_TRAILING_WEEKS` — the same window the AI-answers
 * tile counts over, so the two readings on this screen can never mean
 * different weeks. A caller holding more history than the window is
 * trimmed to its last weeks rather than being drawn compressed.
 */
export function readGrowth(input: {
  points: readonly WeeklyPoint[];
  firstDueOn: Date;
  /** The dates the site's answers changed (REQ-071 c12). Absent is the
   *  ordinary case and means the same as empty: most sites never change
   *  one. */
  changes?: readonly ChangeMarker[];
}): GrowthModule {
  const window = input.points.slice(-OVERVIEW_TRAILING_WEEKS);
  const anyMeasured = window.some((p) => p.value.kind !== "unmeasured");
  if (!anyMeasured) return { kind: "none", firstDueOn: input.firstDueOn };
  return {
    kind: "series",
    points: window,
    entries: withBreaks(window, input.changes ?? [], (week) => week.weekStart),
  };
}
