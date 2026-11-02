// SPEC §4 (board Main) — this week's pages, Monday to Sunday: one row per day
// on a phone (the date, then the page and its status) and seven columns from
// `lg`. The cells are Plan's week (`this-week.ts`) and its parts (`DayCard`),
// so the two screens cannot draw two weeks.
import type React from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { copy } from "@/lib/presentation/copy";
import { formatShortDay, formatTime, SHELL_LOCALE } from "../_shell/format";
import { addDays, dayNumber, weekdayShort, type DayKey } from "../calendar/dates";
import { DayStateBadge, KindChip, cardLineFor, stateLineOf } from "../calendar/DayCard";
import { TakeDownControl, type ControlWords } from "../calendar/TakeDown";
import { stopWords } from "../calendar/take-down-words";
import { shortCauseFor } from "../calendar/card-lines";
import { dayStateOf, type DayCell } from "../calendar/month";
import type { StageFilter } from "../calendar/stages";
import { CALENDAR_HREF } from "./week";

export interface WeekDay {
  /** Plan's own cell for the day. */
  cell: DayCell;
  /** When a written page goes live, where that is today. */
  goesLiveToday: Date | null;
  /** The page's own screen; `null` before it is written. */
  href: string | null;
  /** The next page to go live: the one row with Edit and Stop, as on Plan. */
  next: boolean;
  /** A live page's draft, which its row can take down; `null` otherwise. */
  liveDraft: string | null;
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

/** "Oct": the month a day falls in, short. */
function monthShort(day: DayKey): string {
  return new Intl.DateTimeFormat(SHELL_LOCALE, { timeZone: "UTC", month: "short" }).format(new Date(`${day}T00:00:00Z`));
}

/** "Mon 19": a day as the week's rows name it. */
const dayName = (day: DayKey): string => `${weekdayShort(day)} ${dayNumber(day)}`;

/** Overview draws the whole week: no stage filter narrows it. */
const ALL: StageFilter = "all";

const QUIET = "link link-hover inline-flex min-h-11 items-center text-sm no-underline";

/** Under the page: when the next page goes live today (else Plan's state badge),
 *  then Edit and Stop on its own screen; a live page's quiet Stop; else the badge. */
function DayControls(p: { day: WeekDay; timeZone: string; scheduled: boolean; words: ControlWords }): React.JSX.Element {
  const { day } = p;
  const goesLive = p.scheduled ? day.goesLiveToday : null;
  return (
    <span className="flex min-w-0 flex-col items-start" data-testid={goesLive === null ? undefined : "overview-week-goes-live"}>
      {goesLive === null ? (
        <DayStateBadge cell={day.cell} filter={ALL} />
      ) : (
        <span className="text-xs font-semibold">
          {copy("overview.week.goes-live")}
          <br />
          {copy("overview.week.today-at", { time: formatTime(goesLive, p.timeZone) })}
        </span>
      )}
      {!day.next || day.href === null ? null : (
        <span className="flex gap-4" data-testid="overview-week-next-controls">
          <Link className={`${QUIET} link-primary`} href={day.href} prefetch={true}>
            {copy("how.week.edit")}
          </Link>
          <Link className={`${QUIET} link-warning`} href={day.href} prefetch={true}>
            {copy("calendar.week.stop")}
          </Link>
        </span>
      )}
      {day.liveDraft === null ? null : <TakeDownControl draftId={day.liveDraft} mode="stop" words={p.words} quiet />}
    </span>
  );
}

function Day(p: { day: WeekDay; firstSkip: boolean; timeZone: string; scheduled: boolean; words: ControlWords }): React.JSX.Element {
  const { cell } = p.day;
  const page = cell.page;
  const line = cardLineFor(cell, ALL);
  const state = page === null ? stateLineOf(cell, p.firstSkip) : null;
  return (
    <li
      className={[
        "card card-border grid min-w-0 grid-cols-[3.75rem_minmax(0,1fr)] items-start gap-3 bg-base-100 p-4 lg:flex lg:flex-col lg:gap-2 lg:p-3",
        dayStateOf(cell) === "skipped" ? "border-dashed" : "",
        cell.today ? "border-primary bg-primary/5" : "",
      ].join(" ")}
      data-testid={`calendar-cell-${cell.day}`}
      data-today={cell.today ? "" : undefined}
      data-empty={page === null ? "" : undefined}
    >
      <span className="num pt-0.5 text-xs whitespace-nowrap text-base-content/70" data-testid="cell-date">
        {dayName(cell.day)}
      </span>
      <span className="flex min-w-0 flex-col items-start gap-1.5 lg:flex-1 lg:self-stretch">
        {page === null ? (
          line === null ? null : (
            <span
              className="rk-cal-empty min-w-0 text-sm wrap-anywhere text-base-content/70 lg:line-clamp-2 lg:text-xs"
              data-testid={shortCauseFor(cell) !== null ? "cell-empty-line" : "calendar-horizon-marker"}
            >
              {line}
            </span>
          )
        ) : (
          <>
            <KindChip update={page.update} />
            <span className="rk-cal-label min-w-0 text-sm font-semibold leading-snug wrap-anywhere lg:line-clamp-3" data-testid="cell-label">
              {page.title}
            </span>
          </>
        )}
        {state === null ? null : (
          <span className="min-w-0 text-xs wrap-anywhere text-base-content/70" data-testid="cell-state-line">
            {state}
          </span>
        )}
        {/* A day with no state and nothing going live draws no empty box. */}
        {dayStateOf(cell) === null && !p.day.next && p.day.liveDraft === null ? null : (
          <span className="flex min-w-0 lg:mt-auto">
            <DayControls day={p.day} timeZone={p.timeZone} scheduled={p.scheduled} words={p.words} />
          </span>
        )}
      </span>
    </li>
  );
}

export function ThisWeek(p: { week: WeekList; scheduled: boolean }): React.JSX.Element | null {
  const { week } = p;
  if (week.pages === 0) return null;
  const title = copy("overview.week.pages", { n: String(week.pages) });
  const next = addDays(week.first, 7);
  const words = stopWords();
  return (
    <section className="card card-border min-w-0 bg-base-100" aria-labelledby="overview-week-title" data-testid="overview-week">
      <div className="card-body min-w-0 gap-3.5 p-4 sm:p-6">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <span className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
            <h2 id="overview-week-title" className="text-xl font-bold tracking-tight">{title}</h2>
            <span className="num text-xs text-base-content/70">{`${dayName(week.first)} – ${formatShortDay(new Date(`${week.last}T12:00:00Z`), "UTC")}`}</span>
          </span>
          <Link className="link link-primary link-hover inline-flex min-h-11 items-center text-sm font-semibold" href={CALENDAR_HREF} prefetch={true}>
            {copy("overview.week.calendar-link")}
          </Link>
        </div>
        <ol className="flex min-w-0 flex-col gap-2.5 lg:grid lg:grid-cols-7" aria-label={title}>
          {week.days.map((day) => (
            <Day key={day.cell.day} day={day} firstSkip={day.cell.day === week.firstSkip} timeZone={week.timeZone} scheduled={p.scheduled} words={words} />
          ))}
        </ol>
        <p className="flex min-w-0 items-center gap-2 text-sm text-base-content/70" data-testid="overview-week-next">
          <RefreshCw size={16} strokeWidth={1.75} aria-hidden className="shrink-0" />
          {copy("overview.week.next", { date: `${dayNumber(next)} ${monthShort(next)}`, n: String(week.days.length) })}
        </p>
      </div>
    </section>
  );
}
