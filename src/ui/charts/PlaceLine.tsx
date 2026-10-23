"use client";
// A live page's place on its own search, reading by reading, drawn by
// Recharts. Place 1 is at the top, and Google's first page is a shaded band.
// Drawn only from two readings; the readings are also a visually hidden list,
// which is what a screen reader and a server render both get.
import type React from "react";
import { Line, LineChart, ReferenceArea, XAxis, YAxis } from "recharts";
import { SERIES_DRAW } from "@/ui/motion";

const PAINT = { you: "var(--chart-you)", band: "var(--chart-goal)", surface: "var(--color-base-100)" } as const;
const KEY = { name: "name", place: "place", top: "top", none: "none", hidden: "hidden" } as const;

export interface PlaceReading {
  readonly name: string;
  readonly place: number;
}

export function PlaceLine(p: {
  readings: readonly [PlaceReading, PlaceReading, ...PlaceReading[]];
  /** The last place on Google's first page. */
  firstPage: number;
  label: string;
}): React.JSX.Element {
  const deepest = Math.max(p.firstPage + 1, ...p.readings.map((r) => r.place));
  return (
    <figure aria-label={p.label} className="m-0 w-full">
      <LineChart
        responsive
        data={[...p.readings]}
        margin={{ top: 20, right: 16, bottom: 4, left: 16 }}
        style={{ width: "100%", aspectRatio: 300 / 90 }}
      >
        <XAxis dataKey={KEY.name} hide />
        <YAxis hide reversed domain={[1, deepest]} />
        <ReferenceArea y1={1} y2={p.firstPage} fill={PAINT.band} fillOpacity={0.12} stroke={KEY.none} ifOverflow={KEY.hidden} />
        <Line
          dataKey={KEY.place}
          {...SERIES_DRAW}
          stroke={PAINT.you}
          strokeWidth={2.25}
          dot={{ r: 3, fill: PAINT.you, stroke: PAINT.surface, strokeWidth: 2 }}
          activeDot={false}
          label={{ position: KEY.top, fill: PAINT.you, className: "num", fontSize: 12 }}
        />
      </LineChart>
      <ul className="sr-only">
        {p.readings.map((r) => (
          <li key={r.name}>{`${r.name} · ${r.place}`}</li>
        ))}
      </ul>
    </figure>
  );
}
