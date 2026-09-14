"use client";
// BUILD §2.4 — the growth line, drawn by Recharts (#550)
//
// Area + line in `--chart-you`, the endpoint dot ringed in `--surface` and
// labelled with its value, no axis and no gridline (#386). Every week keeps
// its column and its tooltip: `name · value`, or `name · account` for a week
// that was not measured.
//
// A week with no reading does not cut the line — `connectNulls` joins the
// measurements either side. A change does (`cuts`, REQ-071 c12): each run
// between changes is its own `<Area>`, so no segment crosses one.
//
// Recharts paints after hydration, so the server renders the frame alone.
// The readings are also written as a visually hidden list, which is what a
// screen reader and a server render both get.
import type React from "react";
import { Area, AreaChart, ReferenceDot, Tooltip, XAxis, YAxis } from "recharts";

/** Theme paint and Recharts keys, named: values, never copy. */
const PAINT = { you: "var(--chart-you)", surface: "var(--surface)" } as const;
const KEY = { name: "name", top: "top" } as const;

/** A week that was measured. */
export interface GrowthMeasuredWeek {
  readonly name: string;
  readonly value: number;
}

/** A week that was not. It carries the account §2.5 asks for. */
export interface GrowthUnmeasuredWeek {
  readonly name: string;
  readonly value: null;
  readonly account: string;
  /** `true` — a change: the weeks either side were measured against
   *  different markets, so the line is cut here. `false` — the line joins
   *  the measured weeks either side. */
  readonly cuts: boolean;
}

export type GrowthWeek = GrowthMeasuredWeek | GrowthUnmeasuredWeek;

interface Row {
  name: string;
  tip: string;
  [run: `run${number}`]: number | null;
}

function isMeasured(w: GrowthWeek): w is GrowthMeasuredWeek {
  return w.value !== null;
}

/** Which run each week's reading belongs to, and how many weeks each run
 *  measured. A change starts a new run only once the current one has a
 *  reading, so a leading change opens no empty run. */
function runsOf(weeks: readonly GrowthWeek[]): { runOf: number[]; sizes: number[] } {
  const runOf: number[] = [];
  const sizes: number[] = [0];
  for (const week of weeks) {
    if (!isMeasured(week) && week.cuts && (sizes.at(-1) ?? 0) > 0) sizes.push(0);
    runOf.push(sizes.length - 1);
    if (isMeasured(week)) sizes[sizes.length - 1] = (sizes.at(-1) ?? 0) + 1;
  }
  return { runOf, sizes };
}

export function GrowthLine(p: {
  weeks: readonly [GrowthWeek, ...GrowthWeek[]];
  label: string;
}): React.JSX.Element {
  const { runOf, sizes } = runsOf(p.weeks);
  const rows: Row[] = p.weeks.map((week, i) => {
    const row: Row = {
      name: week.name,
      tip: isMeasured(week) ? `${week.name} · ${week.value}` : `${week.name} · ${week.account}`,
    };
    sizes.forEach((_, run) => {
      row[`run${run}`] = isMeasured(week) && runOf[i] === run ? week.value : null;
    });
    return row;
  });
  const last = p.weeks.filter(isMeasured).at(-1);

  return (
    <figure aria-label={p.label} className="m-0 w-full">
      <AreaChart
        responsive
        data={rows}
        margin={{ top: 20, right: 16, bottom: 4, left: 16 }}
        style={{ width: "100%", aspectRatio: 300 / 80 }}
      >
        <XAxis dataKey={KEY.name} hide />
        <YAxis hide domain={[0, (max: number) => Math.max(max, 1)]} />
        <Tooltip
          cursor={false}
          filterNull={false}
          isAnimationActive={false}
          content={({ active, payload }) => {
            const row = payload?.[0]?.payload as Row | undefined;
            return active && row ? (
              <p className="num rounded-field bg-base-content px-2 py-1 text-xs text-base-100">{row.tip}</p>
            ) : null;
          }}
        />
        {sizes.map((size, run) => (
          <Area
            key={`run${run}`}
            dataKey={`run${run}`}
            connectNulls
            isAnimationActive={false}
            stroke={PAINT.you}
            strokeWidth={2.25}
            fill={PAINT.you}
            fillOpacity={size > 1 ? 0.1 : 0}
            dot={size === 1 ? { r: 2.2, fill: PAINT.you, fillOpacity: 1, stroke: PAINT.surface, strokeWidth: 2 } : false}
            activeDot={false}
          />
        ))}
        {last ? (
          <ReferenceDot
            x={last.name}
            y={last.value}
            r={3}
            fill={PAINT.you}
            stroke={PAINT.surface}
            strokeWidth={2}
            label={{ value: last.value, position: KEY.top, fill: PAINT.you, className: "num", fontSize: 12 }}
          />
        ) : null}
      </AreaChart>
      <ul className="sr-only">
        {rows.map((row) => (
          <li key={row.name}>{row.tip}</li>
        ))}
      </ul>
    </figure>
  );
}
