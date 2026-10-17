// SPEC §4 (2026-10-07, issue 1319; 2026-10-15, issue 1457) — "A skeleton is
// the shape of the screen that arrives, on a phone and on a desktop."
//
// The layout classes of Overview, written once, as `setup/frame.ts` writes
// setup's (issue 1484). `(tabs)/page.tsx` and `LinkedTiles` draw Overview
// with them and `(tabs)/loading.tsx` draws the wait with them, so the four
// tiles and the week beside needs-you are the same boxes before and after
// Overview arrives.
//
// `REGION` names the regions the layout gate measures twice — on the first
// paint and once Overview has arrived — at 390 and 1280
// (`tests/ui/layout/skeletons.test.ts`).

/** The screen: the tiles, the head, then the week and needs-you. */
export const OVERVIEW = "flex min-w-0 flex-col gap-6";

/** The four headline tiles: two columns on a phone, one row from `lg`. */
export const TILES = "grid min-w-0 grid-cols-2 gap-3 lg:grid-cols-4";

/** This week beside needs-you from `xl`; the week takes the wider column. */
export const WEEK_ROW = "grid min-w-0 gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]";

/** The regions the layout gate compares, by name. */
export const REGION = {
  tiles: "overview-tiles",
  week: "overview-week",
} as const;
