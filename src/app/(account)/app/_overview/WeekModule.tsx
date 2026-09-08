// BUILD §4.5 · UI-SPEC S12 — this week: the seven-day strip, and the one
// supply statement.
//
// §4.5 item 5, verbatim: "**This week**: 7-day strip (done/today/next) +
// 'Open calendar →' + up to two alerts (today's page pending veto → 'Read
// it'; a needs-you item → action button)."
//
// **The alerts are their own card since #353.** The approved set draws two
// cards where §4.5 wrote one region: "This week" (the strip, with the
// calendar control in its head) and "Needs you" (the tinted panels). The
// set is the newer owner artifact and this file follows it — see
// `NeedsYouModule.tsx`, which is where the alerts, the overflow count and
// the empty state moved. What stays here is the week itself and the supply
// statement, which is a fact about this week's pages rather than something
// waiting on the customer.
//
// **Identity is never colour alone.** Every day carries its own date and the
// written word for its state, so the strip says what it means with the
// colours removed (§2.4). The three words are §4.5's own; the model picks
// which, and this file only reads them.
//
// **One supply statement, never two.** `readSupplyStatement` returns at most
// one key even where all three conditions hold; this file renders the one it
// gets and has no branch that could add a second.
import type React from "react";
import { Calendar } from "lucide-react";
import { WeekStrip, type SevenDays, type WeekDay } from "@/ui/charts";
import { copy } from "@/lib/presentation/copy";
import { CardHead } from "@/ui/idiom";
import { writtenLine } from "../_shell/written";
import { formatDayOfMonth } from "./present";
import type { SupplyStatement } from "./supply";
import { CALENDAR_DAY_ZONE, type WeekModule as WeekModuleModel } from "./week";
import { CHART_PLATE } from "./style";

/** A day cell. Its date is a calendar-day marker the site's zone was
 *  already applied to (`readWeek`), so it is read back in
 *  `CALENDAR_DAY_ZONE` — formatting it in the site's zone a second time
 *  would shift every cell back across midnight.
 *
 *  A cell is a seventh of a 300-unit viewBox and the strip is one named
 *  week, so the label is the day of the month: a full date drawn there is
 *  wider than its own cell and is clipped by the `<svg>`, which prints a
 *  date the reader cannot finish. The month is the module's own heading's
 *  to carry. */
function dayOf(day: WeekModuleModel["days"][number]): WeekDay {
  return {
    date: formatDayOfMonth(day.date, CALENDAR_DAY_ZONE),
    state: day.state,
    // The written word for the state. All three are filled, so a strip
    // never renders a day whose mark is missing.
    mark: copy(day.markKey),
  };
}

export function WeekModule(p: {
  week: WeekModuleModel;
  timeZone: string;
  supply?: SupplyStatement;
}): React.JSX.Element {
  const days = p.week.days.map(dayOf);
  // Seven, by type: `readWeek` builds a seven-tuple and the mapping keeps
  // its length, so this is the two facts meeting rather than a cast that
  // could let a six-day strip through.
  const [d0, d1, d2, d3, d4, d5, d6] = days;
  const strip: SevenDays | null =
    d0 && d1 && d2 && d3 && d4 && d5 && d6 ? [d0, d1, d2, d3, d4, d5, d6] : null;

  const supplyLine = p.supply === undefined ? null : writtenLine(p.supply.key, p.supply.vars);
  const title = copy("overview.week.title");

  return (
    <section className="rk-idiom-card" data-testid="overview-week">
      <CardHead
        icon={<Calendar aria-hidden size={ICON} />}
        eyebrow={title}
        // The set puts the calendar control in the head, right-aligned and
        // quiet: it leaves the screen, and the screen's one solid fill is
        // spent on the veto panel's "Read it" (§9.1). A link rather than
        // `Btn`, because it navigates with no client runtime — the same
        // case `component-registry.test.ts` carries this file's row for.
        pill={
          <a className="btn btn-sm btn-ghost rk-btn-tertiary rk-pill" href={p.week.calendarHref}>
            {copy("overview.week.calendar-link")}
          </a>
        }
      />
      {strip === null ? null : (
        <div style={CHART_PLATE}>
          <WeekStrip days={strip} label={title} />
        </div>
      )}
      {supplyLine === null ? null : (
        <p className="rk-quiet" data-testid="overview-supply">
          {supplyLine}
        </p>
      )}
    </section>
  );
}

/** The chip's glyph, at the size `.rk-head-chip` draws it — 14px inside a
 *  32px square, which is the idiom's own proportion (`idiom.css` §2). */
const ICON = 14;
