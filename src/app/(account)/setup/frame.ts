// SPEC §5 (2026-10-07, #1327) — "A skeleton is the shape of the screen that
// arrives, on a phone and on a desktop."
//
// The layout classes of setup's page frame, written once. `SetupForm` draws
// the step with them and `SetupSkeleton` draws the wait with them, so the
// regions — the step indicator, the question, the panel beside or under it,
// and the bar at the foot — are the same boxes before and after the step
// arrives. Why each rule is what it is stays where it is used, in
// `SetupForm.tsx` and `SetupPanel.tsx`.
import type { Arm, Band } from "@/ui/layout";

/** The screen root's arms: one column, two from the medium band. */
export const SETUP_ARMS: Record<Band, Arm> = {
  compact: { kind: "columns", count: 1 },
  medium: { kind: "columns", count: 2 },
  wide: { kind: "same-as-below" },
};

/** At least the viewport tall, with the bar as the last row. */
export const FRAME = "grid min-h-svh grid-rows-[1fr_auto]";

/** Everything above the bar. `pb-28` clears the pinned bar. */
export const BODY = "grid min-w-0 grid-cols-1 content-start gap-6 p-4 pb-28";

/** The five equal columns of the step indicator. */
export const STEPS = "steps w-full text-xs";

/** The question and the panel: one column, side by side from `lg`. */
export const COLUMNS = "grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-2";

/** The question, its line and its control. */
export const QUESTION = "grid min-w-0 grid-cols-1 content-start gap-4";

/** The question's heading and the line under it. */
export const QUESTION_HEAD = "grid gap-2";

/** The panel: its title, a body that grows, and its note. */
export const PANEL = "flex min-w-0 flex-col gap-4";

/** The panel's title and body. */
export const PANEL_BODY = "flex min-w-0 grow flex-col gap-4";

/** The bar at the foot, edge to edge. */
export const BAR = "sticky bottom-0 border-t border-base-300 bg-base-100 px-8 lg:px-10 xl:px-12";

/** The bar's ruled measure. */
export const BAR_INNER = "mx-auto grid w-full max-w-(--w-wide) gap-3 py-3";

/** Back on the left, the step's action on the right. */
export const BAR_ACTIONS = "flex min-w-0 flex-wrap items-center justify-between gap-3";

/** The quiet ink of a line that explains. */
export const QUIET = "text-sm text-base-content/70";

/** The regions the layout gate measures twice — on the first paint and
 *  once the step has arrived — at 390 and 1280 (issue 1484,
 *  `tests/ui/layout/skeletons.test.ts`). */
export const REGION = {
  steps: "setup-steps",
  columns: "setup-columns",
  bar: "setup-bar",
} as const;
