// SPEC §4 (board Main) — this week's pages: from `lg` a seven-column grid of the
// days that exist, below `lg` one line-card to Plan. The cells are Plan's week
// (`this-week.ts`) and its badge (`DayCard`), so the two screens say the same word.
import type React from "react";
import Link from "next/link";
import { ChevronRight, Clock, RefreshCw } from "lucide-react";
import { WEEK_PLAN } from "@/lib/config/constants";
import { copy } from "@/lib/presentation/copy";
import { SHELL_LOCALE } from "../_shell/format";
import { dayNumber, weekdayShort, type DayKey } from "../calendar/dates";
import { DayStateBadge, KindChip, cardLineFor, stateLineOf } from "../calendar/DayCard";
import { dayStateOf, type DayCell } from "../calendar/month";
import type { StageFilter } from "../calendar/stages";
import { CALENDAR_HREF } from "./week";

export interface WeekDay {
  /** Plan's own cell for the day. */
  cell: DayCell;
  /** A written page's go-live time, as This Week promises it; `null` where none is promised. */
  time: string | null;
}

export interface WeekList {
  /** Today, in the site's zone. */
  today: DayKey;
  /** Today holds no page because nothing was worth writing. */
  skippedToday: boolean;
  /** How many days hold a page. */
  pages: number;
  /** Of those, the ones still to go live (`pagesToComeThisWeek`). */
  coming: number;
  /** Of those, the ones live. */
  live: number;
  /** The day the week's pages were picked, and the last and next Monday check; `null` where unread. */
  chosen: DayKey | null;
  checked: DayKey | null;
  nextCheck: DayKey | null;
  timeZone: string;
  days: readonly WeekDay[];
}

/** "26 Oct": a day as the week's foot names it. */
const dayMonth = (day: DayKey): string =>
  new Intl.DateTimeFormat(SHELL_LOCALE, { timeZone: "UTC", day: "numeric", month: "short" }).format(new Date(`${day}T12:00:00Z`));

/** Overview draws the whole week: no stage filter narrows it. */
const ALL: StageFilter = "all";

function Day(p: { day: WeekDay }): React.JSX.Element {
  const { cell, time } = p.day;
  const page = cell.page;
  const state = dayStateOf(cell);
  const stateLine = stateLineOf(cell, false);
  // Plan's rule: a stopped or skipped day's own sentence says it, so its two words would repeat it.
  const line = page !== null ? page.title : stateLine !== null && (state === "stopped" || state === "skipped") ? null : cardLineFor(cell, ALL);
  return (
    <li
      className={`card min-w-0 items-start gap-1.5 p-3 ${cell.today ? "bg-primary/10 ring-1 ring-primary" : "bg-base-200"}`}
      data-testid={`calendar-cell-${cell.day}`}
      data-today={cell.today ? "" : undefined}
    >
      <span className="num text-xs whitespace-nowrap text-base-content/70">{`${weekdayShort(cell.day)} ${dayNumber(cell.day)}`}</span>
      {page === null ? null : <KindChip update={page.update} />}
      {line === null ? null : (
        <span className={`min-w-0 wrap-anywhere ${page === null ? "text-xs text-base-content/70" : "text-sm font-semibold leading-snug"}`}>
          {line}
        </span>
      )}
      {stateLine === null ? null : (
        <span className="min-w-0 text-xs wrap-anywhere text-base-content/70" data-testid="cell-state-line">
          {stateLine}
        </span>
      )}
      <span className="mt-auto flex min-w-0">
        {time !== null && state === "written" ? (
          <span className="badge badge-sm badge-soft badge-primary shrink-0 gap-1 whitespace-nowrap font-semibold" data-testid="day-state" data-state={state}>
            <Clock aria-hidden className="size-3" />
            {time}
          </span>
        ) : (
          <DayStateBadge cell={cell} filter={ALL} />
        )}
      </span>
    </li>
  );
}

export function ThisWeek(p: { week: WeekList }): React.JSX.Element | null {
  const { week } = p;
  if (week.pages === 0) return null;
  const title = copy("overview.week.pages", { n: String(week.pages) });
  return (
    <section className="card card-border min-w-0 bg-base-100" aria-label={title} data-testid="overview-week">
      <Link className="card-body min-h-11 min-w-0 flex-row items-center gap-3 p-4 lg:hidden" href={CALENDAR_HREF} prefetch={true}>
        <span className="flex min-w-0 flex-1 flex-col">
          <h2 className="text-base font-bold">{title}</h2>
          <span className="num text-sm text-base-content/70">{copy("overview.week.summary", { live: String(week.live), left: String(week.coming) })}</span>
        </span>
        <ChevronRight aria-hidden className="size-5 shrink-0 text-base-content/70" />
      </Link>
      <div className="card-body hidden min-w-0 gap-3.5 p-6 lg:flex">
        <div className="flex min-w-0 items-center justify-between gap-4">
          <h2 className="text-xl font-bold tracking-tight">{title}</h2>
          <Link className="link link-primary link-hover inline-flex min-h-11 items-center text-sm font-semibold" href={CALENDAR_HREF} prefetch={true}>
            {copy("overview.week.calendar-link")}
          </Link>
        </div>
        <ol className="grid min-w-0 auto-cols-fr grid-flow-col gap-2.5" aria-label={title}>
          {week.days.map((day) => (
            <Day key={day.cell.day} day={day} />
          ))}
        </ol>
        {week.nextCheck === null ? null : (
          <p className="flex min-w-0 items-center gap-2 text-sm text-base-content/70" data-testid="overview-week-next">
            <RefreshCw size={16} strokeWidth={1.75} aria-hidden className="shrink-0" />
            {copy("overview.week.next", { date: dayMonth(week.nextCheck), n: String(WEEK_PLAN.days) })}
          </p>
        )}
      </div>
    </section>
  );
}
