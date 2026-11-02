// SPEC §4 (2026-10-07, issue 1319; 2026-10-15, issue 1457) — "A skeleton is
// the shape of the screen that arrives, on a phone and on a desktop."
//
// The layout classes of Overview, written once, as `setup/frame.ts` writes
// setup's (issue 1484). `(tabs)/page.tsx` draws Overview with them and
// `(tabs)/loading.tsx` draws the wait with them, so this week's pages are the
// same box before and after Overview arrives.
//
// `REGION` names the regions the layout gate measures twice — on the first
// paint and once Overview has arrived — at 390 and 1280
// (`tests/ui/layout/skeletons.test.ts`).

/** The screen: its parts join the tabs' column, so the head can sit above the tabs as the board draws it. */
export const OVERVIEW = "contents";

/** The notices and the head, drawn above the tabs. */
export const HEAD = "-order-1 flex min-w-0 flex-col gap-6";

/** Best mover beside the measures checked monthly, from `lg`. */
export const FIGURES = "grid min-w-0 gap-6 lg:grid-cols-2";

/** The regions the layout gate compares, by name. */
export const REGION = {
  week: "overview-week",
  figures: "overview-figures",
} as const;
