// SPEC §4 (board Main) — this week's pages, one row per day that holds one:
// the day, new or update, the title and its state. The rows are Plan's own
// week (`this-week.ts`), so the two screens cannot list two weeks.
import type React from "react";
import Link from "next/link";
import { RefreshCw, Zap } from "lucide-react";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { formatTime, SHELL_LOCALE } from "../_shell/format";
import { addDays, cardDate, dayNumber, weekdayShort, type DayKey } from "../calendar/dates";
import { CALENDAR_HREF } from "./week";

export interface WeekRow {
  day: DayKey;
  today: boolean;
  update: boolean;
  title: string;
  /** Plan's word for the day's state; `null` where it states none. */
  state: CopyKey | null;
  /** When a written page goes live, where that is today. */
  goesLiveToday: Date | null;
  /** The page's own screen; `null` before it is written. */
  href: string | null;
}

export interface WeekList {
  /** The week's first and last day, Monday to Sunday. */
  first: DayKey;
  last: DayKey;
  /** How many days the week has. */
  days: number;
  /** Today, in the site's zone. */
  today: DayKey;
  /** Today holds no page because nothing was worth writing. */
  skippedToday: boolean;
  timeZone: string;
  rows: readonly WeekRow[];
}

const utc = (day: DayKey): Date => new Date(`${day}T00:00:00Z`);

/** "Mon, Oct 19 – Sun, Oct 25": a value, so `Intl` writes it. */
function weekRange(first: DayKey, last: DayKey): string {
  return new Intl.DateTimeFormat(SHELL_LOCALE, { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" }).formatRange(
    utc(first),
    utc(last)
  );
}

function Row(p: { row: WeekRow; timeZone: string }): React.JSX.Element {
  const { row } = p;
  return (
    <li className={`list-row min-w-0 items-start ${row.today ? "bg-primary/10" : ""}`} data-testid="overview-week-row" data-day={row.day}>
      <span className="num w-14 shrink-0 text-xs text-base-content/70">
        {weekdayShort(row.day)} {dayNumber(row.day)}
      </span>
      <span className="list-col-grow flex min-w-0 flex-col gap-1">
        <span className={`badge badge-sm ${row.update ? "badge-ghost" : "badge-soft badge-primary"}`}>
          {copy(row.update ? "how.week.update" : "how.week.new")}
        </span>
        <span className="min-w-0 font-semibold wrap-anywhere" data-testid="overview-week-title">
          {row.title}
        </span>
      </span>
      {row.goesLiveToday === null ? (
        row.state === null ? null : (
          <span className="badge badge-sm badge-ghost shrink-0 whitespace-nowrap" data-testid="overview-week-state">
            {copy(row.state)}
          </span>
        )
      ) : (
        <span className="flex shrink-0 flex-col items-end gap-1 text-xs font-semibold" data-testid="overview-week-state">
          <span>{copy("overview.week.goes-live")}</span>
          <span>{copy("overview.week.today-at", { time: formatTime(row.goesLiveToday, p.timeZone) })}</span>
          {row.href === null ? null : (
            <span className="flex gap-3">
              <Link className="link" href={row.href} prefetch={true}>
                {copy("how.week.edit")}
              </Link>
              <Link className="link text-warning" href={row.href} prefetch={true}>
                {copy("calendar.week.stop")}
              </Link>
            </span>
          )}
        </span>
      )}
    </li>
  );
}

export function ThisWeek(p: { week: WeekList }): React.JSX.Element | null {
  const { week } = p;
  if (week.rows.length === 0) return null;
  const title = copy("overview.week.pages", { n: String(week.rows.length) });
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
        <ol className="list min-w-0" aria-label={title}>
          {week.rows.map((row) => (
            <Row key={row.day} row={row} timeZone={week.timeZone} />
          ))}
        </ol>
        <p className="flex min-w-0 items-center gap-2 text-xs text-base-content/70" data-testid="overview-week-next">
          <RefreshCw size={14} strokeWidth={1.75} aria-hidden className="shrink-0" />
          {copy("overview.week.next", { date: cardDate(addDays(week.first, 7)), n: String(week.days) })}
        </p>
      </div>
    </section>
  );
}
