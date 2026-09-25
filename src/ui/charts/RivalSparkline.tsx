"use client";
// BUILD §2.4 — the rival-gap sparkline, drawn by Recharts (#550)
//
// §4.5 module 4: "per rival — name · falling sparkline (gray, accent
// endpoint) · `78×` big mono". The line is `--chart-rival`; the endpoint dot
// is the accent, as §4.5 words it.
//
// **The name and the figure are a line of their own, above a full-width
// plot** (#959). They used to share a row with it, in a
// `[minmax(0,1fr)_8rem_auto]` grid: at 390 that left the name about 58px
// and `wrap-anywhere` broke `secondplace.io` mid-word across three lines —
// `secon` / `dplac` / `e.io`. A domain is a value and §2.3 does not break
// one. Nothing was clipped, so the layout checks passed it; it was a
// legibility defect rather than a containment one.
//
// This is the shape #955 gave `PresenceBars` for the same class of problem,
// and adopting it leaves the product **one** pattern for a labelled bar or
// line instead of two: the label clamped to one line with its whole value
// on `title`, the drawing full-width beneath it. The plot gets the width it
// was being squeezed out of, and the name gets a line it fits on.
//
// `value` arrives already written (`78×`, or a plain count), so the chart
// performs no arithmetic and cannot produce an ∞×. No tone and no delta
// badge are accepted (§2.5).
//
// A break is three parts: a `null` cuts the line, a dashed rule in the quiet
// ink marks the cut, and the required `account` is written under the row.
import type React from "react";
import {
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { SERIES_DRAW } from "@/ui/motion";

/** Theme paint and Recharts keys, named: values, never copy. */
const PAINT = {
  rival: "var(--chart-rival)",
  accent: "var(--accent)",
  surface: "var(--surface)",
  axis: "var(--line)",
  quiet: "var(--ink-3)",
  dashBreak: "2 3",
} as const;
const KEY = {
  index: "i",
  value: "value",
  number: "number",
  dataMin: "dataMin",
  dataMax: "dataMax",
} as const;

interface RowProps {
  /** The rival, direct-labelled. */
  readonly name: string;
  /** Already written by the caller. */
  readonly value: string;
  readonly label: string;
}

export type RivalSparklineProps =
  | (RowProps & {
      readonly points: readonly number[];
      readonly account?: never;
    })
  | (RowProps & {
      readonly points: readonly (number | null)[];
      readonly account: string;
    });

interface Point {
  i: number;
  value: number | null;
  tip: string;
}

export function RivalSparkline(p: RivalSparklineProps): React.JSX.Element {
  const readings: readonly (number | null)[] = p.points;
  const data: Point[] = readings.map((value, i) => ({
    i,
    value,
    tip:
      value === null
        ? `${p.name} · ${p.account ?? ""}`
        : `${p.name} · ${value}`,
  }));
  const last = data.filter((pt) => pt.value !== null).at(-1);

  return (
    <div className="grid min-w-0 gap-1">
      {/* The label's own line. The domain can grow, so it is clamped to one
          with its whole value on `title` — never broken mid-token, which is
          what this component used to do. The figure is a value, so it never
          clamps and the row gives it the width it asks for. */}
      <div className="flex min-w-0 items-baseline gap-2">
        <span
          className="min-w-0 flex-1 truncate text-sm font-semibold"
          title={p.name}
        >
          {p.name}
        </span>
        <span className="figure shrink-0 text-2xl">{p.value}</span>
      </div>
      <figure aria-label={p.label} className="m-0 w-full min-w-0">
        <LineChart
          responsive
          data={data}
          margin={{ top: 6, right: 6, bottom: 0, left: 6 }}
          style={{ width: "100%", height: 44 }}
        >
          <XAxis
            dataKey={KEY.index}
            type={KEY.number}
            domain={[KEY.dataMin, KEY.dataMax]}
            tick={false}
            tickLine={false}
            height={4}
            axisLine={{ stroke: PAINT.axis }}
          />
          <YAxis hide domain={[0, (max: number) => Math.max(max, 1)]} />
          <Tooltip
            cursor={false}
            filterNull={false}
            isAnimationActive={false}
            content={({ active, payload }) => {
              const pt = payload?.[0]?.payload as Point | undefined;
              return active && pt ? (
                <p className="num rounded-field bg-base-content px-2 py-1 text-xs text-base-100">
                  {pt.tip}
                </p>
              ) : null;
            }}
          />
          {data.map((pt) =>
            pt.value === null ? (
              <ReferenceLine
                key={`break-${pt.i}`}
                x={pt.i}
                stroke={PAINT.quiet}
                strokeDasharray={PAINT.dashBreak}
              />
            ) : null,
          )}
          <Line
            dataKey={KEY.value}
            {...SERIES_DRAW}
            stroke={PAINT.rival}
            strokeWidth={2}
            dot={false}
            activeDot={false}
          />
          {last ? (
            <ReferenceDot
              x={last.i}
              y={last.value ?? 0}
              r={3}
              fill={PAINT.accent}
              stroke={PAINT.surface}
              strokeWidth={2}
            />
          ) : null}
        </LineChart>
        <ul className="sr-only">
          {data.map((pt) => (
            <li key={pt.i}>{pt.tip}</li>
          ))}
        </ul>
      </figure>
      {p.account === undefined ? null : (
        <p className="m-0 text-xs text-base-content/70">{p.account}</p>
      )}
    </div>
  );
}
