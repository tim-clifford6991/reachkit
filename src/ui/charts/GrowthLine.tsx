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
// **The line runs to its last measured week, and the end dot sits on that
// vertex** (master review of #386, third pass). The set draws the line as
// the whole plot with the dot on its end; a dot and a numeral standing far
// to the right of where the line stops read as a drawing that has lost its
// own series.
//
// So a week with **no reading of its own does not cut the line**. It keeps
// its column and its mark — the mark's tooltip is `name · account`, the
// written line REQ-065 c3 asks for — but the drawing puts no vertex over
// it and the line joins the measurements either side. Nothing is stated
// for that week: no point, no numeral, and (since this chart draws no rule
// of any kind) no axis or gridline to read a height against. No figure is
// produced for it and no earlier week's figure stands in its place, which
// is what c3 forbids.
//
// **What does cut the line is a change** (REQ-071 c12): the weeks either
// side were measured against different markets, so a segment joining them
// would draw movement nobody measured. That is the one break, and the
// caller says which kind of gap it is handing over — `cuts`. Nothing is
// drawn in a cut's place either: a dashed rule up through the plot is not
// in the approved set, and on a card whose whole drawing is one line it
// reads as a second mark competing with it.
//
// **No rule of any kind: no axis, and no gridlines** (master review of
// #386, second pass). §2.4 states "One axis per chart … faint gridlines at
// 2–3 values" as the inventory's general geometry, and the other four
// charts keep both. This one does not: UI-SPEC §2's contract for it is
// "area fill under an accent line, endpoint dot with surface ring,
// footnote pair start · goal", the set's `areaChart()` draws no rule at
// all, and UI-SPEC wins where the two differ (UI-SPEC §1). Three
// horizontals under one thin line was the set's card with a grid laid over
// it. The BUILD §2.4 amendment is owed by the corpus, not by this file.
//
// **There is no empty frame.** `weeks` is a non-empty tuple, so "nothing
// measured yet" cannot be drawn as axes over nothing — that reads as a
// measurement of zero, which is a different claim. The caller renders its
// own written line in place of the chart.
import type React from "react";
import { CHART, type Box, plot, round, spreadAt, SVG } from "./chart-primitives";
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
  /** Whether the line is cut here.
   *
   *  `false` — the ordinary week that simply was not measured. There is no
   *  reading for it, but the weeks either side were measured against the
   *  same market, so the line joins them and draws no vertex over this
   *  column. The week still holds its place and its mark.
   *
   *  `true` — a change (REQ-071 c12). The weeks either side were measured
   *  against different markets and a segment across them would draw
   *  movement nobody measured, so the run ends here and the next begins
   *  after. */
  readonly cuts: boolean;
}

export type GrowthWeek = GrowthMeasuredWeek | GrowthUnmeasuredWeek;

/** Hand-sized (§2.4), at about the set's own 560×150 plate's proportions.
 *  Nothing is drawn outside the plot band any more (#386) — no label rows,
 *  no axis, no gridlines — so the box is the band, the headroom its
 *  endpoint label needs, and a hair of floor under the fill. */
const BOX: Box = { width: 300, height: 80 };
/** The headroom is the endpoint label's, which is drawn seven units above
 *  the highest the line can reach. */
const PLOT_TOP = 24;
const PLOT_BOTTOM = 76;
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

  // One unbroken run per span of weeks the line may cross. A week with no
  // reading is skipped — no vertex, no cut — so the run reaches the last
  // measured week; a change ends the run where it falls. A run of a single
  // week still draws its point; it just has no line to be part of.
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
    } else if (week.cuts && run.length > 0) {
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
            height={PLOT_BOTTOM - PLOT_TOP}
          />
        ))}
      </g>
    </ChartFrame>
  );
}
