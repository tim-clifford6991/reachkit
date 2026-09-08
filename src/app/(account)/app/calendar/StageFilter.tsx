// BUILD §4.6 — "**Stage filter cards** (All/Live/Your review/Scheduled/
// Planned/Needs you) with counts; clicking filters the grid."
//
// REQ-043 criterion 6: "when the customer selects a stage, then the view
// narrows to that stage, and every stage shows how many items it holds."
// The counts come from `MonthModel.counts`, which `assembleMonth` derives
// from the very cells the grid renders — so the filter and the grid cannot
// disagree about what is on the calendar (WO-164 step 3).
//
// **Six cards in one row, in the approved option-card idiom** (issue #354,
// screen S14). The set draws them as `.opt` boxes — a small label above a
// large mono count — laid out `repeat(6, minmax(0, 1fr))` and folding to
// three columns below `--breakpoint-lg`:
//
//     <button class="opt" aria-pressed="…">
//       <span class="stat-l">All</span>
//       <div class="num">28</div>
//     </button>
//
// What this file changed to match it (they were `Card`s with a `Badge` and
// a bare count before): the word is the card's own label rather than a
// stage chip — six filled chips in a row read as six states of something,
// which is precisely what a filter is not — the count is the headline
// figure at `--t-h3` in the mono face, and the chosen card carries the
// accent edge and tint the idiom registers for a selected box.
//
// **Why a bare `<button>` around a `Card`.** §2.2 closes custom CSS at five
// surfaces and a filter card is not one of them, so this file adds no
// stylesheet of its own; `rk-opt` is the idiom's own widening of `Card`
// (`src/ui/idiom/idiom.css`), on the same footing as its card head and its
// button ranks. It also cannot put the count inside a `Btn` or a `Tabs`
// tab: both take `label: string`, and §2.3 requires every numeral to be
// JetBrains Mono, which a numeral inside a flat label string can never be.
// `Card`'s title takes a `React.ReactNode`, so the word and the count are
// two nodes, and the button is the interactive wrapper around them.
//
// **The chosen card says so twice.** The tint is the eye's reading and
// `aria-pressed` is the screen reader's, and the stylesheet keys the tint
// off that attribute — so the two cannot diverge (§2.5's words-not-colour
// rule, and the pairing issue #288 already built for `Btn`).
//
// **Not a `Join`.** daisyUI's `join` is a non-wrapping row that welds its
// children edge to edge; six cards in one at 320px push the document into a
// horizontal scroll and squeeze the widest stage word ("Your review") until
// it clips — both offenders ADR-093 decision 6's sweep reports. The grid
// re-columns instead, which is what the layout law asks for: the box
// changes, the text is never shrunk to fit.
"use client";

import type React from "react";
import { Card } from "@/ui/components/Card";
import { copy } from "@/lib/presentation/copy";
import {
  STAGE_FILTERS,
  STAGE_FILTER_COPY_KEY,
  type StageFilter as StageFilterId,
} from "./stages";
import type { MonthModel } from "./month";

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
      className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6"
      data-testid="stage-filters"
    >
      {STAGE_FILTERS.map((filter) => (
        <button
          key={filter}
          type="button"
          className="rk-opt"
          data-testid={`stage-filter-${filter}`}
          aria-pressed={filter === p.selected}
          onClick={() => p.onSelect(filter)}
        >
          <Card
            state="default"
            title={<span className="rk-opt-label">{copy(STAGE_FILTER_COPY_KEY[filter])}</span>}
          >
            <span className="num rk-opt-count" data-testid={`stage-count-${filter}`}>
              {p.counts[filter]}
            </span>
          </Card>
        </button>
      ))}
    </div>
  );
}
