// BUILD §4.5 — the head line, chosen by the measurement rather than fixed.
//
// §4.5 item 1, verbatim: "Head: 'The gap is closing.' + `▲ every week since
// you started` badge — **the four words are backed by the chart directly
// under them**."
//
// The emphasis is the whole design of this file. A head sentence written
// into the screen is backed by nothing: it reads the same over a series
// that fell, over a series that never moved, and over a customer whose
// first measurement has not run. So the sentence is not written here at all
// — the direction the stored series actually shows selects which of four
// owner-written lines the screen states, and a customer whose gap widened
// can never read the gap-closing line, because the key that carries it is
// not the key their direction selects.
//
// The badge is `rising`'s alone, for the same reason: "every week since you
// started" is a claim about every measured week, and the screen has no
// business making it over a week that fell.
import type { CopyKey } from "@/lib/presentation/copy";
import type { WeeklyPoint } from "./growth";

export type HeadDirection = "rising" | "flat" | "falling" | "no_data" | "week_zero";

export const OVERVIEW_HEAD: Readonly<Record<HeadDirection, CopyKey>> = Object.freeze({
  rising: "overview.head.rising",
  flat: "overview.head.flat",
  falling: "overview.head.falling",
  // The line the screen already stated inside the shell before it had
  // content of its own: with nothing measured there is no direction, and
  // this is the one head there has ever been for that state.
  no_data: "overview.head",
  // UI-SPEC S13. Not a direction either — one reading is not a direction —
  // but a different state from `no_data`: the deep pass *has* measured, and
  // the first page it produced is the thing to say. `headDirection` cannot
  // choose it, because the fact that separates the two is whether the first
  // weekly pass is still due, which is not in the points; `assembleOverview`
  // selects it (see `weekZeroOf`).
  week_zero: "overview.head.week-zero",
});

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
