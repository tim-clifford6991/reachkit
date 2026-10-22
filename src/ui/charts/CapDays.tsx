"use client";
// The owner's seven days against the testing cap: one bar a day in the one
// series colour, its value over it, the cap a solid line and the warning a
// dashed one, each labelled on its line; which days crossed them is state,
// and the table says it. The same days are a table beside it, which is what a screen
// reader and a server render get.
import type React from "react";
import { Bar, BarChart, LabelList, ReferenceLine, XAxis, YAxis } from "recharts";
import { SERIES_DRAW } from "@/ui/motion";

const PAINT = { bar: "var(--chart-you)", line: "var(--color-base-content)", ink: "currentColor" } as const;
const KEY = { name: "name", value: "value", figure: "figure", top: "top", label: "insideTopLeft" } as const;
const WARN_DASH = "4 4";
const TICK = { fontSize: 11, fill: PAINT.ink } as const;

export interface CapBar {
  /** The day as its tick reads. */
  readonly name: string;
  readonly value: number;
  /** The value as written over its bar. */
  readonly figure: string;
}

export function CapDays(p: {
  days: readonly CapBar[];
  cap: { value: number; label: string };
  warn: { value: number; label: string };
  label: string;
}): React.JSX.Element {
  const top = Math.max(p.cap.value, ...p.days.map((day) => day.value)) * 1.15;
  return (
    <figure aria-label={p.label} className="m-0 w-full min-w-0 text-base-content/70">
      <BarChart responsive data={[...p.days]} margin={{ top: 20, right: 0, bottom: 0, left: 0 }} style={{ width: "100%", height: 180 }}>
        <XAxis dataKey={KEY.name} tickLine={false} axisLine={false} tick={TICK} interval={0} />
        <YAxis hide domain={[0, top]} />
        <ReferenceLine y={p.cap.value} stroke={PAINT.line} strokeWidth={1.5} label={{ value: p.cap.label, position: KEY.label, ...TICK }} />
        <ReferenceLine
          y={p.warn.value}
          stroke={PAINT.line}
          strokeWidth={1}
          strokeDasharray={WARN_DASH}
          label={{ value: p.warn.label, position: KEY.label, ...TICK }}
        />
        <Bar dataKey={KEY.value} fill={PAINT.bar} radius={3} minPointSize={2} {...SERIES_DRAW}>
          <LabelList dataKey={KEY.figure} position={KEY.top} {...TICK} />
        </Bar>
      </BarChart>
    </figure>
  );
}
