"use client";
// docs/DESIGN.md rule 2 — the small trend beside a number, drawn by Recharts.
//
// SPEC §4 (2026-09-20): the Discoverability Score in the Overview header and
// each of the three linked tiles carry "a trend". This is that drawing and
// nothing else: one series, no axis, no grid, no legend, an endpoint dot in
// the same paint.
//
// **It direct-labels nothing, because the tile already does** (§2.4:
// "identity is never colour-alone"). The name and the value stand beside the
// plot, in the tile's own head and figure, and this chart takes the composed
// name as its `label` so the figure carries it. The readings are also
// written out as a visually hidden list — what a screen reader and a server
// render both get, because Recharts paints only after hydration.
//
// **It sizes itself to the tile, per docs/DESIGN.md's no-overflow rule**:
// "Every Recharts series sits in a `ResponsiveContainer`." Recharts 3's own
// `responsive` prop is that container — "similar to ResponsiveContainer but
// without the need for an extra wrapper component", sized by ordinary CSS —
// and it is the idiom `GrowthLine` and `RivalSparkline` already use (#550).
// The wrapper component is not used here for a measured reason: it renders
// a zero-width sizing probe around the plot, and the layout law's
// containment check reports the chart as escaping that probe at every width.
// Either way the plot never decides the tile's width.
//
// A `null` reading is a week that was not measured. It is not a zero and it
// is not a break: `connectNulls` joins the measurements either side, which
// is the rule `GrowthLine` already keeps for the same fact (#386).
//
// **Fewer than two readings and there is no chart, and no room kept for
// one.** A trend is a statement about movement between two measurements; one
// point is not a trend, and a 40-pixel band of nothing under a number reads
// as a chart that failed to draw. The component answers `null`, so the tile
// closes up around it rather than holding a gap open.
import type React from "react";
import { Line, LineChart, ReferenceDot, YAxis } from "recharts";
import { SERIES_DRAW } from "@/ui/motion";
import { SERIES_COLOR, type SeriesKind } from "./series";

const PAINT = { surface: "var(--color-base-100)" } as const;
const KEY = { value: "value" } as const;

/** The plot's height in pixels. A sparkline is a hand-sized drawing (§2.4);
 *  it takes the width its box gives it and states its own height, so a tile
 *  that grows sideways does not grow a chart downwards with it. */
const HEIGHT_PX = 40;

/** How many readings a line needs before it is one. Two: a trend is the
 *  movement between two measurements, and a single point states no
 *  direction. */
const MIN_READINGS = 2;

interface Row {
  i: number;
  value: number | null;
}

export function TrendSparkline(p: {
  /** Oldest first. `null` is a reading that was not taken. */
  readonly points: readonly (number | null)[];
  /** The figure's accessible name, already composed by the caller. */
  readonly label: string;
  /** Whose reading this is. The customer is the accent; a rival is the
   *  neutral grey (§2.4's two colours, and no third). */
  readonly of?: SeriesKind;
}): React.JSX.Element | null {
  const stroke = SERIES_COLOR[p.of ?? "you"];
  const rows: Row[] = p.points.map((value, i) => ({ i, value }));
  const drawn = rows.filter((row) => row.value !== null);
  const last = drawn.at(-1);
  if (drawn.length < MIN_READINGS || last === undefined) return null;

  return (
    <figure aria-label={p.label} className="m-0 w-full min-w-0">
      <LineChart
        responsive
        data={rows}
        margin={{ top: 4, right: 4, bottom: 4, left: 4 }}
        style={{ width: "100%", height: HEIGHT_PX }}
      >
        <YAxis hide domain={[0, (max: number) => Math.max(max, 1)]} />
        <Line
          dataKey={KEY.value}
          connectNulls
          {...SERIES_DRAW}
          stroke={stroke}
          strokeWidth={2}
          dot={false}
          activeDot={false}
        />
        <ReferenceDot
          x={last.i}
          y={last.value ?? 0}
          r={3}
          fill={stroke}
          stroke={PAINT.surface}
          strokeWidth={2}
        />
      </LineChart>
      {/* The readings, in order. Only the ones that were taken: a week
          nobody measured has no reading to read out, and an empty item
          would be a blank a screen reader announces as one. */}
      <ul className="sr-only">
        {rows
          .filter((row): row is { i: number; value: number } => row.value !== null)
          .map((row) => (
            <li key={row.i}>{String(row.value)}</li>
          ))}
      </ul>
    </figure>
  );
}
