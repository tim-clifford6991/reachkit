// SPEC §7 (2026-09-20, #908, issue 930) — the stage filter, as chips with
// their counts: All, Live, Your review, Scheduled, Planned, Needs you.
//
// The counts come from `MonthModel.counts`, which `assembleMonth` derives
// from the very cells the grid renders — so the filter and the grid cannot
// disagree about what is on the calendar (REQ-043 c6). Below `lg` Plan
// draws this week and not the month (SPEC §7, 2026-10-08, issue 1340), so
// each chip carries the week's count there, from the cells the list draws:
// two numbers in the document and one on screen, chosen by the same media
// query that chooses the list.
//
// **daisyUI `filter` for the row, `btn` chips inside it, and `<button>`
// rather than `input[type=radio]`.** The component's radio form is written
// to collapse: `.filter:has(:checked) input:not(:checked)` takes
// `width: 0; opacity: 0`, so choosing a stage hides the other five chips
// and, with them, their counts — and it draws a chip's word from
// `content: attr(aria-label)`, which puts the count in generated content
// rather than in the document. REQ-043 c6 asks the opposite of both: "every
// stage shows how many items it holds", at all times and in the text. So
// the row is the component's own class (its wrap and its spacing) and each
// chip is a `btn` on a real button, which is `docs/DESIGN.md`'s rule 1 —
// daisyUI classes in the route — rather than a component wrapped or a
// stylesheet added.
//
// The chosen chip says so twice: `aria-pressed` for a screen reader, the
// solid ink pill for an eye, the rest ghost pills (#1063). Each stage's
// chip leads with the dot its cards carry (issue 1071, board R12-5-Plan),
// so the filter and the grid speak one colour per stage; *All* has none.
"use client";

import type React from "react";
import { copy } from "@/lib/presentation/copy";
import {
  STAGE_FILTERS,
  STAGE_FILTER_COPY_KEY,
  STAGE_TONE,
  TONE_DOT,
  type StageFilter as StageFilterId,
} from "./stages";
import type { MonthModel } from "./month";

export function StageFilter(p: {
  counts: MonthModel["counts"];
  weekCounts: MonthModel["counts"];
  selected: StageFilterId;
  onSelect: (filter: StageFilterId) => void;
}): React.JSX.Element {
  return (
    <div className="filter gap-2" role="group" data-testid="stage-filters">
      {STAGE_FILTERS.map((filter) => {
        const pressed = filter === p.selected;
        return (
          <button
            key={filter}
            type="button"
            className={`btn btn-sm rounded-full ${pressed ? "border-base-content bg-base-content text-base-100" : "btn-ghost"}`}
            data-testid={`stage-filter-${filter}`}
            aria-pressed={pressed}
            onClick={() => p.onSelect(filter)}
          >
            {filter === "all" ? null : (
              <span className={`size-1.5 shrink-0 rounded-full ${TONE_DOT[STAGE_TONE[filter]]}`} aria-hidden />
            )}
            <span>{copy(STAGE_FILTER_COPY_KEY[filter])}</span>
            <span className="num text-[11px] hidden opacity-70 lg:inline" data-testid={`stage-count-${filter}`}>
              {p.counts[filter]}
            </span>
            <span className="num text-[11px] opacity-70 lg:hidden" data-testid={`stage-week-count-${filter}`}>
              {p.weekCounts[filter]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
