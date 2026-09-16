// BUILD §4.5 — the growth chart, and the two footnotes under it.
//
// SPEC §4: trend is 12 trailing weeks, read from stored Monday rows. The
// drawing is `GrowthLine` (Recharts); this file decides what it is handed.
//
// - An unmeasured week is a gap with its own account that does not cut the
//   line (#386); a change marker is a break that does (#205).
// - Week 0 is one point from the deep pass, labelled as such.
// - Nothing measured: no chart, one line and the first-due date.
import type React from "react";
import { TrendingUp } from "lucide-react";
import { GrowthLine, type GrowthWeek } from "@/ui/charts";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { CHANGE_ACCOUNT_KEY } from "./changes";
import { formatDate } from "../_shell/format";
import { writtenLine } from "../_shell/written";
import { GOALS } from "./goals";
import { carriedBy, formatCount, formatMonthDay } from "./present";
import type { GrowthModule as GrowthModuleModel } from "./growth";
import type { Module } from "./model";

const TEST_ID = "overview-growth";
const SOURCE_TEST_ID = "overview-growth-source";
const DELTA_TEST_ID = "overview-growth-delta";
const SEARCHES_LABEL = "overview.tile.searches.label";

function Card(p: {
  source?: string | null;
  /** The change since the previous reading, drawn beside the title. */
  delta?: { markKey: CopyKey; text: string } | null;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <section className="card card-border min-w-0 bg-base-100" data-testid={TEST_ID}>
      <div className="card-body gap-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="card-title text-xs font-semibold uppercase tracking-wide text-base-content/60">
            <TrendingUp aria-hidden size={20} strokeWidth={1.75} />
            {copy(SEARCHES_LABEL)}
            {p.delta === null || p.delta === undefined ? null : (
              <span className="badge badge-success badge-soft" data-testid={DELTA_TEST_ID}>
                <span className="num">{copy(p.delta.markKey)}</span>
                <span className="num">{p.delta.text}</span>
              </span>
            )}
          </h2>
          {p.source === null || p.source === undefined ? null : (
            <span className="badge badge-ghost num" data-testid={SOURCE_TEST_ID}>
              {p.source}
            </span>
          )}
        </div>
        {p.children}
      </div>
    </section>
  );
}

function Footnotes(p: { lines: readonly (string | null)[] }): React.JSX.Element {
  return (
    <div className="flex flex-wrap justify-between gap-2 text-xs text-base-content/60">
      {p.lines.map((line) => (line === null ? null : <p key={line}>{line}</p>))}
    </div>
  );
}

export function GrowthModule(p: {
  growth: GrowthModuleModel;
  /** The searches reading and its week-over-week delta (issue 794). */
  searches?: Module<number>;
  timeZone: string;
}): React.JSX.Element {
  const label = copy(SEARCHES_LABEL);

  if (p.growth.kind === "none") {
    const line = writtenLine("place.overview.weekly-presence.chart");
    return (
      <Card>
        {line === null ? null : <p className="text-sm">{line}</p>}
        <p className="num text-xs text-base-content/60" data-testid="overview-growth-first-due">
          {formatDate(p.growth.firstDueOn, p.timeZone)}
        </p>
      </Card>
    );
  }

  if (p.growth.kind === "week-zero") {
    const point: GrowthWeek = { name: formatMonthDay(p.growth.on, p.timeZone), value: p.growth.value };
    return (
      <Card
        source={writtenLine("overview.growth.source.deep-pass", {
          on: formatDate(p.growth.on, p.timeZone),
        })}
      >
        <div className="w-full min-w-0">
          <GrowthLine weeks={[point]} label={label} />
        </div>
        <Footnotes
          lines={[
            writtenLine("overview.growth.footnote.starting", { value: formatCount(p.growth.value) }),
            writtenLine("overview.growth.footnote.first-monday"),
          ]}
        />
      </Card>
    );
  }

  const unmeasuredAccount = writtenLine("place.overview.weekly-presence.week");
  const weeks = p.growth.entries.map((entry): GrowthWeek => {
    if (entry.kind === "break") {
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

  // `readGrowth` returns the series arm only with at least one measured week.
  const [first, ...rest] = weeks;
  if (first === undefined) return <Card>{null}</Card>;

  const measured = p.growth.points.filter((point) => point.value.kind !== "unmeasured");
  const start = measured[0];
  const newest = measured.at(-1);
  const goal = GOALS.searches_appeared_in;
  // The change since the previous reading, where the model took one. The
  // goal already has its footnote, so only a delta is drawn.
  const carried = p.searches === undefined ? null : carriedBy(p.searches.headline, SEARCHES_LABEL);

  return (
    <Card
      delta={carried?.kind === "delta" ? carried : null}
      source={
        newest === undefined
          ? null
          : writtenLine("overview.growth.source.remeasured", { on: formatDate(newest.weekStart, p.timeZone) })
      }
    >
      <div className="w-full min-w-0">
        <GrowthLine weeks={[first, ...rest]} label={label} />
      </div>
      <Footnotes
        lines={[
          start === undefined || start.value.kind === "unmeasured"
            ? null
            : writtenLine("overview.growth.footnote.start", { value: formatCount(start.value.value) }),
          writtenLine(goal.meansKey, { goal: formatCount(goal.value) }),
        ]}
      />
    </Card>
  );
}
