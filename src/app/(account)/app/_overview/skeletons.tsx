// SPEC §4 (2026-10-07, issue 1324) — Search, AI answers and Rivals, while
// their reads are in flight: "a skeleton is the shape of the screen that
// arrives, on a phone and on a desktop."
//
// Each shape below is built from the classes of the part it stands for —
// the tile row's own grid, the table's card, the stacked row below `sm` and
// the table row from it — so the same media queries choose the same shape
// here that they choose when the data lands. A route's `loading.tsx` and
// the `Suspense` inside its page draw the same function, which is how the
// two stay one shape.
//
// Boxes only (`_shell/skeletons.tsx`): no words, `aria-hidden`, and each
// region announces the wait once.
import type React from "react";
import { Box, Waiting } from "../_shell/skeletons";

/** The date in a tab's head. */
export function MeasuredSkeleton(): React.JSX.Element {
  return <Box className="h-4 w-36" />;
}

/** A row of number tiles, in the arriving row's own grid: the name, then
 *  the figure's row at the height `SearchTiles` holds
 *  (`TILE_FIGURE`). `name` is the name's own height where it is not one
 *  line: four tiles across leave Search's names two. */
export function NumberTilesSkeleton(p: {
  count: number;
  grid: string;
  name?: string;
}): React.JSX.Element {
  return (
    <Waiting className={`grid min-w-0 gap-4 ${p.grid}`} testId="tiles-skeleton">
      {Array.from({ length: p.count }, (_, at) => (
        <div key={at} className="card card-border bg-base-100 min-w-0">
          <div className="flex min-w-0 flex-col gap-2 p-4">
            <Box className={`w-36 max-w-full ${p.name ?? "h-4"}`} />
            <Box className="h-9.5 w-24" />
          </div>
        </div>
      ))}
    </Waiting>
  );
}

/** A filtered table in its card — the Search table and the Rivals table:
 *  an optional title, the chips, the rows in both of their shapes, and the
 *  foot. `row` is one row's height: a block below `sm`, a table row under
 *  a row of heads from it, and a shorter one where the columns have room. */
export function FilteredTableSkeleton(p: {
  testId: string;
  title: boolean;
  /** The line the Search table states under its chips. */
  note: boolean;
  chips: readonly string[];
  rows: number;
  row: string;
}): React.JSX.Element {
  return (
    <Waiting className="card card-border bg-base-100 min-w-0 overflow-hidden" testId={p.testId}>
      <div className="flex min-w-0 flex-col gap-3 p-4">
        {p.title ? <Box className="h-6 w-72 max-w-full" /> : null}
        <div className="flex min-w-0 flex-wrap">
          {p.chips.map((width, at) => (
            <Box key={at} className={`h-8 rounded-full ${width}`} />
          ))}
        </div>
        {p.note ? <Box className="h-8 w-full sm:h-4 sm:w-96" /> : null}
      </div>
      <div className="min-w-0">
        <div className="hidden px-3 py-2 sm:block">
          <Box className="h-6 w-full" />
        </div>
        {Array.from({ length: p.rows }, (_, at) => (
          <div key={at} className="border-base-300 border-b p-3 sm:border-b-0 sm:px-3 sm:py-2">
            <Box className={`w-full ${p.row}`} />
          </div>
        ))}
      </div>
      <div className="border-base-300 flex min-w-0 items-center border-t p-4">
        <Box className="h-8 w-48 max-w-full" />
      </div>
    </Waiting>
  );
}

/** One row's height in each table, measured from the loaded screens at
 *  390, 768 and 1280. Constants and not attribute literals: a string of
 *  words in JSX is what the copy sweep reads as a sentence. */
const SEARCH_ROW = "h-27 sm:h-9 xl:h-6";
const RIVAL_ROW = "h-21 sm:h-8 xl:h-7";

/** The Search table's shape: its name and lead, the chips, nine rows. */
export function SearchTableSkeleton(): React.JSX.Element {
  return (
    <FilteredTableSkeleton
      testId="search-table-skeleton"
      title
      note
      chips={["w-28", "w-32", "w-24", "w-36"]}
      rows={9}
      row={SEARCH_ROW}
    />
  );
}

/** Each page in Google: its name, the chart's well and six page rows. */
export function GooglePagesSkeleton(): React.JSX.Element {
  return (
    <Waiting className="card card-border bg-base-100 min-w-0" testId="search-pages-skeleton">
      <div className="flex min-w-0 flex-col gap-4 p-4 sm:p-5">
        <Box className="h-6 w-56 max-w-full" />
        <Box className="h-28 w-full" />
        {Array.from({ length: 6 }, (_, at) => (
          <Box key={at} className="h-16 w-full" />
        ))}
      </div>
    </Waiting>
  );
}

/** The Rivals table's shape: its name, a chip per rival, nine rows. */
export function RivalTableSkeleton(): React.JSX.Element {
  return (
    <FilteredTableSkeleton
      testId="rival-table-skeleton"
      title
      note={false}
      chips={["w-56", "w-52", "w-48"]}
      rows={9}
      row={RIVAL_ROW}
    />
  );
}

/** The two counting cards on Rivals, side by side from `lg`: the name, a
 *  name-and-bar pair per site, and the line under them. */
export function RivalPresenceSkeleton(): React.JSX.Element {
  return (
    <Waiting className="grid min-w-0 gap-4 lg:grid-cols-2" testId="rival-presence-skeleton">
      {Array.from({ length: 2 }, (_, card) => (
        <div key={card} className="card card-border bg-base-100 min-w-0">
          <div className="flex min-w-0 flex-col gap-3 p-4">
            <Box className="h-6 w-48 max-w-full" />
            <div className="flex min-w-0 flex-col gap-3">
              {Array.from({ length: 4 }, (_, at) => (
                <div key={at} className="flex min-w-0 flex-col gap-1">
                  <Box className="h-5 w-40 max-w-full" />
                  <Box className="h-2 w-full" />
                </div>
              ))}
            </div>
            <Box className="h-4 w-56 max-w-full" />
          </div>
        </div>
      ))}
    </Waiting>
  );
}
