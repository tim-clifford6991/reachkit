// Canvas: Dashboard — this week: the seven-day strip, and the one supply
// statement.
//
// The artboard heads the card with an eyebrow and sets the calendar link
// opposite it as the quiet accent word: the link leaves the screen, and the
// screen's one solid fill is spent on the veto panel's "Read it".
//
// Identity is never colour alone — every day carries its own date and the
// written word for its state as the cell's accessible text, so the strip
// still says what it means with the colours removed.
import type React from "react";
import { Calendar } from "lucide-react";
import { Card } from "@/ui/components";
import { WeekStrip, type SevenDays, type WeekDay } from "@/ui/charts";
import { copy } from "@/lib/presentation/copy";
import { writtenLine } from "../_shell/written";
import { formatDayOfMonth } from "./present";
import type { SupplyStatement } from "./supply";
import { CALENDAR_DAY_ZONE, type WeekModule as WeekModuleModel } from "./week";
import { CARD_HEAD, CARD_LABEL, GLYPH, QUIET, SECTION, STROKE } from "./style";

/** A day cell. Its date is a calendar-day marker the site's zone was already
 *  applied to, so it is read back in `CALENDAR_DAY_ZONE`: formatting it in
 *  the site's zone again would shift every cell across midnight. */
function dayOf(day: WeekModuleModel["days"][number]): WeekDay {
  return {
    date: formatDayOfMonth(day.date, CALENDAR_DAY_ZONE),
    state: day.state,
    mark: copy(day.markKey),
  };
}

export function WeekModule(p: {
  week: WeekModuleModel;
  timeZone: string;
  supply?: SupplyStatement;
}): React.JSX.Element {
  const days = p.week.days.map(dayOf);
  // Seven, by type: `readWeek` builds a seven-tuple and the mapping keeps its
  // length, so this is the two facts meeting rather than a cast.
  const [d0, d1, d2, d3, d4, d5, d6] = days;
  const strip: SevenDays | null =
    d0 && d1 && d2 && d3 && d4 && d5 && d6 ? [d0, d1, d2, d3, d4, d5, d6] : null;

  const supplyLine = p.supply === undefined ? null : writtenLine(p.supply.key, p.supply.vars);
  const title = copy("overview.week.title");

  return (
    <section data-testid="overview-week">
      <Card
        state="default"
        title={
          <div className={CARD_HEAD}>
            <span className={CARD_LABEL}>
              <Calendar aria-hidden size={GLYPH} strokeWidth={STROKE} />
              <span className="eyebrow">{title}</span>
            </span>
            {/* A link, not `Btn`: it navigates with no client runtime, and
                the artboard draws it as the quiet accent word. */}
            <a className={CALENDAR_LINK} href={p.week.calendarHref}>
              {copy("overview.week.calendar-link")}
            </a>
          </div>
        }
      >
        <div className={SECTION}>
          {strip === null ? null : <WeekStrip days={strip} label={title} />}
          {supplyLine === null ? null : (
            <p className={QUIET} data-testid="overview-supply">
              {supplyLine}
            </p>
          )}
        </div>
      </Card>
    </section>
  );
}

/** The artboard's "Open calendar →": the accent word at the small rung. */
const CALENDAR_LINK = "text-(length:--t-sm) font-semibold text-primary";
