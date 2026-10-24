"use client";
// One dot per report along the score axis, in the context series colour: filled
// where the score is findable, a ring below it, so the band is never colour
// alone. Reports too close to read apart are stacked. The written caption
// beside it is what a screen reader and a server render get, so the drawing
// is hidden and takes no focus.
import type React from "react";
import { Cell, Scatter, ScatterChart, XAxis, YAxis, ZAxis } from "recharts";
import { SERIES_COLOR } from "@/ui/charts/series";
import { SERIES_DRAW } from "@/ui/motion";

const GROUND = "var(--color-base-100)";
const KEY = { number: "number", score: "score", row: "row" } as const;
const TICK = { fontSize: 12, fill: "currentColor" } as const;
/** Dots closer than this share of the axis are stacked rather than drawn over each other. */
const APART = 1 / 25;
const DOT_AREA = 180;

export interface StripPoint {
  readonly name: string;
  readonly score: number;
  /** The ring's width; 0 is a filled dot. */
  readonly ring: number;
}

export function ScoreStrip(p: { points: readonly StripPoint[]; low: number; high: number; ticks: readonly number[] }): React.JSX.Element {
  const near = (p.high - p.low) * APART;
  const placed: (StripPoint & { row: number })[] = [];
  for (const point of p.points) {
    const row = placed.filter((other) => Math.abs(other.score - point.score) < near).length;
    placed.push({ ...point, row });
  }
  const rows = Math.max(1, ...placed.map((point) => point.row + 1));
  return (
    <div aria-hidden className="text-base-content/70 w-full min-w-0">
      <ScatterChart responsive accessibilityLayer={false} margin={{ top: 10, right: 10, bottom: 0, left: 10 }} style={{ width: "100%", height: 40 + rows * 20 }}>
        <XAxis type={KEY.number} dataKey={KEY.score} domain={[p.low, p.high]} ticks={[...p.ticks]} tickLine={false} tick={TICK} />
        <YAxis type={KEY.number} dataKey={KEY.row} hide domain={[-0.5, rows - 0.5]} />
        <ZAxis range={[DOT_AREA, DOT_AREA]} />
        <Scatter data={placed} {...SERIES_DRAW}>
          {placed.map((point) => (
            <Cell
              key={point.name}
              fill={point.ring === 0 ? SERIES_COLOR.rival : GROUND}
              stroke={point.ring === 0 ? GROUND : SERIES_COLOR.rival}
              strokeWidth={point.ring === 0 ? 2 : point.ring}
            />
          ))}
        </Scatter>
      </ScatterChart>
    </div>
  );
}
