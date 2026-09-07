// BUILD §2.4 — the AI dot matrix
//
// §4.1 module 2, left card: "dot matrix over those m (rivals' cited rows
// filled gray, customer's row empty red-ringed, `n/{m}` per row; a
// no-AI-answer question = muted cell)". §4.5 tile 3 draws the same visual
// as an Overview tile with "dashed goal dots".
//
// **Three cell states, and a muted cell is never a miss.** §6.2: "render a
// no-AI-answer question as a muted cell, never as a miss." The type has
// three members for that reason — a boolean cannot hold three states, and
// merging `muted` into `not-cited` would count a question nobody was asked
// as a place the customer was ignored.
//
// **The goal dot is not a fourth cell state.** It is a marker drawn in the
// customer's row where a goal exists — the same kind of thing as the
// growth line's goal rule — so the cell vocabulary stays at three and no
// measurement is ever painted in `--chart-goal`.
//
// **The one status colour in the inventory is here, and it is on a
// state.** §4.1 fixes the customer's absent cells as red-ringed and §2.5
// permits exactly that: "Red appears only for *the customer's problem
// being shown to them*". No rival cell can reach it — the ring is selected
// by `identity`, which the caller sets to `you` for one row.
//
// The registry (`design/components.md`) plans this chart over a shared
// cell contract with a registered `AiDotMatrix` custom component. That
// component does not exist in this repository — the component barrel is
// closed at the fifteen daisyUI primitives — so the contract is declared
// here, once, and is the shape the report screen maps onto.
import type React from "react";
import { CHART, CHART_INK, type Box, round, SVG } from "./chart-primitives";
import { SERIES_COLOR, type SeriesKind } from "./series";
import { ChartFrame, Mark } from "./mark";

/** The three states, and only three. */
/** `break` is not a reading (issue #205). It is the column a change marker
 *  stands in — the same dashed rule `GrowthLine` cuts its run at — so the
 *  cells either side are read as two runs against two markets rather than
 *  one row across both (REQ-071 c12). It is never counted: the row's
 *  `count` arrives already written, and the caller does not count it. */
export type AiDotMatrixCellState = "cited" | "not-cited" | "muted" | "break";

/** One row of the matrix. `count` arrives already written — the chart
 *  performs no arithmetic and cannot disagree with the card's own figure. */
export interface AiDotMatrixRow {
  readonly name: string;
  readonly identity: SeriesKind;
  readonly cells: readonly AiDotMatrixCellState[];
  readonly count: string;
}

const WIDTH = 300;
const NAME_X = 66;
const CELLS_X = 72;
const CELLS_RIGHT = 254;
const CELL_GAP = 2;
const TOP = 6;
const ROW_GAP = 7;
const CELL_RADIUS = 3;
/** The red ring, and the dashed goal ring: both heavier than a plain cell
 *  border so they read as a mark rather than an edge. */
const RING_WIDTH = 1.5;
const EDGE_WIDTH = 1;

function cellPaint(
  state: AiDotMatrixCellState,
  identity: SeriesKind,
  ringAbsent: boolean,
): { fill: string; stroke: string; strokeWidth: number; dash?: string } {
  // The break: nothing filled, one dashed hairline in the quiet ink — the
  // same rule `GrowthLine` stands in a broken run's place, so one break
  // reads the same on both of this screen's week-spanning forms. Never a
  // series colour: a third stroke colour would read as a third series.
  if (state === "break") {
    return { fill: SVG.unfilled, stroke: CHART_INK.quiet, strokeWidth: EDGE_WIDTH, dash: SVG.dashBreak };
  }
  if (state === "cited") {
    return { fill: SERIES_COLOR[identity], stroke: SVG.unfilled, strokeWidth: 0 };
  }
  if (state === "muted") {
    return { fill: CHART_INK.sunk, stroke: CHART_INK.line, strokeWidth: EDGE_WIDTH, dash: SVG.dashMuted };
  }
  return identity === "you" && ringAbsent
    ? { fill: SVG.unfilled, stroke: CHART_INK.absentRing, strokeWidth: RING_WIDTH }
    : { fill: CHART_INK.surface, stroke: CHART_INK.line, strokeWidth: EDGE_WIDTH };
}

export function AiDotMatrixChart(p: {
  rows: readonly AiDotMatrixRow[];
  /** The column labels — one per question, in the order the rows'
   *  cells are in. Every cell is identified by this label and its row's
   *  name; identity is never colour-alone (§2.4). */
  questions: readonly string[];
  /** §4.5 tile 3's goal. Where it is given, the customer's shortfall is
   *  drawn as dashed goal dots and their absent cells take no red ring —
   *  the tile leads with the count and the ring would say it twice. */
  goal?: { readonly count: number; readonly name: string };
  label: string;
}): React.JSX.Element {
  const columns = Math.max(p.questions.length, 1);
  const cell = round((CELLS_RIGHT - CELLS_X - (columns - 1) * CELL_GAP) / columns);
  const pitch = round(cell + ROW_GAP);
  const colX = (i: number): number => round(CELLS_X + i * (cell + CELL_GAP));
  const axisY = round(TOP + p.rows.length * pitch);
  const box: Box = { width: WIDTH, height: round(axisY + 16) };

  return (
    <ChartFrame box={box} label={p.label}>
      {p.rows.map((row, r) => {
        const y = round(TOP + r * pitch);
        const cited = row.cells.filter((c) => c === "cited").length;
        // The shortfall to the goal, drawn over the customer's own row.
        let goalDots = row.identity === "you" && p.goal ? Math.max(0, p.goal.count - cited) : 0;
        const ringAbsent = p.goal === undefined;
        return (
          <g key={`row-${row.name}`}>
            <text
              className="num"
              x={NAME_X}
              y={round(y + cell * 0.75)}
              textAnchor={SVG.anchorEnd}
              fontSize={CHART.labelSize}
              fill={row.identity === "you" ? SERIES_COLOR.you : CHART_INK.label}
            >
              {row.name}
            </text>
            {row.cells.map((state, c) => {
              const isGoal = state === "not-cited" && goalDots > 0;
              if (isGoal) goalDots -= 1;
              const paint = isGoal
                ? { fill: SVG.unfilled, stroke: CHART_INK.goal, strokeWidth: RING_WIDTH, dash: SVG.dashMuted }
                : cellPaint(state, row.identity, ringAbsent);
              return (
                <rect
                  key={`cell-${c}`}
                  x={colX(c)}
                  y={y}
                  width={cell}
                  height={cell}
                  rx={CELL_RADIUS}
                  fill={paint.fill}
                  stroke={paint.stroke}
                  strokeWidth={paint.strokeWidth}
                  strokeDasharray={paint.dash}
                />
              );
            })}
            <text
              className="num"
              x={WIDTH}
              y={round(y + cell * 0.75)}
              textAnchor={SVG.anchorEnd}
              fontSize={CHART.labelSize}
              fill={row.identity === "you" ? SERIES_COLOR.you : CHART_INK.label}
            >
              {row.count}
            </text>
          </g>
        );
      })}

      {/* The one axis: the rule the question labels hang under. */}
      <line
        className="rk-axis"
        x1={CELLS_X}
        y1={axisY}
        x2={CELLS_RIGHT}
        y2={axisY}
        stroke={CHART_INK.axis}
        strokeWidth={CHART.axisWidth}
      />

      {p.questions.map((q, c) => (
        <text
          key={`q-${q}`}
          className="num"
          x={round(colX(c) + cell / 2)}
          y={round(axisY + 9)}
          textAnchor={SVG.anchorMiddle}
          fontSize={CHART.nameSize}
          fill={CHART_INK.quiet}
        >
          {q}
        </text>
      ))}

      {p.goal === undefined ? null : (
        <text
          className="num"
          x={WIDTH}
          y={round(axisY + 9)}
          textAnchor={SVG.anchorEnd}
          fontSize={CHART.nameSize}
          fill={CHART_INK.goal}
        >
          {p.goal.name}
        </text>
      )}

      <g>
        {p.rows.flatMap((row, r) =>
          row.cells.map((_, c) => (
            <Mark
              key={`mark-${row.name}-${c}`}
              box={box}
              tip={`${row.name} · ${p.questions[c] ?? ""}`}
              x={colX(c)}
              y={round(TOP + r * pitch)}
              width={cell}
              height={cell}
            />
          )),
        )}
      </g>
    </ChartFrame>
  );
}
