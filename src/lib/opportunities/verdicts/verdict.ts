// BUILD §9, §4.5 — the too-early rule: evaluate first, age second.
//
// §4.5's own words for the count Overview shows: "rest under 3 weeks — too
// early to judge". REQ-063 c2 fixes the order the two halves are asked in:
// "it is marked as working if it already passes its recorded test, and
// otherwise as too early to judge rather than as not working."
//
// **The order is the whole of this file.** Aging first — asking "is it
// three weeks old?" before "does it pass?" — reports a page that is
// demonstrably working as too early to judge, which is the opposite of the
// promise and reads, in a review, as the more natural spelling of "too
// early". `verdict.test.ts`'s young-and-passing case is what fails when
// somebody writes it that way.
//
// `TOO_EARLY_WEEKS` is `constants.ts`'s pin (3, REQ-063 c2); no number is
// written here.
import { TOO_EARLY_WEEKS } from "@/lib/config/constants";
import type { Verdict, WeekStart } from "./types";

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

/**
 * How many whole weeks of the site's own calendar separate the Monday this
 * verdict belongs to from the day the page went live.
 *
 * Measured to the week's own Monday rather than to "now", so a verdict is
 * a fact about the week it was taken in and re-reading it later cannot age
 * a page into a different answer. The week is a site-local calendar date
 * and `publishedAt` an instant; the comparison is made at the week's start
 * of day in UTC, which is within a day either way of the site's own
 * midnight — and a day cannot move a three-week boundary that is only ever
 * crossed at a Monday.
 */
export function weeksSincePublished(a: { publishedAt: Date; week: WeekStart }): number {
  const weekStartedAt = Date.parse(`${a.week}T00:00:00Z`);
  if (Number.isNaN(weekStartedAt)) {
    throw new Error(`verdicts: "${a.week}" is not a week start this module can read.`);
  }
  return Math.floor((weekStartedAt - a.publishedAt.getTime()) / MS_PER_WEEK);
}

/**
 * REQ-063 c2's two questions, in the one order that keeps the promise.
 *
 * A page that passes its recorded test is working, whatever its age. A
 * page that does not is `too_early` while it is younger than
 * `TOO_EARLY_WEEKS`, and `not_working` only once it is old enough for that
 * to be a statement about the page rather than about the calendar.
 */
export function verdictFor(a: {
  passes: boolean;
  publishedAt: Date;
  week: WeekStart;
}): Verdict {
  if (a.passes) return "working";
  return weeksSincePublished(a) < TOO_EARLY_WEEKS ? "too_early" : "not_working";
}
