"use client";
// BUILD §2.4 — the rival-gap sparkline, drawn by Recharts (#550)
//
// §4.5 module 4: "per rival — name · falling sparkline (gray, accent
// endpoint) · `78×` big mono". The row is the component: name, plot, value.
// The line is `--chart-rival`; the endpoint dot is the accent, as §4.5 words
// it.
//
// `value` arrives already written (`78×`, or a plain count), so the chart
// performs no arithmetic and cannot produce an ∞×. No tone and no delta
// badge are accepted (§2.5).
//
// A break is three parts: a `null` cuts the line, a dashed rule in the quiet
// ink marks the cut, and the required `account` is written under the row.
import type React from "react";
import { Line, LineChart, ReferenceDot, ReferenceLine, Tooltip, XAxis, YAxis } from "recharts";

/** Theme paint and Recharts keys, named: values, never copy. */
const PAINT = {
  rival: "var(--chart-rival)",
  accent: "var(--accent)",
  surface: "var(--surface)",
  axis: "var(--line)",
  quiet: "var(--ink-3)",
  dashBreak: "2 3",
} as const;
const KEY = { index: "i", value: "value", number: "number", dataMin: "dataMin", dataMax: "dataMax" } as const;

interface RowProps {
  /** The rival, direct-labelled. */
  readonly name: string;
  /** Already written by the caller. */
  readonly value: string;
  readonly label: string;
}

export type RivalSparklineProps =
  | (RowProps & { readonly points: readonly number[]; readonly account?: never })
  | (RowProps & { readonly points: readonly (number | null)[]; readonly account: string });

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
    tip: value === null ? `${p.name} · ${p.account ?? ""}` : `${p.name} · ${value}`,
  }));
  const last = data.filter((pt) => pt.value !== null).at(-1);

  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-[minmax(0,1fr)_8rem_auto] items-center gap-3">
        <span className="min-w-0 text-sm font-semibold wrap-anywhere">{p.name}</span>
        <figure aria-label={p.label} className="m-0 w-32">
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
                  <p className="num rounded-field bg-base-content px-2 py-1 text-xs text-base-100">{pt.tip}</p>
                ) : null;
              }}
            />
            {data.map((pt) =>
              pt.value === null ? (
                <ReferenceLine key={`break-${pt.i}`} x={pt.i} stroke={PAINT.quiet} strokeDasharray={PAINT.dashBreak} />
              ) : null,
            )}
            <Line
              dataKey={KEY.value}
              isAnimationActive={false}
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
        <span className="num text-2xl font-bold">{p.value}</span>
      </div>
      {p.account === undefined ? null : <p className="m-0 text-xs text-base-content/60">{p.account}</p>}
    </div>
  );
}
