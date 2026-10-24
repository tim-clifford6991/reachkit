"use client";
// BUILD §2.4 — the growth line, drawn by Recharts (#550)
//
// Area + line in `--chart-you`, the endpoint dot ringed in `--color-base-100` and
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
import { Area, AreaChart, ReferenceDot, ReferenceLine, Tooltip, XAxis, YAxis } from "recharts";
import { SERIES_DRAW } from "@/ui/motion";

/** Theme paint and Recharts keys, named: values, never copy. */
const PAINT = { you: "var(--chart-you)", surface: "var(--color-base-100)", goal: "var(--chart-goal)" } as const;
const KEY = { name: "name", top: "top", target: "insideTopLeft" } as const;
/** The target line's dash, bound to a name: the copy sweep reads a bare
 *  JSX attribute string as product voice, and it is right to. A length in
 *  SVG user units is paint, not a sentence. */
const TARGET_DASH = "4 4";

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

/**
 * A line the series is climbing towards, drawn dashed in `--chart-goal`
 * with its own direct label (DESIGN rule 2: direct labels, no legend).
 *
 * Optional, and the Overview passes none: a week series there is a count
 * with no target, and a dashed line across it would claim a goal the
 * product has not set. The landing's hero passes one, because the band
 * boundary it draws *is* a real threshold (`SCORE_BAND_BOUNDS`).
 *
 * `label` is already a written string when it arrives — this module holds
 * no copy key, only paint.
 */
export interface GrowthTarget {
  readonly value: number;
  readonly label: string;
}

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

export function GrowthLine(
  p: {
    weeks: readonly [GrowthWeek, ...GrowthWeek[]];
    /** Drawn where present; nothing is drawn where it is absent. */
    target?: GrowthTarget;
  } & (
    | { label: string; compact?: false }
    /** A mark beside a figure that already states its values in words: fixed
     *  small, hidden from readers, so it takes no label, tooltip or list. */
    | { label?: never; compact: true }
  )
): React.JSX.Element {
  const compact = p.compact === true;
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
    <figure
      {...(compact ? { "aria-hidden": true, "data-points": p.weeks.length } : { "aria-label": p.label })}
      className={compact ? "m-0 h-9 w-24 flex-none" : "m-0 w-full"}
    >
      <AreaChart
        responsive
        // An aria-hidden mark must hold nothing focusable; the layer makes the svg a tab stop.
        accessibilityLayer={!compact}
        data={rows}
        margin={compact ? { top: 4, right: 4, bottom: 4, left: 4 } : { top: 20, right: 16, bottom: 4, left: 16 }}
        style={compact ? { width: "100%", height: "100%" } : { width: "100%", aspectRatio: 300 / 80 }}
      >
        <XAxis dataKey={KEY.name} hide />
        {/* The target is part of the frame, not an overlay: a reference
            line above the domain's top would be clipped away, and a goal
            the chart cannot draw is worse than no goal. */}
        <YAxis hide domain={[0, (max: number) => Math.max(max, p.target?.value ?? 0, 1)]} />
        {compact ? null : (
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
        )}
        {sizes.map((size, run) => (
          <Area
            key={`run${run}`}
            dataKey={`run${run}`}
            connectNulls
            {...SERIES_DRAW}
            stroke={PAINT.you}
            strokeWidth={2.25}
            fill={PAINT.you}
            fillOpacity={size > 1 && !compact ? 0.1 : 0}
            dot={size === 1 ? { r: 2.2, fill: PAINT.you, fillOpacity: 1, stroke: PAINT.surface, strokeWidth: 2 } : false}
            activeDot={false}
          />
        ))}
        {p.target ? (
          <ReferenceLine
            y={p.target.value}
            stroke={PAINT.goal}
            strokeWidth={1.5}
            strokeDasharray={TARGET_DASH}
            // At the **left** end of the dashed line: the right end is
            // where the series ends, and its own value label sits there.
            label={{ value: p.target.label, position: KEY.target, fill: PAINT.goal, className: "num", fontSize: 11 }}
          />
        ) : null}
        {last ? (
          <ReferenceDot
            x={last.name}
            y={last.value}
            r={3}
            fill={PAINT.you}
            stroke={PAINT.surface}
            strokeWidth={2}
            label={compact ? undefined : { value: last.value, position: KEY.top, fill: PAINT.you, className: "num", fontSize: 12 }}
          />
        ) : null}
      </AreaChart>
      {compact ? null : (
        <ul className="sr-only">
          {rows.map((row) => (
            <li key={row.name}>{row.tip}</li>
          ))}
        </ul>
      )}
    </figure>
  );
}
