// Board Plan — the week card's head and foot, written on the server and
// handed to `CalendarView`: the range, that it runs by itself and when pages
// go live; then the legend, the next Monday and how the week was chosen.
import type React from "react";
import { WEEK_PLAN } from "@/lib/config/constants";
import { copy } from "@/lib/presentation/copy";
import { formatCount } from "../_shell/format";
import { KindChip } from "./DayCard";
import { WEEK_HEADING_ID } from "./frame";
import { clockTime } from "./dates";
import type { WeekModel } from "./month";

/** Today's go-live clock time, or `null`: a time is promised only where the address works (Q11), publishing is not held and ReachKit has not stopped. */
export function weekGoesLive(week: Pick<WeekModel, "destination" | "held" | "stopped">, publishTime: string | null): string | null {
  return week.destination?.healthy === true && week.held === null && week.stopped === null && publishTime !== null
    ? clockTime(publishTime)
    : null;
}

export function WeekHead(p: {
  range: string;
  time: string | null;
}): React.JSX.Element {
  return (
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1">
      <span className="flex min-w-0 flex-wrap items-center gap-2">
        <h2 id={WEEK_HEADING_ID} className="text-base font-semibold">
          {p.range}
        </h2>
        <span className="badge badge-soft badge-success">
          {copy("how.week.auto")}
        </span>
      </span>
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
        className="flex min-w-0 flex-wrap gap-x-4 gap-y-1 text-sm text-base-content/70"
        data-testid="plan-legend"
      >
        <span className="flex items-center gap-2">
          <KindChip update={false} /> {copy("calendar.legend.new")}
        </span>
        <span className="flex items-center gap-2">
          <KindChip update /> {copy("calendar.legend.update")}
        </span>
      </p>
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
        <div className="collapse-content flex flex-col gap-2 text-sm">
          <p>{copy("calendar.chosen.body", { n })}</p>
          <p>{copy("calendar.chosen.stored")}</p>
        </div>
      </details>
    </>
  );
}
