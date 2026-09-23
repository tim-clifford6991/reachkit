// tests/ui/layout/matrix.ts — how wide the browser sweep runs (issue #545)
//
// The default is one band × one theme per screen: 1280 light, which is the
// band and theme the approved set is drawn at. `RK_LAYOUT_FULL=1` restores
// the full matrix — the six widths, the three bands and both themes — and
// is what `npm run test:layout:full` sets. The 2026-09-11 test-budget
// ruling (`docs/PROCESS.md`, Test budget) is the reason: the full matrix
// re-checks one decision six times per screen on every PR, and that time
// buys less than the production smoke check it was crowding out. The sweep
// this widens is a merge gate now (2026-09-21, #976), which is one more
// reason the default stays one band.
//
// **Nothing runs it on a schedule** (2026-09-23, #1029). The nightly
// `Layout (full matrix)` job that used to is retired: it had been red for
// a week and nobody read it, and 84 of the 91 cases it last failed were
// this file's own suites measured against `checks.ts`'s pre-ruling
// allow-lists, which the gate excuses by name at the width it runs them
// at. The five that were real are #1040 and #1041. So the widths below
// 1280 are walked by hand now, on the box, and the answer is read the same
// day — `docs/PROCESS.md`, Gates.
import { BAND_MIN } from "@/ui/layout/bands";
import { widths } from "./widths";

export type LayoutTheme = "light" | "dark";

/** Whether this run sweeps the full matrix rather than the default one. */
export const FULL_MATRIX = process.env.RK_LAYOUT_FULL === "1";

/** The bands a visual sweep photographs: all three under the full matrix,
 *  otherwise the one the approved set and the CI capture are drawn at. */
export function bands(): readonly [number, ...number[]] {
  return FULL_MATRIX ? [BAND_MIN.compact, BAND_MIN.medium, BAND_MIN.wide] : [BAND_MIN.wide];
}

/** The themes a visual sweep photographs. Light is the complete arm of the
 *  approved set, so it is the one the default keeps. */
export function themes(): readonly [LayoutTheme, ...LayoutTheme[]] {
  return FULL_MATRIX ? ["light", "dark"] : ["light"];
}

/** The widths a property sweep renders each route at. `widths()` itself
 *  stays the full six — it is what the full matrix means — and this is what
 *  a per-PR run walks. */
export function sweepWidths(): readonly [number, ...number[]] {
  return FULL_MATRIX ? widths() : [BAND_MIN.wide];
}
