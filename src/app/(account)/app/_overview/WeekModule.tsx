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
// **The calm layer (SPEC §4 2026-09-24, #1070, board R12-4).** A day with
// no page is a flat grey cell; a day with a page is a bordered cell with the
// calendar's dot for its stage (and the *Your review* pulse); today is the
// accent. Nothing is dimmed with opacity. The *broader categories* choice,
// when the market is too small, is a one-line notice at the foot of this
// card with one suggestion to press, rather than a card of its own above
// the headline.
//
// **It cannot overflow.** Seven equal columns, each `min-w-0`, and the one
// word wraps inside its own column rather than being clamped: the set of
// words is closed and short, so the cell grows to hold the longest of them
// and the row grows with it — docs/DESIGN.md's "the box changes".
import type React from "react";
import { Calendar, Info } from "lucide-react";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { BroaderTry } from "../_shell/CategoryChoice";
import { SHELL_LOCALE } from "../_shell/format";
import { MarketChoice } from "../_shell/OnboardingStatus";
import type { CategoryChoiceModel } from "../_shell/remeasure";
import { writtenLine } from "../_shell/written";
import { STAGE_BEACON, STAGE_FILTER_COPY_KEY, STAGE_TONE, STAGES, TONE_DOT, type Stage } from "../calendar/stages";
import { formatDayOfMonth } from "./present";
import type { SupplyStatement } from "./supply";
import { CALENDAR_DAY_ZONE, type DayState, type WeekModule as WeekModuleModel } from "./week";

/** Today's cell, whatever stands on it. */
const TODAY_CELL = "border border-primary bg-primary/10 text-primary";
/** A day with a page on it, and a day with none: bordered, and flat grey. */
const PAGE_CELL = "border border-base-300 bg-base-100";
const EMPTY_CELL = "bg-base-200";

/** The stage a day's word names, read back from the calendar's own map —
 *  `null` for "No page". */
const STAGE_OF_KEY: ReadonlyMap<CopyKey, Stage> = new Map(
  STAGES.map((stage) => [STAGE_FILTER_COPY_KEY[stage], stage] as const)
);

function cellClass(state: DayState, stage: Stage | null): string {
  if (state === "today") return TODAY_CELL;
  return stage === null ? EMPTY_CELL : PAGE_CELL;
}

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
  /** Issue 837 · #1070: the broader categories a market too small is
   *  offered, and the notice that says so when the supply line does not. */
  broader?: { choice: CategoryChoiceModel; notice: string | null } | null;
}): React.JSX.Element {
  const title = copy("overview.week.title");
  const supplyLine = p.supply === undefined ? null : writtenLine(p.supply.key, p.supply.vars);
  const broader = p.broader ?? null;
  const first = broader?.choice.suggestions[0];
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
            const stage = STAGE_OF_KEY.get(day.pageKey) ?? null;
            return (
              <li
                key={day.date.toISOString()}
                className={`flex min-w-0 flex-col items-center gap-1 rounded-field px-1 py-2 text-center ${cellClass(day.state, stage)}`}
                data-state={day.state}
                data-testid="overview-week-day"
                title={name}
              >
                <span className="block text-(length:--t-eyebrow) font-semibold uppercase" aria-hidden>
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
                  // under the contrast floor on the tinted cells.
                  className="hidden w-full items-center justify-center gap-1 text-(length:--t-eyebrow) leading-tight wrap-anywhere sm:flex"
                  aria-hidden
                >
                  {stage === null ? null : (
                    <span
                      className={`size-1.5 shrink-0 rounded-full ${TONE_DOT[STAGE_TONE[stage]]} ${STAGE_BEACON[stage]}`}
                      aria-hidden
                    />
                  )}
                  {word}
                </span>
                {/* The dot alone on a phone, where the word does not fit. */}
                {stage === null ? null : (
                  <span
                    className={`size-1.5 rounded-full sm:hidden ${TONE_DOT[STAGE_TONE[stage]]}`}
                    aria-hidden
                  />
                )}
              </li>
            );
          })}
        </ol>
        {aimLine === null ? null : (
          <p className="text-xs text-base-content/70" data-testid="overview-week-aim">
            {aimLine}
          </p>
        )}
        {broader === null ? (
          supplyLine === null ? null : (
            <p className="text-xs text-base-content/70" data-testid="overview-supply">
              {supplyLine}
            </p>
          )
        ) : (
          // The broader-categories notice (#1070): one line, and one
          // suggestion to press. The supply line is the sentence where it
          // says the market was never measured; otherwise the release
          // notice is.
          <div
            className={`flex min-w-0 flex-col gap-3 rounded-field bg-base-200 p-4 ${first === undefined ? "" : "sm:flex-row sm:items-center"}`}
            data-testid="overview-broader"
          >
            <p className="flex min-w-0 flex-1 items-start gap-2 text-sm">
              <Info size={16} strokeWidth={1.75} aria-hidden className="mt-0.5 shrink-0" />
              {supplyLine === null ? (
                <span className="min-w-0">{broader.notice}</span>
              ) : (
                <span className="min-w-0" data-testid="overview-supply">
                  {supplyLine}
                </span>
              )}
            </p>
            {/* No suggestion read from the site: the founder's own words
                are then the only way to measure again, so the field stays. */}
            {first === undefined ? (
              <MarketChoice choice={broader.choice} />
            ) : (
              <BroaderTry suggestion={first} label={copy("overview.week.broader.try", { category: first })} />
            )}
          </div>
        )}
      </div>
    </section>
  );
}
