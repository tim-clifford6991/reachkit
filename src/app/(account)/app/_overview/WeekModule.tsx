// BUILD §4.5 — this week: the seven-day strip, the alerts, the one supply
// statement.
//
// §4.5 item 5, verbatim: "**This week**: 7-day strip (done/today/next) +
// 'Open calendar →' + up to two alerts (today's page pending veto → 'Read
// it'; a needs-you item → action button)."
//
// **Identity is never colour alone.** Every day carries its own date and the
// written word for its state, so the strip says what it means with the
// colours removed (§2.4). The three words are §4.5's own; the model picks
// which, and this file only reads them.
//
// **At most two alerts, each with one control.** The cap is the model's
// (`readAlerts`), so this file cannot raise it — it renders the list it is
// given. Where more exist, the remainder is a written count with where to
// see it, never a third alert.
//
// **One supply statement, never two.** `readSupplyStatement` returns at most
// one key even where all three conditions hold; this file renders the one it
// gets and has no branch that could add a second.
//
// **An empty alert list is a success state, not a blank.** §2.5: "an empty
// queue is a success state". Where nothing is waiting the module states
// `overview.alerts.empty` rather than dropping a region out of the page.
import type React from "react";
import { WeekStrip, type SevenDays, type WeekDay } from "@/ui/charts";
import { Alert as AlertBox } from "@/ui/components";
import { copy } from "@/lib/presentation/copy";
import type { AlertTone } from "@/ui/components";
import { writtenLine } from "../_shell/written";
import { formatCount, formatDayOfMonth } from "./present";
import type { Alert, Overflow } from "./alerts";
import type { SupplyStatement } from "./supply";
import { CALENDAR_DAY_ZONE, type WeekModule as WeekModuleModel } from "./week";
import { ALERT_ROW, CHART_PLATE, EYEBROW, STACK } from "./style";

/** §2.5's third rule: an intended-empty state takes `neutral` or `ok`,
 *  never `bad`/`warn`. An item waiting on the customer is a fact, not an
 *  alarm — so both arms are neutral, and the emptiness is `ok`. */
const WAITING_TONE: AlertTone = "neutral";
const NOTHING_WAITING_TONE: AlertTone = "ok";

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

function AlertRow(p: { alert: Alert }): React.JSX.Element | null {
  const line = writtenLine(p.alert.key, p.alert.vars);
  const action = writtenLine(p.alert.actionKey);
  // An alert whose sentence the owner has not written cannot be stated —
  // and a control with no words on it is not a control. Both are owed
  // together or the row does not render; nothing here composes a stand-in.
  if (line === null || action === null) return null;

  return (
    <div style={ALERT_ROW}>
      <AlertBox tone={WAITING_TONE} message={line} />
      {/* The one control, and a link rather than a `Btn`: it navigates, and
          `Btn` is a `<button>` with an `onClick`. `btn btn-sm` is daisyUI's
          own class pair for exactly this — a link that reads as a button —
          so no widget outside `src/ui/components` is introduced, and the
          shell's own rule holds: navigation that works with no client
          runtime (`SidebarNav`). */}
      <a href={p.alert.href} className="btn btn-sm">
        {action}
      </a>
    </div>
  );
}

export function WeekModule(p: {
  week: WeekModuleModel;
  timeZone: string;
  alerts: readonly Alert[];
  overflow?: Overflow;
  supply?: SupplyStatement;
}): React.JSX.Element {
  const days = p.week.days.map(dayOf);
  // Seven, by type: `readWeek` builds a seven-tuple and the mapping keeps
  // its length, so this is the two facts meeting rather than a cast that
  // could let a six-day strip through.
  const [d0, d1, d2, d3, d4, d5, d6] = days;
  const strip: SevenDays | null =
    d0 && d1 && d2 && d3 && d4 && d5 && d6 ? [d0, d1, d2, d3, d4, d5, d6] : null;

  const rows = p.alerts
    .map((alert) => <AlertRow key={alert.href} alert={alert} />)
    .filter((row): row is React.JSX.Element => row !== null);
  const overflowLine =
    p.overflow === undefined
      ? null
      : writtenLine(p.overflow.whereKey, { remaining: formatCount(p.overflow.remaining) });
  const emptyLine = p.alerts.length === 0 ? writtenLine("overview.alerts.empty") : null;
  const supplyLine = p.supply === undefined ? null : writtenLine(p.supply.key, p.supply.vars);

  return (
    <section className="rk-idiom-card" data-testid="overview-week">
      <p className="eyebrow" style={EYEBROW}>{copy("overview.week.title")}</p>
      {strip === null ? null : (
        <div style={CHART_PLATE}>
          <WeekStrip days={strip} label={copy("overview.week.title")} />
        </div>
      )}
      <a href={p.week.calendarHref}>{copy("overview.week.calendar-link")}</a>
      {supplyLine === null ? null : (
        <p className="rk-prov" data-testid="overview-supply">
          {supplyLine}
        </p>
      )}
      <div style={STACK} data-testid="overview-alerts">
        {rows}
        {emptyLine === null ? null : <AlertBox tone={NOTHING_WAITING_TONE} message={emptyLine} />}
        {overflowLine === null ? null : (
          <p className="rk-prov" data-testid="overview-overflow">
            {overflowLine}
          </p>
        )}
      </div>
    </section>
  );
}
