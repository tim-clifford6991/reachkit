// tests/ui/layout/matrix.ts — how wide the browser sweep runs (issue #545)
//
// The default is one band × one theme per screen: 1280 light, which is the
// band and theme the approved set is drawn at and the capture CI composes
// its side-by-side from. `RK_LAYOUT_FULL=1` restores the full matrix — the
// six widths, the three bands and both themes — and is what
// `npm run test:layout:full`, the nightly run and a baseline regeneration
// set. The 2026-09-11 test-budget ruling (`docs/PROCESS.md`, Test budget)
// is the reason: the full matrix re-photographs one decision six times per
// screen on every PR, and that time buys less than the production smoke
// check it was crowding out.
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
