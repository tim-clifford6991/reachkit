// Canvas: Dashboard — the searches series, and the two footnotes under it.
//
// The artboard draws this beside the score, inside one card, so this file
// renders the column and `ScoreCard` renders the card around it.
//
// A week that was not measured keeps its column and its mark but draws no
// vertex: the market did not change, so the line joins the measurements
// either side. A change marker does cut the line — the weeks either side
// were measured against different markets.
import type React from "react";
import { GrowthLine, type GrowthWeek } from "@/ui/charts";
import { copy } from "@/lib/presentation/copy";
import { CHANGE_ACCOUNT_KEY } from "./changes";
import { formatDate } from "../_shell/format";
import { writtenLine } from "../_shell/written";
import { GOALS } from "./goals";
import { formatCount, formatMonthDay } from "./present";
import type { GrowthModule as GrowthModuleModel } from "./growth";
import { CHART_BOX, PROV, SCORE_SERIES } from "./style";

/** The chip naming when the series was last measured — the newest week that
 *  actually was, never the window's last entry, which may be a break or a
 *  week that did not run. A date nothing was measured on would be
 *  provenance for a reading the product does not have. */
export function growthSource(growth: GrowthModuleModel, timeZone: string): string | null {
  if (growth.kind === "week-zero") {
    return writtenLine("overview.growth.source.deep-pass", {
      on: formatDate(growth.on, timeZone),
    });
  }
  if (growth.kind !== "series") return null;
  const newest = growth.points.filter((point) => point.value.kind !== "unmeasured").at(-1);
  return newest === undefined
    ? null
    : writtenLine("overview.growth.source.remeasured", {
        on: formatDate(newest.weekStart, timeZone),
      });
}

export function GrowthModule(p: {
  growth: GrowthModuleModel;
  timeZone: string;
}): React.JSX.Element {
  const label = copy("overview.tile.searches.label");

  if (p.growth.kind === "none") {
    const line = writtenLine("place.overview.weekly-presence.chart");
    return (
      <div className={SCORE_SERIES} data-testid="overview-growth">
        <span className="eyebrow">{label}</span>
        {line === null ? null : <p>{line}</p>}
        <p className={PROV} data-testid="overview-growth-first-due">
          {formatDate(p.growth.firstDueOn, p.timeZone)}
        </p>
      </div>
    );
  }

  // One point, from the deep pass. The same `GrowthLine` — a second chart for
  // one point would be a sixth entry in the closed inventory — and what
  // changes is what the card says around it.
  if (p.growth.kind === "week-zero") {
    const point: GrowthWeek = {
      name: formatMonthDay(p.growth.on, p.timeZone),
      value: p.growth.value,
    };
    const starting = writtenLine("overview.growth.footnote.starting", {
      value: formatCount(p.growth.value),
    });
    const firstMonday = writtenLine("overview.growth.footnote.first-monday");
    return (
      <div className={SCORE_SERIES} data-testid="overview-growth">
        <span className="eyebrow">{label}</span>
        <div className={CHART_BOX}>
          <GrowthLine weeks={[point]} label={label} />
        </div>
        <div className={FOOTNOTES}>
          {starting === null ? null : <span className={PROV}>{starting}</span>}
          {firstMonday === null ? null : <span className={PROV}>{firstMonday}</span>}
        </div>
      </div>
    );
  }

  const unmeasuredAccount = writtenLine("place.overview.weekly-presence.week");
  const weeks = p.growth.entries.map((entry): GrowthWeek => {
    if (entry.kind === "break") {
      // The break the change stands in: its name is the date the answer
      // changed, its account the written line naming which answer it was.
      const name = formatMonthDay(entry.marker.on, p.timeZone);
      const account = writtenLine(CHANGE_ACCOUNT_KEY[entry.marker.kind]);
      return { name, value: null, account: account ?? name, cuts: true };
    }
    const point = entry.week;
    const name = formatMonthDay(point.weekStart, p.timeZone);
    return point.value.kind === "unmeasured"
      ? { name, value: null, account: unmeasuredAccount ?? name, cuts: false }
      : { name, value: point.value.value };
  });

  // The chart's type refuses an empty series, and `readGrowth` only returns
  // this arm when at least one week was measured: the two facts meeting.
  const [first, ...rest] = weeks;
  if (first === undefined) return <div className={SCORE_SERIES} data-testid="overview-growth" />;

  const goal = GOALS.searches_appeared_in;
  const startPoint = p.growth.points.find((point) => point.value.kind !== "unmeasured");
  const startLine =
    startPoint === undefined || startPoint.value.kind === "unmeasured"
      ? null
      : writtenLine("overview.growth.footnote.start", {
          value: formatCount(startPoint.value.value),
        });
  const goalLine = writtenLine(goal.meansKey, { goal: formatCount(goal.value) });

  return (
    <div className={SCORE_SERIES} data-testid="overview-growth">
      <span className="eyebrow">{label}</span>
      <div className={CHART_BOX}>
        <GrowthLine weeks={[first, ...rest]} label={label} />
      </div>
      {/* The artboard's footnote pair: the series' first value at one end,
          what reaching the goal unlocks at the other. */}
      <div className={FOOTNOTES}>
        {startLine === null ? null : <span className={PROV}>{startLine}</span>}
        {goalLine === null ? null : <span className={PROV}>{goalLine}</span>}
      </div>
    </div>
  );
}

const FOOTNOTES = "flex min-w-0 flex-wrap items-center justify-between gap-(--s-3)";
