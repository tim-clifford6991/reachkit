// BUILD §9 — a page's label, read from its own stored reading alone
// (owner, 2026-10-19, B1 · M-a): working at place 20 or better this week, or
// at a best under the window old (a week the search went unread), or linked by
// AI; climbing on a gain of `CLIMB_PLACES` inside the window; not moving
// once its best place is a window old with no AI link; too early otherwise.
import { CLIMB_PLACES, TOO_EARLY_WEEKS } from "@/lib/config/constants";
import { TRACKED_DEPTH, type PageReading } from "@/lib/measure/page-reading";
import type { Label, Verdict } from "./types";

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

/** Climbing is working by gain; the four labels store as three verdicts. */
export const VERDICT_OF: Readonly<Record<Label, Verdict>> = Object.freeze({
  working: "working",
  climbing: "working",
  too_early: "too_early",
  not_moving: "not_working",
});

/** Pure. Weeks are rounded, so a pass that runs minutes later on a Monday
 *  does not move a page across the window. */
export function verdict(reading: PageReading, now: Date): Label {
  const { best, first } = reading;
  if ((reading.place !== null && reading.place.value <= TRACKED_DEPTH) || (reading.linkedBy ?? []).length > 0) return "working";
  if (best === null) return "too_early";
  const weeksSinceBest = Math.round((now.getTime() - Date.parse(best.at)) / MS_PER_WEEK);
  if (weeksSinceBest >= TOO_EARLY_WEEKS) return "not_moving";
  if (best.place <= TRACKED_DEPTH) return "working";
  return first !== null && first.place - best.place >= CLIMB_PLACES ? "climbing" : "too_early";
}
