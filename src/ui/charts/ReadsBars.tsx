"use client";
// A count per week, one bar each with its number above it and its week below,
// drawn by Recharts. The weeks are also a visually hidden list, which is what
// a screen reader and a server render both get.
import type React from "react";
import { Bar, BarChart, LabelList, XAxis } from "recharts";
import { SERIES_DRAW } from "@/ui/motion";

const PAINT = { you: "var(--chart-you)", ink: "var(--color-base-content)" } as const;
const KEY = { name: "name", count: "count", top: "top" } as const;

export interface WeekCount {
  readonly name: string;
  readonly count: number;
}

export function ReadsBars(p: { weeks: readonly WeekCount[]; label: string }): React.JSX.Element {
  return (
    <figure aria-label={p.label} className="m-0 w-full max-w-56 min-w-0">
      <BarChart
        responsive
        data={[...p.weeks]}
        margin={{ top: 16, right: 4, bottom: 0, left: 4 }}
        style={{ width: "100%", aspectRatio: 200 / 80 }}
      >
        <XAxis dataKey={KEY.name} axisLine={false} tickLine={false} interval={0} tick={{ fontSize: 10, fill: PAINT.ink }} className="num" />
        <Bar dataKey={KEY.count} fill={PAINT.you} radius={[4, 4, 0, 0]} maxBarSize={26} {...SERIES_DRAW}>
          <LabelList dataKey={KEY.count} position={KEY.top} fontSize={11} fill={PAINT.ink} className="num" />
        </Bar>
      </BarChart>
      <ul className="sr-only">
        {p.weeks.map((week) => (
          <li key={week.name}>{`${week.name} · ${week.count}`}</li>
        ))}
      </ul>
    </figure>
  );
}
