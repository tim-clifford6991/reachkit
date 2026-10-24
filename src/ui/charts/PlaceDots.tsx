"use client";
// Where each live page sits in Google this week, as dots along places 1 to
// 100, with where it was the week before as a ring and Google's first page a
// shaded band. Drawn by Recharts; the places are also a visually hidden list.
import type React from "react";
import { LabelList, ReferenceArea, Scatter, ScatterChart, XAxis, YAxis } from "recharts";

const PAINT = { you: "var(--chart-you)", band: "var(--chart-goal)", surface: "var(--color-base-100)", tick: "var(--color-base-content)" } as const;
const KEY = { place: "place", row: "row", number: "number", top: "top", none: "none", hidden: "hidden" } as const;
const TICKS = [1, 10, 30, 50, 70, 100] as const;

export function PlaceDots(p: {
  /** This week's place of each page that holds one. */
  now: readonly number[];
  /** The place each held the week before, where it moved. */
  before: readonly number[];
  /** The last place on Google's first page. */
  firstPage: number;
  label: string;
}): React.JSX.Element {
  const deepest = Math.max(70, ...p.now, ...p.before);
  const ticks = TICKS.filter((tick) => tick <= deepest);
  const dot = (place: number) => ({ place, row: 0 });
  return (
    <figure aria-label={p.label} className="m-0 w-full">
      <ScatterChart responsive margin={{ top: 18, right: 12, bottom: 0, left: 12 }} style={{ width: "100%", height: 76 }}>
        <XAxis
          type={KEY.number}
          dataKey={KEY.place}
          domain={[1, deepest]}
          ticks={[...ticks]}
          tickLine={false}
          axisLine={false}
          tick={{ fill: PAINT.tick, fontSize: 11, className: "num" }}
        />
        <YAxis type={KEY.number} dataKey={KEY.row} domain={[-1, 1]} hide />
        <ReferenceArea x1={1} x2={p.firstPage} fill={PAINT.band} fillOpacity={0.12} stroke={KEY.none} ifOverflow={KEY.hidden} />
        <Scatter data={p.before.map(dot)} fill={PAINT.surface} stroke={PAINT.you} strokeWidth={1.5} isAnimationActive={false} />
        <Scatter data={p.now.map(dot)} fill={PAINT.you} isAnimationActive={false}>
          <LabelList dataKey={KEY.place} position={KEY.top} fill={PAINT.you} fontSize={11} className="num" />
        </Scatter>
      </ScatterChart>
      <ul className="sr-only">
        {p.now.map((place, i) => (
          <li key={i}>{place}</li>
        ))}
      </ul>
    </figure>
  );
}
