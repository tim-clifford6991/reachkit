// SPEC §4 (board Main) — Plan's week as Overview draws it. Reached at the call
// from `(tabs)/page.tsx`: Plan's modules reach the market's, and Overview's own
// graph holds no vendor client.
import { actionsFor } from "../calendar/actions";
import { dayKeyOf } from "../calendar/dates";
import { dayStateOf, type DayCell, type WeekModel } from "../calendar/month";
import type { WeekDay, WeekList } from "./ThisWeek";

export { ThisWeek } from "./ThisWeek";

/** Whether Plan's own controls would offer this day a stop: Plan's rule for its next page. */
const stoppable = (cell: DayCell, week: WeekModel): boolean =>
  actionsFor(cell, week.destination).some((action) => action.kind === "command" && (action.command === "veto" || action.command === "skip"));

function dayOf(cell: DayCell, week: WeekModel, next: boolean): WeekDay {
  const { page } = cell;
  if (page === null) return { cell, goesLiveToday: null, href: null, next: false, liveDraft: null };
  const at = next || page.stage === "your_review" || page.stage === "scheduled" ? (page.vetoDeadline ?? page.publishAt) : null;
  return {
    // Why a page was chosen is Plan's to say; Overview links there instead.
    cell: { ...cell, page: { ...page, whyLine: null } },
    goesLiveToday: at !== null && dayKeyOf(at, week.timeZone) === week.today ? at : null,
    href: page.draftId === null ? null : `/app/draft/${page.draftId}`,
    next,
    // A live page can be taken down from its row, as on Plan's live list.
    liveDraft: page.stage === "live" && page.liveUrl !== null ? page.draftId : null,
  };
}

export function weekListOf(week: WeekModel): WeekList | null {
  const first = week.cells[0];
  const last = week.cells.at(-1);
  if (first === undefined || last === undefined) return null;
  const today = week.cells.find((cell) => cell.day === week.today);
  // Edit and Stop sit on the next page to go live only, as on Plan.
  const next = week.cells.find((cell) => cell.page !== null && stoppable(cell, week))?.day ?? null;
  return {
    first: first.day,
    last: last.day,
    timeZone: week.timeZone,
    today: week.today,
    skippedToday: today !== undefined && dayStateOf(today) === "skipped",
    firstSkip: week.cells.find((cell) => dayStateOf(cell) === "skipped")?.day ?? null,
    pages: week.cells.filter((cell) => cell.page !== null).length,
    days: week.cells.map((cell) => dayOf(cell, week, cell.day === next)),
  };
}

export async function readThisWeek(): Promise<WeekList | null> {
  const { planToday, readWeek } = await import("../calendar/provider");
  return weekListOf(await readWeek(await planToday()));
}
