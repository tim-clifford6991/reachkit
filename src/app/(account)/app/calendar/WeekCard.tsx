// SPEC §7 *This week* — whether, and at what time, the week's pages go live, and the week's foot: the next check and
// how the week was chosen, in the screen model's words.
import type React from "react";
import { ChevronDown, RefreshCw } from "lucide-react";
import type { ScreenFoot } from "./week-screen";
import { clockTime } from "./dates";
import type { WeekModel } from "./month";

/** A go-live moment is promised only where the address works (Q11), publishing is not held and ReachKit has not stopped. */
export function promisesGoLive(week: Pick<WeekModel, "destination" | "held" | "stopped">): boolean {
  return week.destination?.healthy === true && week.held === null && week.stopped === null;
}

/** Today's go-live clock time, or `null` where none is promised. */
export function weekGoesLive(week: Pick<WeekModel, "destination" | "held" | "stopped">, publishTime: string | null): string | null {
  return promisesGoLive(week) && publishTime !== null ? clockTime(publishTime) : null;
}

export function WeekFoot(p: { words: ScreenFoot }): React.JSX.Element {
  return (
    <>
      <p className="flex min-w-0 items-start gap-2 rounded-box bg-base-200 p-3 text-sm" data-testid="plan-next">
        <RefreshCw aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
        <span className="min-w-0">{p.words.next}</span>
      </p>
      {/* A quiet link that opens in place, as the board draws it: no box, a chevron that turns. */}
      <details className="collapse group min-w-0 rounded-none" data-testid="plan-chosen">
        <summary className="collapse-title link link-primary flex min-h-11 w-fit cursor-pointer list-none items-center gap-1.5 p-0 text-sm font-semibold no-underline [&::-webkit-details-marker]:hidden">
          <ChevronDown aria-hidden className="size-4 shrink-0 transition-transform group-open:rotate-180" />
          {p.words.title}
        </summary>
        <p className="collapse-content p-0 text-sm">{p.words.body}</p>
      </details>
    </>
  );
}
