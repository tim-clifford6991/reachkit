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
// **`ResponsiveContainer`, per docs/DESIGN.md's no-overflow rule**: "Every
// Recharts series sits in a `ResponsiveContainer`." The container measures
// the box the tile gives it, so the plot never decides the tile's width.
//
// A `null` reading is a week that was not measured. It is not a zero and it
// is not a break: `connectNulls` joins the measurements either side, which
// is the rule `GrowthLine` already keeps for the same fact (#386). A series
// with nothing measured in it draws no chart at all — axes over nothing read
// as a measurement of zero.
import type React from "react";
import { Line, LineChart, ReferenceDot, ResponsiveContainer, YAxis } from "recharts";
import { SERIES_COLOR, type SeriesKind } from "./series";

const PAINT = { surface: "var(--surface)" } as const;
const KEY = { value: "value" } as const;

/** The plot's height in pixels. A sparkline is a hand-sized drawing (§2.4);
 *  it takes the width its box gives it and states its own height, so a tile
 *  that grows sideways does not grow a chart downwards with it. */
const HEIGHT_PX = 40;

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
  const last = rows.filter((row) => row.value !== null).at(-1);
  if (last === undefined) return null;

  return (
    <figure aria-label={p.label} className="m-0 w-full min-w-0">
      <ResponsiveContainer width="100%" height={HEIGHT_PX}>
        <LineChart data={rows} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
          <YAxis hide domain={[0, (max: number) => Math.max(max, 1)]} />
          <Line
            dataKey={KEY.value}
            connectNulls
            isAnimationActive={false}
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
      </ResponsiveContainer>
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
