// SPEC §4 (board Main) — Plan's week as Overview draws it. Reached at the call
// from `(tabs)/page.tsx`: Plan's modules reach the market's, and Overview's own
// graph holds no vendor client.
import type { DayKey } from "../calendar/dates";
import { dayStateOf, pagesThisWeek, pagesToComeThisWeek, type WeekModel } from "../calendar/month";
import { waitsToGoLive } from "../calendar/week-screen";
import type { WeekDay, WeekList } from "./ThisWeek";

export { ThisWeek } from "./ThisWeek";

/** The Monday checks as `checkDays` reads them. */
export interface WeekChecks {
  chosen: DayKey | null;
  checked: DayKey | null;
  next: DayKey | null;
}

const UNREAD: WeekChecks = { chosen: null, checked: null, next: null };

export function weekListOf(week: WeekModel, time: string | null = null, checks: WeekChecks = UNREAD): WeekList | null {
  if (week.cells.length === 0) return null;
  const today = week.cells.find((cell) => cell.day === week.today);
  return {
    timeZone: week.timeZone,
    today: week.today,
    skippedToday: today !== undefined && dayStateOf(today) === "skipped",
    pages: pagesThisWeek(week),
    coming: pagesToComeThisWeek(week),
    live: week.cells.filter((cell) => dayStateOf(cell) === "live").length,
    chosen: checks.chosen,
    checked: checks.checked,
    nextCheck: checks.next,
    days: week.cells.map((cell): WeekDay => ({ cell, time: waitsToGoLive(cell, week.today) ? time : null })),
  };
}

export async function readThisWeek(): Promise<WeekList | null> {
  const [{ planToday, readPlanHead, readWeek }, { weekGoesLive }, { checkDays }] = await Promise.all([
    import("../calendar/provider"),
    import("../calendar/WeekCard"),
    import("../calendar/week-screen"),
  ]);
  const [week, head] = await Promise.all([planToday().then(readWeek), readPlanHead()]);
  const check = checkDays(head, week.today);
  return weekListOf(week, weekGoesLive(week, head.publishTime), { chosen: check.chosen, checked: head.lastCheck, next: check.next });
}
