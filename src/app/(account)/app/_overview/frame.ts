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

/** The screen: one column, in the board's order. */
export const OVERVIEW = "flex min-w-0 flex-col gap-6";

/** The regions the layout gate compares, by name. */
export const REGION = {
  week: "overview-week",
} as const;
