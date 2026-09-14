"use client";
// BUILD §2.4 — the presence bars, drawn by Recharts (#550)
//
// Occupancy over the searches measured. Rivals first, the customer last;
// the customer's bar is `--chart-you`, every rival's `--chart-rival`, each on
// a `--sunk` track the length of `measured`, each direct-labelled with its
// name and `n/m`. Rival props carry no tone, so a rival cannot be made an
// alarm (§2.5).
//
// Zero is a measurement (§6.6): the customer's `0` is their whole track,
// unfilled and ringed in `--bad`; a rival's zero is a stub. Neither row is
// dropped.
import type React from "react";
import { Bar, BarChart, Cell, Tooltip, XAxis, YAxis, type YAxisTickContentProps } from "recharts";

/** Theme paint and Recharts keys, named: values, never copy. */
const PAINT = {
  you: "var(--chart-you)",
  rival: "var(--chart-rival)",
  label: "var(--ink-2)",
  track: "var(--sunk)",
  axis: "var(--line)",
  absentRing: "var(--bad)",
  none: "none",
} as const;
const KEY = {
  vertical: "vertical",
  number: "number",
  category: "category",
  name: "name",
  ratio: "ratio",
  length: "length",
  right: "right",
  auto: "auto",
} as const;

/** One bar. No tone, and no member a severity could travel in. */
export interface PresenceBar {
  readonly name: string;
  readonly value: number;
}

interface Row {
  name: string;
  kind: "you" | "rival";
  /** The drawn length: the reading, or the whole track for the ringed row. */
  length: number;
  ringed: boolean;
  ratio: string;
}

const ROW_HEIGHT = 28;

export function PresenceBars(p: {
  /** Drawn last, at the foot of the chart, in the accent (§4.1). */
  you: PresenceBar;
  /** Context, in the order the caller ordered them. */
  rivals: readonly PresenceBar[];
  /** The denominator every bar is drawn against — the searches measured,
   *  not the largest bar. */
  measured: number;
  label: string;
}): React.JSX.Element {
  const rows: Row[] = [
    ...p.rivals.map((bar) => ({ bar, kind: "rival" as const })),
    { bar: p.you, kind: "you" as const },
  ].map(({ bar, kind }) => {
    const ringed = kind === "you" && bar.value <= 0;
    return {
      name: bar.name,
      kind,
      length: ringed ? p.measured : Math.min(Math.max(bar.value, 0), p.measured),
      ringed,
      ratio: `${bar.value}/${p.measured}`,
    };
  });
  const byName = new Map(rows.map((row) => [row.name, row]));
  const tick =
    (field: "name" | "ratio") =>
    function Tick({ x, y, payload, textAnchor }: YAxisTickContentProps) {
      const row = byName.get(String(payload.value));
      return (
        <text
          x={x}
          y={y}
          dy={4}
          textAnchor={textAnchor}
          className="num"
          fontSize={12}
          fill={row?.kind === "you" ? PAINT.you : PAINT.label}
        >
          {row?.[field] ?? String(payload.value)}
        </text>
      );
    };

  return (
    <figure aria-label={p.label} className="m-0 w-full">
      <BarChart
        responsive
        layout={KEY.vertical}
        data={rows}
        barSize={10}
        margin={{ top: 4, right: 4, bottom: 4, left: 4 }}
        style={{ width: "100%", height: rows.length * ROW_HEIGHT + 8 }}
      >
        <XAxis type={KEY.number} hide domain={[0, Math.max(p.measured, 1)]} />
        <YAxis
          yAxisId={KEY.name}
          type={KEY.category}
          dataKey={KEY.name}
          width={KEY.auto}
          interval={0}
          tickLine={false}
          axisLine={{ stroke: PAINT.axis }}
          tick={tick(KEY.name)}
        />
        <YAxis
          yAxisId={KEY.ratio}
          orientation={KEY.right}
          type={KEY.category}
          dataKey={KEY.name}
          width={KEY.auto}
          interval={0}
          tickLine={false}
          axisLine={false}
          tick={tick(KEY.ratio)}
        />
        <Tooltip
          cursor={false}
          isAnimationActive={false}
          content={({ active, payload }) => {
            const row = payload?.[0]?.payload as Row | undefined;
            return active && row ? (
              <p className="num rounded-field bg-base-content px-2 py-1 text-xs text-base-100">
                {`${row.name} · ${row.ratio}`}
              </p>
            ) : null;
          }}
        />
        <Bar
          yAxisId={KEY.name}
          dataKey={KEY.length}
          minPointSize={2.5}
          radius={2}
          isAnimationActive={false}
          background={{ fill: PAINT.track, radius: 2 }}
        >
          {rows.map((row) => (
            <Cell
              key={`${row.kind}-${row.name}`}
              fill={row.ringed ? PAINT.track : row.kind === "you" ? PAINT.you : PAINT.rival}
              stroke={row.ringed ? PAINT.absentRing : PAINT.none}
              strokeWidth={row.ringed ? 1.5 : 0}
            />
          ))}
        </Bar>
      </BarChart>
      <ul className="sr-only">
        {rows.map((row) => (
          <li key={`${row.kind}-${row.name}`}>{`${row.name} · ${row.ratio}`}</li>
        ))}
      </ul>
    </figure>
  );
}
