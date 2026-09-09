// BUILD §2.4 — the growth line
//
// §4.5 module 2: "searches-you-appear-in, weekly points, area+line in
// `--chart-you`, endpoint labelled, footnote pair … Hover tooltips."
// §6.6: "Growth chart starts at 0 and that is the story: the line leaving
// the floor" — a `0` is a measurement here, plotted on the floor and
// carrying its own mark, never an error and never a missing point.
//
// **Only the endpoint is labelled** (issue #386). §2.4's general rule
// ("every bar and point direct-labelled (name + value)") and §4.5
// ("endpoint labelled") disagree, and this is the one chart the approved
// set draws for itself: UI-SPEC §2's contract is "area fill under an
// accent line, endpoint dot with surface ring, footnote pair start ·
// goal", and S12's card carries no numeral under any week. UI-SPEC wins
// where the two differ (UI-SPEC §1). The build used to print a numeral and
// a week name under every point; a row of six figures under a line whose
// whole claim is its shape reads as a table someone drew a line over.
//
// The per-point reading is not lost, it moves: every week keeps its mark,
// and a mark's tooltip is `name · value` — §2.4's own "hover tooltip on
// every mark". The series' *first* value is the card's left-hand footnote
// ("started at 12"), which is where S12 puts it, so the two ends of the
// line are both stated in writing and the middle is the drawing.
//
// **An unmeasured week is a break, never an interpolation.** The line is
// cut at that week, the week keeps its own place on the axis and its own
// mark, and the caller must hand over the account of why — a series with
// a hole in it has no call shape without one. Nothing is carried forward:
// joining the week before to the week after would state a measurement that
// was never taken.
//
// The break is the gap itself: **nothing is drawn in its place** (master
// review of #386). A dashed rule up through the plot is not in the
// approved set, and on a card whose whole drawing is one line it reads as
// a second mark competing with it. The two runs ending short of each other
// already say the series stops, and the week's mark says why — its tooltip
// is `name · account`, the written line REQ-065 c3 asks for.
//
// **There is no empty frame.** `weeks` is a non-empty tuple, so "nothing
// measured yet" cannot be drawn as axes over nothing — that reads as a
// measurement of zero, which is a different claim. The caller renders its
// own written line in place of the chart.
import type React from "react";
import { CHART, CHART_INK, type Box, gridlines, plot, round, spreadAt, SVG } from "./chart-primitives";
import { SERIES_COLOR } from "./series";
import { ChartFrame, EndpointDot, Mark } from "./mark";

/** A week that was measured. */
export interface GrowthMeasuredWeek {
  readonly name: string;
  readonly value: number;
}

/** A week that was not. It carries the account §2.5 asks for; the measured
 *  arm has no place to put one, and this one has no value to draw. */
export interface GrowthUnmeasuredWeek {
  readonly name: string;
  readonly value: null;
  readonly account: string;
}

export type GrowthWeek = GrowthMeasuredWeek | GrowthUnmeasuredWeek;

/** Hand-sized (§2.4), and about the set's own 560×150 plate: nothing is
 *  written under the axis any more (#386), so the box ends just below it
 *  and the line fills the card. */
const BOX: Box = { width: 300, height: 90 };
const PLOT_TOP = 24;
const PLOT_BOTTOM = 76;
const AXIS_Y = 84;
const FIRST_X = 24;
const LAST_X = 264;

function isMeasured(w: GrowthWeek): w is GrowthMeasuredWeek {
  return w.value !== null;
}

export function GrowthLine(p: {
  weeks: readonly [GrowthWeek, ...GrowthWeek[]];
  label: string;
}): React.JSX.Element {
  // **No goal marker on the plot** (issue #353). It was a dashed rule
  // across the chart with the goal named at its right end, and the
  // approved set draws no such line: UI-SPEC §2's contract for this chart
  // is "area fill under an accent line, endpoint dot with surface ring,
  // footnote pair start · goal", and S12 states the goal as the right-hand
  // footnote under the card instead. A rule the customer's line sits far
  // below reads as a ceiling on the drawing; the same fact in a written
  // line reads as the distance it is.
  //
  // It also took the y-scale with it. The ceiling was the larger of the
  // goal and the highest week, so a 400 goal against a 41 measurement
  // squashed every real value into the bottom tenth of the plot — the set
  // draws the measured line filling the card, which is the scale below.
  const xAt = spreadAt(p.weeks.length, FIRST_X, LAST_X);
  const measured = p.weeks.filter(isMeasured);
  const ceiling = Math.max(...measured.map((w) => w.value), 1);
  const y = (v: number): number => plot(v, ceiling, PLOT_TOP, PLOT_BOTTOM);

  // One unbroken run per span of measured weeks. A run of a single week
  // still draws its point; it just has no line to be part of.
  interface Pt {
    x: number;
    y: number;
    week: GrowthMeasuredWeek;
  }
  const runs: Pt[][] = [];
  let run: Pt[] = [];
  p.weeks.forEach((week, i) => {
    if (isMeasured(week)) {
      run.push({ x: xAt(i), y: y(week.value), week });
    } else if (run.length > 0) {
      runs.push(run);
      run = [];
    }
  });
  if (run.length > 0) runs.push(run);

  const drawn = runs.flatMap((r) => {
    const first = r[0];
    const end = r[r.length - 1];
    return first && end ? [{ points: r, first, end }] : [];
  });
  const last = drawn.at(-1)?.end;

  return (
    <ChartFrame box={BOX} label={p.label}>
      {gridlines(PLOT_TOP, PLOT_BOTTOM).map((gy) => (
        <line
          key={gy}
          className="rk-grid"
          x1={14}
          y1={gy}
          x2={292}
          y2={gy}
          stroke={CHART_INK.grid}
          strokeWidth={CHART.gridlineWidth}
          opacity={CHART.gridlineOpacity}
        />
      ))}

      {/* The one axis. */}
      <line className="rk-axis" x1={14} y1={AXIS_Y} x2={292} y2={AXIS_Y} stroke={CHART_INK.axis} strokeWidth={CHART.axisWidth} />

      {drawn.map((r) => (
        <g key={`run-${r.first.x}`}>
          {r.points.length > 1 ? (
            <path
              d={`M${r.points.map((pt) => `${pt.x},${pt.y}`).join(" L")} L${r.end.x},${PLOT_BOTTOM} L${r.first.x},${PLOT_BOTTOM} Z`}
              fill={SERIES_COLOR.you}
              opacity={0.1}
            />
          ) : null}
          <polyline
            points={r.points.map((pt) => `${pt.x},${pt.y}`).join(" ")}
            fill={SVG.unfilled}
            stroke={SERIES_COLOR.you}
            strokeWidth={CHART.lineWidth}
            strokeLinecap={SVG.capRound}
            strokeLinejoin={SVG.capRound}
          />
        </g>
      ))}

      {last ? <EndpointDot cx={last.x} cy={last.y} fill={SERIES_COLOR.you} /> : null}

      {/* The one label: the endpoint's value, in the series colour, where
          §4.5 puts it — above the last point. Every other week states its
          name and its value in its mark's tooltip. */}
      {last ? (
        <text
          className="num"
          x={last.x}
          y={round(last.y - 7)}
          textAnchor={SVG.anchorMiddle}
          fontSize={CHART.labelSize}
          fill={SERIES_COLOR.you}
        >
          {last.week.value}
        </text>
      ) : null}

      <g>
        {p.weeks.map((week, i) => (
          <Mark
            key={`mark-${week.name}`}
            box={BOX}
            tip={isMeasured(week) ? `${week.name} · ${week.value}` : `${week.name} · ${week.account}`}
            x={round(xAt(i) - 18)}
            y={PLOT_TOP}
            width={36}
            height={AXIS_Y - PLOT_TOP}
          />
        ))}
      </g>
    </ChartFrame>
  );
}
