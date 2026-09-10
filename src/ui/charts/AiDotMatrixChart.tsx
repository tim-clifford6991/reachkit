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
 *  stands in — the same column `GrowthLine` cuts its run at (#386: there
 *  it is the gap itself, this row draws a hairline) — so the cells either
 *  side are read as two runs against two markets rather than one row
 *  across both (REQ-071 c12). It is never counted: the row's
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

/** The drawing's own width, before the name gutter is measured. */
const WIDTH = 300;
/** The narrowest the name gutter is ever drawn: the width Overview's tile
 *  row and the landing specimen were laid out at, so a chart whose names
 *  fit inside it is drawn exactly as it was before this floor had a name
 *  (issue #352). */
const NAME_X_MIN = 66;
/** Between the longest name and the first cell. */
/** A cushion on top of the measured advance. At the compact band the
 *  whole drawing is scaled to about 0.7, and a glyph rounded up at that
 *  size put a 23-character domain one pixel outside the viewBox with three
 *  units of estimate still spare (issue #352). A few units is under two
 *  pixels of plot at every band and is the difference between a value
 *  inside its box and a sweep finding.
 *
 *  **Six, not three, since the landing draws this chart too** (issue
 *  #351). S1's section 01 renders the same matrix in a narrower card than
 *  the report's, and at 320 the sweep found the row-name group one pixel
 *  outside its `<svg>` again — the estimate is a per-character average and
 *  a shorter box rounds it down further. Three more units cost nothing
 *  visible: the gutter is what shrinks, and it is measured to be wider
 *  than the name it holds either way. */
const NAME_CUSHION = 6;
const NAME_GAP = 6;
/** Between the last cell and the row's written count. */
const COUNT_GAP = 46;
/** Between the written count and the edge of the box. A label anchored
 *  flush with the viewBox is drawn *on* the edge, which the layout sweep's
 *  containment check reads — correctly — as a mark outside its own box. */
const EDGE_INSET = 2;
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
  // The break: nothing filled, one dashed hairline in the quiet ink. A row
  // of cells has no gap to leave — every column is drawn — so the break
  // has to be a cell that reads as one, where `GrowthLine` can simply stop
  // its run (#386). Never a series colour: a third stroke colour would
  // read as a third series.
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

/** The gutter the longest row name needs, never narrower than the floor.
 *
 *  A row name is a **domain** on the report's own module, and §2.3 sets a
 *  domain in the mono face precisely so that it is never shortened: a
 *  23-character rival needs about 121 units where the floor reserves 66,
 *  and text anchored at the end of too small a gutter is drawn to the left
 *  of the viewBox — three `<g>` groups outside their own `<svg>`, which is
 *  what the layout sweep's containment check reports. So the box widens by
 *  what the names need instead. Every other coordinate is measured from
 *  this one, so a chart whose names fit the floor is unmoved. */
function nameGutter(rows: readonly AiDotMatrixRow[]): number {
  const longest = rows.reduce((width, row) => Math.max(width, row.name.length), 0);
  return round(Math.max(NAME_X_MIN, longest * CHART.labelCharAdvance + NAME_CUSHION));
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
  const nameX = nameGutter(p.rows);
  const cellsX = round(nameX + NAME_GAP);
  // The plot keeps its own width whatever the names take, so the cells are
  // the size they were drawn at and only the box around them grows.
  const cellsRight = round(cellsX + (WIDTH - NAME_X_MIN - NAME_GAP - COUNT_GAP));
  const width = round(cellsRight + COUNT_GAP);
  const cell = round((cellsRight - cellsX - (columns - 1) * CELL_GAP) / columns);
  const pitch = round(cell + ROW_GAP);
  const colX = (i: number): number => round(cellsX + i * (cell + CELL_GAP));
  const axisY = round(TOP + p.rows.length * pitch);
  const box: Box = { width, height: round(axisY + 16) };

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
              x={nameX}
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
              x={round(width - EDGE_INSET)}
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
        x1={cellsX}
        y1={axisY}
        x2={cellsRight}
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
          x={round(width - EDGE_INSET)}
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
