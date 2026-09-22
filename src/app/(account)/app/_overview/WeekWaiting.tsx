// SPEC §4 (2026-09-20, #908), issue 912 — this week, on the first day.
//
// "First day after setup: Overview shows the pass's named steps … and
// skeletons for the week; it fills in when the pass ends."
//
// **Why a skeleton and not seven empty day cells.** The week's cells each
// carry a stage word, and a cell with no word is a day the product is
// saying nothing about — seven of them read as a week with nothing planned,
// which is not what is true. What is true is that the plan is waiting on a
// measurement, so the box holds the week's own shape and one line says
// exactly that.
//
// **And not a never-resolving skeleton either.** SPEC §4's other half of
// this sentence is that a wait has to state what it is waiting for. The
// line below is that statement, and the arm it is drawn on is the pass
// running — so this state cannot outlive the pass.
import type React from "react";
import { copy } from "@/lib/presentation/copy";

export function WeekWaiting(): React.JSX.Element {
  return (
    <section
      className="card card-border bg-base-100 min-w-0"
      role="status"
      aria-busy="true"
      data-waiting=""
      data-testid="week-waiting"
    >
      <div className="card-body min-w-0 gap-3">
        <h2 className="card-title text-base">{copy("overview.week.title")}</h2>
        <p className="min-w-0 text-sm text-base-content/70 wrap-anywhere">
          {copy("overview.first-day.week")}
        </p>
        <div className="grid min-w-0 grid-cols-7 gap-1">
          {Array.from({ length: 7 }, (_, at) => (
            <div key={at} className="skeleton h-20 min-w-0" aria-hidden />
          ))}
        </div>
      </div>
    </section>
  );
}
