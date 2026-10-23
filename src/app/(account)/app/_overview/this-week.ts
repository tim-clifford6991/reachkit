// SPEC §4 (board Main) — Plan's week as Overview lists it. Reached at the call
// from `(tabs)/page.tsx`: Plan's modules reach the market's, and Overview's own
// graph holds no vendor client.
import { dayKeyOf } from "../calendar/dates";
import { dayStateOf, type DayCell, type PageOnDay, type WeekModel } from "../calendar/month";
import { DAY_STATE_COPY_KEY } from "../calendar/stages";
import type { WeekList, WeekRow } from "./ThisWeek";

function rowOf(cell: DayCell & { page: PageOnDay }, week: WeekModel): WeekRow {
  const { page } = cell;
  const state = dayStateOf(cell);
  const at = page.stage === "your_review" || page.stage === "scheduled" ? (page.vetoDeadline ?? page.publishAt) : null;
  return {
    day: cell.day,
    today: cell.day === week.today,
    update: page.update,
    title: page.title,
    state: state === null ? null : DAY_STATE_COPY_KEY[state],
    goesLiveToday: at !== null && dayKeyOf(at, week.timeZone) === week.today ? at : null,
    href: page.draftId === null ? null : `/app/draft/${page.draftId}`,
  };
}

export function weekListOf(week: WeekModel): WeekList | null {
  const first = week.cells[0];
  const last = week.cells.at(-1);
  if (first === undefined || last === undefined) return null;
  const today = week.cells.find((cell) => cell.day === week.today);
  return {
    first: first.day,
    last: last.day,
    days: week.cells.length,
    timeZone: week.timeZone,
    today: week.today,
    skippedToday: today !== undefined && dayStateOf(today) === "skipped",
    rows: week.cells.flatMap((cell) => (cell.page === null ? [] : [rowOf({ ...cell, page: cell.page }, week)])),
  };
}

export async function readThisWeek(): Promise<WeekList | null> {
  const { planToday, readWeek } = await import("../calendar/provider");
  return weekListOf(await readWeek(await planToday()));
}
