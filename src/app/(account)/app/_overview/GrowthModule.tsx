// BUILD §4.5 — the growth chart, and the two footnotes under it.
//
// §4.5 item 2: "searches-you-appear-in, weekly points, area+line in
// `--chart-you`, endpoint labelled, footnote pair: start value · 'At 400 the
// big category terms unlock.'" The drawing is `GrowthLine`'s (§2.4's closed
// inventory); what this file decides is what it is handed.
//
// **An unmeasured week arrives as a break with its own account.** The chart
// requires one — a `GrowthWeek` with a `null` value has no call shape
// without an `account` string — so the week that did not run carries
// REQ-065 c3's own line, and the chart cuts the run there rather than
// joining across it. Where the owner has not written that line yet the week
// still renders as a break; what it cannot do is borrow the week before's
// value.
//
// **A change marker is a break with a name** (REQ-071 c12, issue #205).
// `readGrowth` hands over `entries`, which are the window's weeks with a
// break standing wherever a change fell between two of them; the break
// becomes a column with no value, which is the shape `GrowthLine` already
// cuts its run at. So the series before and after a change are two runs,
// never joined — and §2.4's inventory gains no sixth chart.
//
// **Where nothing has been measured there is no chart.** The `none` arm
// renders one written line and the date the first measurement is due — the
// same date the shell's domain block states, because both read the one
// `firstDueOn` they were handed.
import type React from "react";
import { GrowthLine, type GrowthWeek } from "@/ui/charts";
import { copy } from "@/lib/presentation/copy";
import { CHANGE_ACCOUNT_KEY } from "./changes";
import { formatDate } from "../_shell/format";
import { writtenLine } from "../_shell/written";
import { GOALS } from "./goals";
import { formatCount, formatMonthDay } from "./present";
import type { GrowthModule as GrowthModuleModel } from "./growth";
import { CHART_PLATE, STACK } from "./style";

export function GrowthModule(p: {
  growth: GrowthModuleModel;
  timeZone: string;
}): React.JSX.Element {
  if (p.growth.kind === "none") {
    const line = writtenLine("place.overview.weekly-presence.chart");
    return (
      <section className="rk-idiom-card" data-testid="overview-growth">
        <div style={STACK}>
          {line === null ? null : <p>{line}</p>}
          <p className="rk-prov" data-testid="overview-growth-first-due">
            {formatDate(p.growth.firstDueOn, p.timeZone)}
          </p>
        </div>
      </section>
    );
  }

  const unmeasuredAccount = writtenLine("place.overview.weekly-presence.week");
  const weeks = p.growth.entries.map((entry): GrowthWeek => {
    if (entry.kind === "break") {
      // The break the change stands in. Its name is the date the answer
      // changed — the same date every number beside it is read against —
      // and its account is the written line naming which answer it was.
      const name = formatMonthDay(entry.marker.on, p.timeZone);
      const account = writtenLine(CHANGE_ACCOUNT_KEY[entry.marker.kind]);
      return { name, value: null, account: account ?? name };
    }
    // The week's own name, in the room a weekly column leaves it (see
    // `formatMonthDay`). The full date the measurement carries is in the
    // mark's tooltip, and the chart's own footnotes state the rest.
    const point = entry.week;
    const name = formatMonthDay(point.weekStart, p.timeZone);
    return point.value.kind === "unmeasured"
      ? { name, value: null, account: unmeasuredAccount ?? name }
      : { name, value: point.value.value };
  });

  // The chart's own type refuses an empty series; `readGrowth` only returns
  // the `series` arm when at least one week was measured, so this narrowing
  // is the two facts meeting rather than a check for something that can
  // happen.
  const [first, ...rest] = weeks;
  if (first === undefined) return <section className="rk-idiom-card" data-testid="overview-growth" />;

  const goal = GOALS.searches_appeared_in;
  const goalText = copy("overview.goal", { value: formatCount(goal.value) });
  const startPoint = p.growth.points.find((point) => point.value.kind !== "unmeasured");
  const startLine =
    startPoint === undefined || startPoint.value.kind === "unmeasured"
      ? null
      : writtenLine("overview.growth.footnote.start", {
          value: formatCount(startPoint.value.value),
        });
  const goalLine = writtenLine(goal.meansKey, { goal: formatCount(goal.value) });

  return (
    <section className="rk-idiom-card" data-testid="overview-growth">
      <div style={CHART_PLATE}>
        <GrowthLine
          weeks={[first, ...rest]}
          goal={{ value: goal.value, name: goalText }}
          label={copy("overview.tile.searches.label")}
        />
      </div>
      <div style={STACK}>
        {startLine === null ? null : <p className="rk-prov">{startLine}</p>}
        {goalLine === null ? null : <p className="rk-prov">{goalLine}</p>}
      </div>
    </section>
  );
}
