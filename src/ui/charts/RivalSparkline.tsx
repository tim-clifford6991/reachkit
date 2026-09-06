// BUILD §2.4 — the rival-gap sparkline
//
// §4.5 module 4: "per rival — name · falling sparkline (gray, accent
// endpoint) · `78×` big mono". The row is the component, not just the
// plot: a 120×32 drawing has nowhere to carry a name or a value, and §2.4
// requires both, so the three areas — name, plot, value — are one grid and
// the plot column is floored so the endpoint dot cannot scale under
// §2.4's 3.5px.
//
// **The accent endpoint is transcribed, not a slip.** The line is
// `--chart-rival` and the one mark on a rival's row carrying the
// customer's colour is the endpoint dot, exactly as §4.5 words it.
// Recorded here so nobody later "corrects" it.
//
// **The chart never divides.** `value` arrives already written — `78×`,
// or a plain count on the arm §6.6 reserves for a customer whose own count
// is 0 ("never a ratio … division by zero renders as ∞× and reads as
// broken"). Which arm is showing is therefore data, not a prop, and an
// ∞× has no code path here to come out of.
//
// **No tone, and no delta badge.** The props accept neither: §2.5's
// "rival strength is neutral gray, never red" and the rule that a
// direction may not be computed across a break are held by there being no
// prop to break them with. A `was 276×` badge is a `Badge` at the call
// site, on a state, beside the chart.
//
// **A break is three parts, not one.** A domain change cuts the series;
// the cut is a dashed rule in the quiet ink (never a series colour — a
// third stroke colour reads as a third series); and the account of it is
// required, written beside the row, because the plot has no room for a
// sentence.
import type React from "react";
import { CHART, CHART_INK, type Box, plot, round, spreadAt, SVG } from "./chart-primitives";
import { SERIES_COLOR } from "./series";
import { ChartFrame, EndpointDot, Mark } from "./mark";

const BOX: Box = { width: 132, height: 44 };
const PLOT_LEFT = 6;
const PLOT_RIGHT = 126;
const PLOT_TOP = 10;
const PLOT_BOTTOM = 34;
const AXIS_Y = 38;
/** `--w-spark-min`: below this the endpoint dot scales under 3.5px. */
const PLOT_MIN_PX = 128;
const BREAK_WIDTH = 1;
/** Half a mark's hit area. The band is clamped to the viewBox below: a hit
 *  area that ran past the edge put the marks layer outside the drawing's own
 *  box, which the layout sweep reads — correctly — as content escaping its
 *  container. */
const MARK_HALF_WIDTH = 8;

interface Row {
  /** The rival, direct-labelled. */
  readonly name: string;
  /** Already written by the caller. The chart performs no arithmetic on
   *  it and cannot produce one of its own. */
  readonly value: string;
  readonly label: string;
}

export type RivalSparklineProps =
  | (Row & { readonly points: readonly number[]; readonly account?: never })
  | (Row & { readonly points: readonly (number | null)[]; readonly account: string });

export function RivalSparkline(p: RivalSparklineProps): React.JSX.Element {
  // One reading of the two prop arms, so the drawing below is written
  // once: a series with no break is the same series with no nulls in it.
  const points: readonly (number | null)[] = p.points;
  const xAt = spreadAt(points.length, PLOT_LEFT, PLOT_RIGHT);
  const ceiling = Math.max(...points.filter((v): v is number => v !== null), 1);

  interface Pt {
    x: number;
    y: number;
    value: number;
  }
  const runs: Pt[][] = [];
  let run: Pt[] = [];
  points.forEach((value, i) => {
    if (value !== null) {
      run.push({ x: xAt(i), y: plot(value, ceiling, PLOT_TOP, PLOT_BOTTOM), value });
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
    <div style={{ display: "grid", gap: "0.75rem" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `minmax(0, 1fr) minmax(${PLOT_MIN_PX}px, ${PLOT_MIN_PX}px) auto`,
          gap: "0.75rem",
          alignItems: "center",
        }}
      >
        {/* `minWidth: 0` and `overflowWrap` together: a grid item's default
            `min-width: auto` refuses to shrink below its content, and a
            domain carries no space to wrap at — so without both, a long
            rival name overflows its own column at the compact band
            (ADR-093 decision 3: content fits its box or the box changes;
            text is never shrunk to fit). */}
        <span style={{ fontSize: "13px", fontWeight: 600, minWidth: 0, overflowWrap: "anywhere" }}>
          {p.name}
        </span>
        <ChartFrame box={BOX} label={p.label} minWidth={PLOT_MIN_PX}>
          {/* The one axis. */}
          <line
            className="rk-axis"
            x1={PLOT_LEFT}
            y1={AXIS_Y}
            x2={PLOT_RIGHT}
            y2={AXIS_Y}
            stroke={CHART_INK.axis}
            strokeWidth={CHART.axisWidth}
          />

          {drawn.map((r) => (
            <polyline
              key={`run-${r.first.x}`}
              points={r.points.map((pt) => `${pt.x},${pt.y}`).join(" ")}
              fill={SVG.unfilled}
              stroke={SERIES_COLOR.rival}
              strokeWidth={CHART.sparkLineWidth}
              strokeLinecap={SVG.capRound}
              strokeLinejoin={SVG.capRound}
            />
          ))}

          {points.map((value, i) =>
            value !== null ? null : (
              <line
                key={`break-${i}`}
                x1={xAt(i)}
                y1={PLOT_TOP}
                x2={xAt(i)}
                y2={PLOT_BOTTOM}
                stroke={CHART_INK.quiet}
                strokeWidth={BREAK_WIDTH}
                strokeDasharray={SVG.dashBreak}
              />
            ),
          )}

          {last ? <EndpointDot cx={last.x} cy={last.y} fill={CHART_INK.accent} /> : null}

          <g>
            {points.map((value, i) => (
              <Mark
                key={`mark-${i}`}
                box={BOX}
                tip={value === null ? `${p.name} · ${p.account ?? ""}` : `${p.name} · ${value}`}
                x={round(Math.max(0, xAt(i) - MARK_HALF_WIDTH))}
                y={PLOT_TOP}
                width={round(
                  Math.min(BOX.width, xAt(i) + MARK_HALF_WIDTH) -
                    Math.max(0, xAt(i) - MARK_HALF_WIDTH)
                )}
                height={AXIS_Y - PLOT_TOP}
              />
            ))}
          </g>
        </ChartFrame>
        <span className="num" style={{ fontSize: "20px", fontWeight: 700 }}>
          {p.value}
        </span>
      </div>
      {p.account === undefined ? null : (
        <p style={{ margin: 0, fontSize: "11px", color: CHART_INK.quiet }}>{p.account}</p>
      )}
    </div>
  );
}
