// SPEC §4 (board Main) — this week's pages as Plan's own day cards, Monday to
// Sunday: the cells are Plan's week (`this-week.ts`), so the two screens
// cannot draw two weeks.
import type React from "react";
import Link from "next/link";
import { RefreshCw, Zap } from "lucide-react";
import { copy } from "@/lib/presentation/copy";
import { formatTime, SHELL_LOCALE } from "../_shell/format";
import { addDays, cardDate, type DayKey } from "../calendar/dates";
import { DayCardView, DayStateBadge, cardLineFor } from "../calendar/DayCard";
import type { DayCell } from "../calendar/month";
import type { StageFilter } from "../calendar/stages";
import { CALENDAR_HREF } from "./week";

export interface WeekDay {
  /** Plan's own cell for the day. */
  cell: DayCell;
  /** When a written page goes live, where that is today. */
  goesLiveToday: Date | null;
  /** The page's own screen; `null` before it is written. */
  href: string | null;
}

export interface WeekList {
  /** The week's first and last day, Monday to Sunday. */
  first: DayKey;
  last: DayKey;
  /** Today, in the site's zone. */
  today: DayKey;
  /** Today holds no page because nothing was worth writing. */
  skippedToday: boolean;
  /** The week's first skipped day, which alone says what a skip is. */
  firstSkip: DayKey | null;
  /** How many days hold a page. */
  pages: number;
  timeZone: string;
  days: readonly WeekDay[];
}

const utc = (day: DayKey): Date => new Date(`${day}T00:00:00Z`);

/** "Mon, Oct 19 – Sun, Oct 25": a value, so `Intl` writes it. */
function weekRange(first: DayKey, last: DayKey): string {
  return new Intl.DateTimeFormat(SHELL_LOCALE, { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" }).formatRange(
    utc(first),
    utc(last)
  );
}

/** Overview draws the whole week: no stage filter narrows it. */
const ALL: StageFilter = "all";

/** Under the day: Plan's state badge, or, for a page going live today while
 *  publishing will send it, when, with Edit and Stop on the page's own screen. */
function DayControls(p: { day: WeekDay; timeZone: string; scheduled: boolean }): React.JSX.Element {
  const { day } = p;
  const goesLive = p.scheduled ? day.goesLiveToday : null;
  if (goesLive === null) return <DayStateBadge cell={day.cell} filter={ALL} />;
  return (
    <span className="flex min-w-0 flex-col gap-1 text-xs font-semibold" data-testid="overview-week-goes-live">
      <span>{copy("overview.week.goes-live")}</span>
      <span>{copy("overview.week.today-at", { time: formatTime(goesLive, p.timeZone) })}</span>
      {day.href === null ? null : (
        <span className="flex flex-wrap gap-3">
          <Link className="link" href={day.href} prefetch={true}>
            {copy("how.week.edit")}
          </Link>
          <Link className="link text-warning" href={day.href} prefetch={true}>
            {copy("calendar.week.stop")}
          </Link>
        </span>
      )}
    </span>
  );
}

export function ThisWeek(p: { week: WeekList; scheduled: boolean }): React.JSX.Element | null {
  const { week } = p;
  if (week.pages === 0) return null;
  const title = copy("overview.week.pages", { n: String(week.pages) });
  return (
    <section className="card card-border min-w-0 bg-base-100" aria-labelledby="overview-week-title" data-testid="overview-week">
      <div className="card-body min-w-0 gap-3 p-5">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
          <span className="flex min-w-0 flex-wrap items-center gap-2">
            <h2 id="overview-week-title" className="card-title text-base">
              {title}
            </h2>
            <span className="num text-xs text-base-content/70">{weekRange(week.first, week.last)}</span>
            <span className="badge badge-sm badge-soft badge-success">
              <Zap size={14} strokeWidth={1.75} aria-hidden />
              {copy("how.week.auto")}
            </span>
          </span>
          <Link className="link text-sm font-semibold" href={CALENDAR_HREF} prefetch={true}>
            {copy("overview.week.calendar-link")}
          </Link>
        </div>
        <ol className="grid min-w-0 grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-7" aria-label={title}>
          {week.days.map((day) => (
            <DayCardView
              key={day.cell.day}
              cell={day.cell}
              page={day.cell.page}
              line={cardLineFor(day.cell, ALL)}
              goesLive={null}
              firstSkip={day.cell.day === week.firstSkip}
              filtered={false}
              selected={false}
              controls={<DayControls day={day} timeZone={week.timeZone} scheduled={p.scheduled} />}
            />
          ))}
        </ol>
        <p className="flex min-w-0 items-center gap-2 text-xs text-base-content/70" data-testid="overview-week-next">
          <RefreshCw size={14} strokeWidth={1.75} aria-hidden className="shrink-0" />
          {copy("overview.week.next", { date: cardDate(addDays(week.first, 7)), n: String(week.days.length) })}
        </p>
      </div>
    </section>
  );
}
