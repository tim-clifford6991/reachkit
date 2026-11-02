// SPEC §5 (2026-10-07, #1327) — "A skeleton is the shape of the screen that
// arrives, on a phone and on a desktop."
//
// The layout classes of setup's page frame, written once. `SetupForm` draws
// the step with them and `SetupSkeleton` draws the wait with them, so the
// regions — the header with the step bar, the question, and the bar at the
// foot — are the same boxes before and after the step arrives.
import type { Arm, Band } from "@/ui/layout";

/** The screen root's arms: one reading column at every width, as boards Setup1, Setup2 and Setup draw it. */
export const SETUP_ARMS: Record<Band, Arm> = {
  compact: { kind: "columns", count: 1 },
  medium: { kind: "same-as-below" },
  wide: { kind: "same-as-below" },
};

/** At least the viewport tall: the header, the step, and the bar as the last row. */
export const FRAME = "grid min-h-svh grid-rows-[auto_1fr_auto]";

/** The white band at the top, edge to edge, with one hairline under it. */
export const HEADER = "border-b border-base-300 bg-base-100";

/** The header's measure: the brand, the step bar and the pass's status line. */
export const HEADER_INNER = "mx-auto grid w-full max-w-[calc(var(--w-read)+2rem)] min-w-0 gap-3 px-4 pt-4 pb-3";

/** The brand's row: a 44px target, as the boards draw it. */
export const BRAND_ROW = "flex min-h-11 items-center";

/** The three equal columns of the step bar. */
export const STEPS = "grid grid-cols-3 gap-2";

/** One step: its bar above its one-word label. */
export const STEP = "grid min-w-0 justify-items-center gap-2";

/** Everything between the header and the bar. The bar is sticky, so it stays in the flow and needs no clearance. */
export const BODY = "grid min-w-0 grid-cols-1 content-start gap-6 pt-1 pb-2";

/** The question, its line and its control. */
export const QUESTION = "grid min-w-0 grid-cols-1 content-start gap-6";

/** The question's heading and the line under it. */
export const QUESTION_HEAD = "grid gap-2";

/** The bar at the foot, edge to edge, pinned to the bottom of the viewport. */
export const BAR = "sticky bottom-0 z-10 border-t border-base-300 bg-base-100";

/** Back on the left, the step's action on the right, on the header's measure. */
export const BAR_INNER = "mx-auto flex w-full max-w-[calc(var(--w-read)+2rem)] min-w-0 items-center justify-between gap-3 px-4 py-3";

/** The step's one primary: 44px tall and at least as wide as the board draws it. */
export const PRIMARY = "btn btn-primary h-11 min-w-38 text-(length:--t-body)";

/** The quiet ink of a line that explains. */
export const QUIET = "text-(length:--t-sm) text-base-content/70";

/** The regions the layout gate measures twice — on the first paint and
 *  once the step has arrived — at 390 and 1280 (issue 1484,
 *  `tests/ui/layout/skeletons.test.ts`). */
export const REGION = {
  steps: "setup-steps",
  columns: "setup-columns",
  bar: "setup-bar",
} as const;
