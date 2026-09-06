// BUILD §4.6 — "**Stage filter cards** (All/Live/Your review/Scheduled/
// Planned/Needs you) with counts; clicking filters the grid."
//
// REQ-043 criterion 6: "when the customer selects a stage, then the view
// narrows to that stage, and every stage shows how many items it holds."
// The counts come from `MonthModel.counts`, which `assembleMonth` derives
// from the very cells the grid renders — so the filter and the grid cannot
// disagree about what is on the calendar (WO-164 step 3).
//
// **Why a bare `<button>` around a `Card`.** §2.2 closes custom CSS at five
// surfaces and a filter card is not one of them, so this file adds no class
// and no stylesheet of its own. It also cannot put the count inside a `Btn`
// or a `Tabs` tab: both take `label: string`, and §2.3 requires every
// numeral to be JetBrains Mono, which a numeral inside a flat label string
// can never be. `Card`'s title takes a `React.ReactNode`, so the word and
// the count are two nodes — the word from the registry, the count in
// `.num` — and the button is the unstyled interactive wrapper around it.
// Nothing here is a sixth custom surface; it is one registered component
// and one native element — and no class name either, because a class
// nothing may style is a promise this file cannot keep.
//
// **Not a `Join`.** daisyUI's `join` is a non-wrapping row that welds its
// children edge to edge; six cards in one at 320px push the document into a
// horizontal scroll and squeeze the widest stage word ("Your review") until
// its badge clips — both offenders ADR-093 decision 6's sweep reports. The
// cards wrap instead, which is what the layout law asks for: the box
// changes, the text is never shrunk to fit.
"use client";

import type React from "react";
import { Badge } from "@/ui/components/Badge";
import { Card } from "@/ui/components/Card";
import { copy } from "@/lib/presentation/copy";
import {
  STAGE_FILTERS,
  STAGE_FILTER_COPY_KEY,
  STAGE_TONE,
  type StageFilter as StageFilterId,
} from "./stages";
import type { MonthModel } from "./month";

export function StageFilter(p: {
  counts: MonthModel["counts"];
  selected: StageFilterId;
  onSelect: (filter: StageFilterId) => void;
}): React.JSX.Element {
  return (
    <div className="flex flex-wrap gap-2" data-testid="stage-filters">
      {STAGE_FILTERS.map((filter) => (
        <button
          key={filter}
          type="button"
          className="text-left"
          data-testid={`stage-filter-${filter}`}
          aria-pressed={filter === p.selected}
          onClick={() => p.onSelect(filter)}
        >
          <Card
            state="default"
            title={
              <Badge tone={filter === "all" ? "neutral" : STAGE_TONE[filter]}>
                {copy(STAGE_FILTER_COPY_KEY[filter])}
              </Badge>
            }
          >
            <span className="num" data-testid={`stage-count-${filter}`}>
              {p.counts[filter]}
            </span>
          </Card>
        </button>
      ))}
    </div>
  );
}
