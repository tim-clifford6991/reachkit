// SPEC §7 — the stage filter: All, Live, Your review, Scheduled, Planned,
// Needs you, each with its count; choosing one narrows the grid.
//
// The counts come from `MonthModel.counts`, which `assembleMonth` derives
// from the very cells the grid renders — so the filter and the grid cannot
// disagree about what is on the calendar.
//
// Six daisyUI cards as toggle buttons in a CSS grid that re-columns (two on
// a phone, three at `lg`, six at `xl`), so every card is the same width
// whatever its word. The chosen card says so twice: `aria-pressed` for a
// screen reader, the primary border and tint for an eye.
"use client";

import type React from "react";
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
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6" data-testid="stage-filters">
      {STAGE_FILTERS.map((filter) => {
        const pressed = filter === p.selected;
        return (
          <button
            key={filter}
            type="button"
            className={`card card-border card-sm min-w-0 text-left transition-colors hover:border-primary ${
              pressed ? "border-primary bg-primary/10" : "bg-base-100"
            }`}
            data-testid={`stage-filter-${filter}`}
            aria-pressed={pressed}
            onClick={() => p.onSelect(filter)}
          >
            <span className="card-body gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide opacity-70">
                {copy(STAGE_FILTER_COPY_KEY[filter])}
              </span>
              <span className="num text-2xl font-semibold" data-testid={`stage-count-${filter}`}>
                {p.counts[filter]}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
