// BUILD §4.5 · §6 · SPEC §4 (2026-09-20) — this week, and the one supply
// statement.
//
// SPEC §4 "this week, opening Plan" and §6: a day is filled only by a ready
// opportunity, and a short week says so in one written line rather than
// padding. The strip is a CSS grid in the route (docs/DESIGN.md rule 2: a
// grid that is not a series).
//
// **Every day says what stands on it.** Since the 2026-09-20 redesign each
// cell carries the weekday, the date and one word — the stage of the page
// scheduled for it, or "No page". Identity is never colour alone (§2.5):
// the word is the cell's meaning and the ground only agrees with it.
//
// **It cannot overflow.** Seven equal columns, each `min-w-0`, and the one
// word wraps inside its own column rather than being clamped: the set of
// words is closed and short, so the cell grows to hold the longest of them
// and the row grows with it — docs/DESIGN.md's "the box changes".
import type React from "react";
import { Calendar } from "lucide-react";
import { copy } from "@/lib/presentation/copy";
import { SHELL_LOCALE } from "../_shell/format";
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

/** The weekday, short. A calendar-day marker is read back in
 *  `CALENDAR_DAY_ZONE` (`week.ts` states the rule), never in the site's zone,
 *  which would apply the offset twice and label Monday's cell "Sunday". */
function formatWeekday(at: Date): string {
  return new Intl.DateTimeFormat(SHELL_LOCALE, {
    timeZone: CALENDAR_DAY_ZONE,
    weekday: "short",
  }).format(at);
}

export function WeekModule(p: {
  week: WeekModuleModel;
  timeZone: string;
  supply?: SupplyStatement;
}): React.JSX.Element {
  const title = copy("overview.week.title");
  const supplyLine = p.supply === undefined ? null : writtenLine(p.supply.key, p.supply.vars);
  // Issue 867: what this week's pages are aimed at — the searches, never a
  // count. A week with no planned or written page states no aim.
  const searches = p.week.searches ?? [];
  const aimLine =
    searches.length === 0 ? null : writtenLine("overview.week.aimed-at", { searches: searches.join(", ") });

  return (
    <section className="card card-border min-w-0 bg-base-100" data-testid="overview-week">
      <div className="card-body gap-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* The card head, at the sub-head step the approved board draws
              it at — sentence case, not an uppercase eyebrow. Plain
              `text-base`: the heading scale is in `@layer base` since #941,
              so a utility on a heading wins and the `!` this line used to
              carry is gone. */}
          <h2 className="card-title text-base">
            <Calendar aria-hidden size={20} strokeWidth={1.75} />
            {title}
          </h2>
          <a className="btn btn-ghost btn-sm" href={p.week.calendarHref}>
            {copy("overview.week.calendar-link")}
          </a>
        </div>
        <ol className="grid grid-cols-7 gap-1 sm:gap-2" aria-label={title}>
          {p.week.days.map((day) => {
            // A calendar-day marker, already in the site's zone (`readWeek`).
            const date = formatDayOfMonth(day.date, CALENDAR_DAY_ZONE);
            const word = copy(day.pageKey);
            const name = `${formatWeekday(day.date)} ${date} · ${word} · ${copy(day.markKey)}`;
            return (
              <li
                key={day.date.toISOString()}
                className={`flex min-w-0 flex-col items-center gap-1 rounded-field px-1 py-2 text-center ${DAY[day.state].cell}`}
                data-state={day.state}
                data-testid="overview-week-day"
                title={name}
              >
                <span className="block text-[0.625rem] font-semibold uppercase" aria-hidden>
                  {formatWeekday(day.date)}
                </span>
                <span className="num block text-sm font-semibold" role="img" aria-label={name}>
                  {date}
                </span>
                {/* The stage word, from `sm` up. A phone has room for seven
                    dates and nothing else — the approved phone board draws
                    the strip that way — and the word is still on the cell's
                    own accessible name at every width. Above `sm` it wraps
                    inside its column, anywhere if it has to: the cell grows
                    and the row grows with it, which is docs/DESIGN.md's "the
                    box changes" rather than a word cut in half. */}
                <span
                  // #946: no `opacity-` on text. The word is drawn in the
                  // cell's own ink at full strength; thinning it put it
                  // under the contrast floor on the tinted cells (today's
                  // and the two ahead), which is the finding axe reported.
                  className="hidden w-full text-[0.625rem] leading-tight wrap-anywhere sm:block"
                  aria-hidden
                >
                  {word}
                </span>
                <span className={`mt-1 block h-1 w-full rounded-full ${DAY[day.state].rule}`} aria-hidden />
              </li>
            );
          })}
        </ol>
        {aimLine === null ? null : (
          <p className="text-xs text-base-content/60" data-testid="overview-week-aim">
            {aimLine}
          </p>
        )}
        {supplyLine === null ? null : (
          <p className="text-xs text-base-content/60" data-testid="overview-supply">
            {supplyLine}
          </p>
        )}
      </div>
    </section>
  );
}
