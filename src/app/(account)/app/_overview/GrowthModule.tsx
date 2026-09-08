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
import { TrendingUp } from "lucide-react";
import { GrowthLine, type GrowthWeek } from "@/ui/charts";
import { copy } from "@/lib/presentation/copy";
import { CHANGE_ACCOUNT_KEY } from "./changes";
import { formatDate } from "../_shell/format";
import { writtenLine } from "../_shell/written";
import { GOALS } from "./goals";
import { formatCount, formatMonthDay } from "./present";
import type { GrowthModule as GrowthModuleModel } from "./growth";
import { CardHead } from "@/ui/idiom";
import { CHART_PLATE, STACK } from "./style";

export function GrowthModule(p: {
  growth: GrowthModuleModel;
  timeZone: string;
}): React.JSX.Element {
  if (p.growth.kind === "none") {
    const line = writtenLine("place.overview.weekly-presence.chart");
    return (
      <section className="rk-idiom-card" data-testid="overview-growth">
        <Head />
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
  // No `overview.goal` chip here since #353: the goal was named twice on
  // this card — once on the plot's dashed rule and once in the right-hand
  // footnote — and the set keeps the footnote. One fact, one place.
  const startPoint = p.growth.points.find((point) => point.value.kind !== "unmeasured");
  const startLine =
    startPoint === undefined || startPoint.value.kind === "unmeasured"
      ? null
      : writtenLine("overview.growth.footnote.start", {
          value: formatCount(startPoint.value.value),
        });
  const goalLine = writtenLine(goal.meansKey, { goal: formatCount(goal.value) });
  // The newest week that was actually measured — never the window's last
  // entry, which may be a break or a week that did not run. A chip naming
  // a date nothing was measured on would be provenance for a reading the
  // product does not have.
  const measured = p.growth.points.filter((point) => point.value.kind !== "unmeasured");
  const newest = measured.at(-1);
  const sourceChip =
    newest === undefined
      ? null
      : writtenLine("overview.growth.source.remeasured", {
          on: formatDate(newest.weekStart, p.timeZone),
        });

  return (
    <section className="rk-idiom-card" data-testid="overview-growth">
      {/* The head, and on the right the chip naming when the series was
          last measured (UI-SPEC S12: "re-measured Mon 1 Sep"). The date is
          the newest measured week's own — the same reading the sidebar's
          domain block states, from the same series. */}
      <Head source={sourceChip} />
      <div style={CHART_PLATE}>
        <GrowthLine
          weeks={[first, ...rest]}
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

/** The card's head. One definition for both arms — the chart arm and the
 *  nothing-measured-yet arm are the same card with different bodies, and a
 *  head written twice is a head that comes to differ. */
function Head(p: { source?: string | null }): React.JSX.Element {
  return (
    <CardHead
      icon={<TrendingUp aria-hidden size={ICON} />}
      eyebrow={copy("overview.tile.searches.label")}
      pill={
        p.source === null || p.source === undefined ? null : (
          <span className="rk-srcchip">{p.source}</span>
        )
      }
    />
  );
}

/** The chip's glyph size — 14px inside `.rk-head-chip`'s 32px square. */
const ICON = 14;
