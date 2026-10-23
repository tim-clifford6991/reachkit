"use client";
// What each way of getting pages written costs a month, on one scale. Each
// row is a line of HTML (the name and the price as written) above its own
// one-bar chart, the PresenceBars shape: no axis text is drawn inside the SVG.
// A range is a floating bar from its low to its high end; a row with no
// number on the scale has no bar, only a dashed track.
import type React from "react";
import { Bar, BarChart, Cell, XAxis, YAxis } from "recharts";
import { SERIES_DRAW } from "@/ui/motion";

const PAINT = { you: "var(--chart-you)", rival: "var(--chart-rival)", track: "var(--color-base-200)" } as const;
const KEY = { vertical: "vertical", number: "number", category: "category", name: "name", span: "span" } as const;
const BAR_HEIGHT = 10;
const DASH = "3 3";

export interface CostRow {
  readonly name: string;
  /** The terms beside the name, in a quieter line. */
  readonly note?: string;
  /** The price as written, never converted. */
  readonly value: string;
  /** Low and high end on the scale; `null` where the cost is not money. */
  readonly span: readonly [number, number] | null;
  readonly you?: boolean;
}

export function CostBars(p: { rows: readonly CostRow[]; max: number }): React.JSX.Element {
  const domain: [number, number] = [0, p.max];
  return (
    <div className="flex w-full min-w-0 flex-col gap-3">
      {p.rows.map((row) => (
        <div key={row.name} className="flex min-w-0 flex-col gap-1">
          <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-2">
            <span className="text-sm">
              <span className="font-semibold" style={row.you ? { color: PAINT.you } : undefined}>
                {row.name}
              </span>
              {row.note === undefined ? null : <span className="text-base-content/70"> {row.note}</span>}
            </span>
            <span className="num text-sm">{row.value}</span>
          </div>
          <BarChart
            responsive
            layout={KEY.vertical}
            data={[{ name: row.name, span: row.span === null ? [0, 0] : [...row.span] }]}
            barSize={BAR_HEIGHT}
            margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
            style={{ width: "100%", height: BAR_HEIGHT }}
          >
            <XAxis type={KEY.number} hide domain={domain} />
            <YAxis type={KEY.category} dataKey={KEY.name} hide />
            <Bar
              dataKey={KEY.span}
              minPointSize={row.span === null ? 0 : 2.5}
              radius={2}
              {...SERIES_DRAW}
              background={
                row.span === null
                  ? { fill: PAINT.track, radius: 2, stroke: PAINT.rival, strokeDasharray: DASH }
                  : { fill: PAINT.track, radius: 2 }
              }
            >
              <Cell fill={row.you ? PAINT.you : PAINT.rival} />
            </Bar>
          </BarChart>
        </div>
      ))}
    </div>
  );
}
