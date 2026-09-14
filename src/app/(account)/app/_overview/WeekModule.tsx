// BUILD §4.5 · §6 — this week: the seven-day strip, and the one supply
// statement.
//
// SPEC §4 "this week" and §6: a day is filled only by a ready opportunity,
// and a short week says so in one written line rather than padding. The
// strip is a CSS grid in the route (docs/DESIGN.md rule 2: a grid that is
// not a series). Identity is never colour alone — each day carries its date
// and the written word for its state as its accessible name.
import type React from "react";
import { Calendar } from "lucide-react";
import { copy } from "@/lib/presentation/copy";
import { writtenLine } from "../_shell/written";
import { formatDayOfMonth } from "./present";
import type { SupplyStatement } from "./supply";
import { CALENDAR_DAY_ZONE, type DayState, type WeekModule as WeekModuleModel } from "./week";

/** The cell ground and the rule under the date, per state, from the theme. */
const DAY: Readonly<Record<DayState, { cell: string; rule: string }>> = {
  done: { cell: "bg-base-200", rule: "bg-success" },
  today: { cell: "bg-primary/10 text-primary", rule: "bg-primary" },
  "to-come": { cell: "bg-base-200 opacity-60", rule: "bg-base-300" },
};

export function WeekModule(p: {
  week: WeekModuleModel;
  timeZone: string;
  supply?: SupplyStatement;
}): React.JSX.Element {
  const title = copy("overview.week.title");
  const supplyLine = p.supply === undefined ? null : writtenLine(p.supply.key, p.supply.vars);

  return (
    <section className="card card-border min-w-0 bg-base-100" data-testid="overview-week">
      <div className="card-body gap-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="card-title text-xs font-semibold uppercase tracking-wide text-base-content/60">
            <Calendar aria-hidden size={20} strokeWidth={1.75} />
            {title}
          </h2>
          <a className="btn btn-ghost btn-sm" href={p.week.calendarHref}>
            {copy("overview.week.calendar-link")}
          </a>
        </div>
        <ol className="grid grid-cols-7 gap-2" aria-label={title}>
          {p.week.days.map((day) => {
            // A calendar-day marker, already in the site's zone (`readWeek`).
            const date = formatDayOfMonth(day.date, CALENDAR_DAY_ZONE);
            const name = `${date} · ${copy(day.markKey)}`;
            return (
              <li
                key={day.date.toISOString()}
                className={`min-w-0 rounded-field px-1 py-2 text-center ${DAY[day.state].cell}`}
                data-state={day.state}
                data-testid="overview-week-day"
                title={name}
              >
                <span className="num block text-sm font-semibold" role="img" aria-label={name}>
                  {date}
                </span>
                <span className={`mt-2 block h-1 rounded-full ${DAY[day.state].rule}`} aria-hidden />
              </li>
            );
          })}
        </ol>
        {supplyLine === null ? null : (
          <p className="text-xs text-base-content/60" data-testid="overview-supply">
            {supplyLine}
          </p>
        )}
      </div>
    </section>
  );
}
