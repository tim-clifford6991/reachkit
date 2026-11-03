"use client";
// The owner's seven days against the testing cap: one bar a day in the one
// series colour, its value over it in mono, the cap a solid error line and the
// warning a dashed warning one. A threshold is state, not a series (BUILD
// §2.4), so the lines take status colours and the bars never do. Each line is
// labelled on it from `sm`; below that the key under the chart says them. The same days are a table beside it, which is what a screen
// reader and a server render get.
import type React from "react";
import { Bar, BarChart, LabelList, ReferenceLine, XAxis, YAxis } from "recharts";
import { SERIES_DRAW } from "@/ui/motion";

const PAINT = { bar: "var(--chart-you)", cap: "var(--color-error)", warn: "var(--color-warning)", ink: "currentColor" } as const;
const KEY = { name: "name", value: "value", figure: "figure", top: "top", label: "insideTopLeft" } as const;
const WARN_DASH = "4 4";
const TICK = { fontSize: 12, fill: PAINT.ink } as const;
// Days and money are mono (docs/DESIGN.md › type).
const MONO = { ...TICK, fontFamily: "var(--font-mono)" } as const;
// The on-line labels collide at a phone's width; the key under the chart says them there.
const LINE_LABEL = { position: KEY.label, fontSize: 12, fontWeight: 700, className: "max-sm:hidden" } as const;

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
        <XAxis dataKey={KEY.name} tickLine={false} axisLine={false} tick={MONO} interval={0} />
        <YAxis hide domain={[0, top]} />
        <ReferenceLine y={p.cap.value} stroke={PAINT.cap} strokeWidth={1.5} label={{ value: p.cap.label, fill: PAINT.cap, ...LINE_LABEL }} />
        <ReferenceLine
          y={p.warn.value}
          stroke={PAINT.warn}
          strokeWidth={1}
          strokeDasharray={WARN_DASH}
          label={{ value: p.warn.label, fill: PAINT.warn, ...LINE_LABEL }}
        />
        <Bar dataKey={KEY.value} fill={PAINT.bar} radius={3} minPointSize={2} {...SERIES_DRAW}>
          <LabelList dataKey={KEY.figure} position={KEY.top} {...MONO} fontWeight={600} />
        </Bar>
      </BarChart>
    </figure>
  );
}
