// SPEC §4 (2026-10-07, issue 1319; 2026-10-15, issue 1457) — "A skeleton is
// the shape of the screen that arrives, on a phone and on a desktop."
//
// The layout classes of Overview, written once, as `setup/frame.ts` writes
// setup's (issue 1484). `(tabs)/(overview)/page.tsx` draws Overview with them and
// `(tabs)/(overview)/loading.tsx` draws the wait with them, so this week's pages are the
// same box before and after Overview arrives.
//
// `REGION` names the regions the layout gate measures twice — on the first
// paint and once Overview has arrived — at 390 and 1280
// (`tests/ui/layout/skeletons.test.ts`).

import { createLoader, parseAsBoolean } from "nuqs/server";

/** The screen: its parts join the layout's column. */
export const OVERVIEW = "contents";

/** The notices and the head. */
export const HEAD = "flex min-w-0 flex-col gap-6";

/** `?all=true`: the one address a detail's *Show All* writes, read by the server and the control alike. */
export const SHOW_ALL = { all: parseAsBoolean.withDefault(false) };
export const loadShowAll = createLoader(SHOW_ALL);

/** The rows a detail's list shows before *Show All*: 8 at `lg` and up, 5 below. */
export const ROWS = { lg: 8, below: 5 } as const;

/** Row `i`'s class: every row is drawn, and until *Show All* those past `ROWS` are hidden at the width they fall past. */
export function rowClass(i: number, all: boolean): string {
  return all || i < ROWS.below ? "" : i < ROWS.lg ? "max-lg:hidden" : "hidden";
}

/** The regions the layout gate compares, by name. */
export const REGION = {
  week: "overview-week",
  tiles: "overview-tiles",
  detailTiles: "overview-detail-tiles",
} as const;
