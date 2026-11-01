// Board Plan — the week card's head and foot, written on the server and
// handed to `CalendarView`: the range and when pages go live; then the next
// Monday and how the week was chosen.
import type React from "react";
import { WEEK_PLAN } from "@/lib/config/constants";
import { copy } from "@/lib/presentation/copy";
import { formatCount } from "../_shell/format";
import { WEEK_HEADING_ID } from "./frame";
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

export function WeekHead(p: {
  range: string;
  time: string | null;
}): React.JSX.Element {
  return (
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1">
      <h2 id={WEEK_HEADING_ID} className="text-base font-semibold">
        {p.range}
      </h2>
      {/* No time is promised while the address does not work (Q11). */}
      {p.time === null ? null : (
        <span
          className="text-sm text-base-content/70"
          data-testid="plan-week-time"
        >
          {p.time}
        </span>
      )}
    </div>
  );
}

export function WeekFoot(p: { next: string }): React.JSX.Element {
  const n = formatCount(WEEK_PLAN.days);
  return (
    <>
      <p
        className="rounded-box bg-base-200 p-3 text-sm"
        data-testid="plan-next"
      >
        {copy("calendar.next", { date: p.next, n })}
      </p>
      <details
        className="collapse collapse-arrow bg-base-200"
        data-testid="plan-chosen"
      >
        <summary className="collapse-title font-semibold">
          {copy("calendar.chosen.title")}
        </summary>
        <p className="collapse-content text-sm">
          {copy("calendar.chosen.body", { n })} {copy("calendar.chosen.stored")}
        </p>
      </details>
    </>
  );
}
