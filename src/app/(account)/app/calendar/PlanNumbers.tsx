// SPEC §7 (2026-10-09, issue 1364) — Plan opens with its numbers: how many
// pages are live, ready, scheduled and planned.
//
// The counts are `WeekModel.counts`, the very ones the stage filter prints
// on its chips, so nothing is counted a second way (REQ-043 c6).
//
// **A count of pages is a count, so a zero is a zero**: a week with no
// live page has none, and nobody failed to measure that. It is drawn quiet.
//
// daisyUI `card` cells on the Overview tiles' own grid — two columns on a
// phone and one row from `lg` — with no class of their own.
import type React from "react";
import { copy } from "@/lib/presentation/copy";
import { STAGE_FILTER_COPY_KEY, type Stage } from "./stages";
import type { WeekModel } from "./month";
import { NUMBERS, REGION } from "./frame";

/** The four stages a page moves through on its way out. *Needs you* is an
 *  exception and not a stage of the plan; it stays on its chip. */
const SHOWN = ["live", "your_review", "scheduled", "planned"] as const satisfies readonly Stage[];

/** A zero is drawn in the muted ink, at the same size: the row keeps one
 *  height whatever it counts. */
function figureClass(count: number): string {
  return count === 0 ? "figure text-3xl leading-none text-base-content/70" : "figure text-3xl leading-none";
}

export function PlanNumbers(p: { counts: WeekModel["counts"] }): React.JSX.Element {
  const inWeek = copy("calendar.numbers.week");
  return (
    <div className={NUMBERS} data-testid="plan-numbers" data-frame={REGION.numbers}>
      {SHOWN.map((stage) => (
        <div key={stage} className="card card-border min-w-0 bg-base-100" data-testid={`plan-number-${stage}`}>
          <div className="card-body gap-2 p-4">
            <span className="min-w-0 text-xs font-semibold uppercase tracking-wide text-base-content/70">
              {copy(STAGE_FILTER_COPY_KEY[stage])}
            </span>
            <div className="flex min-w-0 flex-wrap items-baseline gap-2">
              <span className={figureClass(p.counts[stage])} data-testid={`plan-number-${stage}-week`}>
                {p.counts[stage]}
              </span>
              <span className="min-w-0 text-sm text-base-content/70">{inWeek}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
