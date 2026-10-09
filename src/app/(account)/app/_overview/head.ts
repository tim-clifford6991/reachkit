// BUILD §4.5 — the direction the stored series shows.
//
// It was what chose the Overview's head line until the head came to state
// what autopilot is doing (owner 2026-10-09, issue 1362; `autopilot.ts`).
// The direction is still a fact of the model, read from the measured weeks
// and never written into a screen.
import type { WeeklyPoint } from "./growth";

export type HeadDirection = "rising" | "flat" | "falling" | "no_data" | "week_zero";

/**
 * The direction the stored series shows, over the measured weeks only.
 *
 * Fewer than two measured weeks is `no_data`, not `flat`: one point is not
 * a direction, and calling it flat would state that nothing has moved when
 * nothing has been compared. An unmeasured week is skipped rather than read
 * as a zero — a week nobody measured did not fall.
 */
export function headDirection(points: readonly WeeklyPoint[]): HeadDirection {
  const values: number[] = [];
  for (const point of points) {
    if (point.value.kind !== "unmeasured") values.push(point.value.value);
  }
  const first = values.at(0);
  const last = values.at(-1);
  if (values.length < 2 || first === undefined || last === undefined) return "no_data";
  if (last > first) return "rising";
  if (last < first) return "falling";
  return "flat";
}
