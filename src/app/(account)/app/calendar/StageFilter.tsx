// BUILD §4.6 — "**Stage filter cards** (All/Live/Your review/Scheduled/
// Planned/Needs you) with counts; clicking filters the grid."
//
// REQ-043 criterion 6: "when the customer selects a stage, then the view
// narrows to that stage, and every stage shows how many items it holds."
// The counts come from `MonthModel.counts`, which `assembleMonth` derives
// from the very cells the grid renders — so the filter and the grid cannot
// disagree about what is on the calendar (WO-164 step 3).
//
// **Six boxes in one row, as `Canvas: Calendar` draws them**: the stage
// word above its count, the chosen one edged and lettered in the accent
// through `aria-pressed`'s own variant, so what the eye reads and what a
// screen reader reads cannot diverge (§2.5). Token utilities on a bare
// `<button>` — no stylesheet, no `Card`, no chip.
//
// The count cannot go inside a `Btn` or a `Tabs` tab: both take
// `label: string`, and §2.3 requires every numeral to be JetBrains Mono,
// which a numeral inside a flat label string can never be. A grid and not
// a wrapping flex row, so six boxes are one width whatever their words are.
"use client";

import type React from "react";
import { copy } from "@/lib/presentation/copy";
import {
  STAGE_FILTERS,
  STAGE_FILTER_COPY_KEY,
  type StageFilter as StageFilterId,
} from "./stages";
import type { MonthModel } from "./month";

/** The canvas's filter box: its word above its count, the chosen one edged
 *  and lettered in the accent. The state is read off `aria-pressed`, so
 *  what the eye reads and what a screen reader reads cannot diverge. */
const BOX =
  "group flex min-w-0 flex-col gap-(--s-1) rounded-(--r-box) border border-base-300 bg-base-100 px-(--s-4) py-(--s-3) text-left aria-pressed:border-primary";
const WORD =
  "text-(length:--t-sm) text-(color:--ink-2) group-aria-pressed:font-semibold group-aria-pressed:text-primary";
/** The headline figure: the canvas's `--h2` step, mono as every numeral
 *  is (§2.3). */
const COUNT = "num text-(length:--h2) font-semibold";

export function StageFilter(p: {
  counts: MonthModel["counts"];
  selected: StageFilterId;
  onSelect: (filter: StageFilterId) => void;
}): React.JSX.Element {
  return (
    // S14's `.filters`: six across, three across below `--breakpoint-lg`,
    // two on a phone. A grid and not a wrapping flex row, so the six cards
    // are the same width whatever their words are — a filter row whose
    // boxes size to their labels reads as six unrelated controls.
    <div
      className="grid grid-cols-2 gap-(--s-3) lg:grid-cols-3 xl:grid-cols-6"
      data-testid="stage-filters"
    >
      {STAGE_FILTERS.map((filter) => (
        <button
          key={filter}
          type="button"
          className={BOX}
          data-testid={`stage-filter-${filter}`}
          aria-pressed={filter === p.selected}
          onClick={() => p.onSelect(filter)}
        >
          <span className={WORD}>{copy(STAGE_FILTER_COPY_KEY[filter])}</span>
          <span className={COUNT} data-testid={`stage-count-${filter}`}>
            {p.counts[filter]}
          </span>
        </button>
      ))}
    </div>
  );
}
