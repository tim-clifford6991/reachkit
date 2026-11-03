"use client";
// What each way of getting pages written costs a month, on one scale. Each
// row is a line of HTML (the name and the price as written) above its own
// one-bar chart, the PresenceBars shape: no axis text is drawn inside the SVG.
// A range is a floating bar from its low to its high end; a row with no
// number on the scale has no bar, only a dashed track, drawn in HTML because
// Recharts draws nothing for an empty span.
import type React from "react";
import { Bar, BarChart, Cell, XAxis, YAxis } from "recharts";
import { SERIES_DRAW } from "@/ui/motion";

const PAINT = { you: "var(--chart-you)", rival: "var(--chart-rival)", track: "var(--color-base-200)" } as const;
// On the tall board another product is the series colour, lighter, so ReachKit's solid bar reads apart.
const OTHER_OPACITY = 0.55;
const KEY = { vertical: "vertical", number: "number", category: "category", name: "name", span: "span" } as const;
const BAR_HEIGHT = 10;
const TALL_HEIGHT = 20;

export interface CostRow {
  readonly name: string;
  /** The terms beside the name, in a quieter line. */
  readonly note?: string;
  /** The price as written, never converted; a page that sets its figure in the reading face passes the node. */
  readonly value: string | React.ReactNode;
  /** Low and high end on the scale; `null` where the cost is not money. */
  readonly span: readonly [number, number] | null;
  readonly you?: boolean;
}

/** `tall` is the answer page's board: 20px bars, other products in the series' lavender, the terms under each name. */
export function CostBars(p: { rows: readonly CostRow[]; max: number; tall?: true }): React.JSX.Element {
  const domain: [number, number] = [0, p.max];
  const height = p.tall ? TALL_HEIGHT : BAR_HEIGHT;
  const radius = p.tall ? 6 : 2;
  return (
    <div className="flex w-full min-w-0 flex-col gap-3">
      {p.rows.map((row) => (
        <div key={row.name} className="flex min-w-0 flex-col gap-1">
          <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-2">
            {p.tall ? (
              <span className="flex min-w-0 flex-col text-sm">
                <span className="text-base-content font-bold">{row.name}</span>
                {row.note === undefined ? null : <span className="text-base-content/70 text-xs">{row.note}</span>}
              </span>
            ) : (
              <span className="text-sm">
                <span className="font-semibold" style={row.you ? { color: PAINT.you } : undefined}>
                  {row.name}
                </span>
                {row.note === undefined ? null : <span className="text-base-content/70"> {row.note}</span>}
              </span>
            )}
            <span className={typeof row.value === "string" ? "num num-phrase text-sm" : "text-sm"}>{row.value}</span>
          </div>
          {row.span === null ? (
            <span
              aria-hidden
              className="border-base-content/30 bg-base-200 block border-[1.5px] border-dashed"
              style={{ height, borderRadius: radius }}
            />
          ) : (
            <BarChart
              responsive
              layout={KEY.vertical}
              data={[{ name: row.name, span: [...row.span] }]}
              barSize={height}
              margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
              style={{ width: "100%", height }}
            >
              <XAxis type={KEY.number} hide domain={domain} />
              <YAxis type={KEY.category} dataKey={KEY.name} hide />
              <Bar dataKey={KEY.span} minPointSize={2.5} radius={radius} {...SERIES_DRAW} background={{ fill: PAINT.track, radius }}>
                <Cell fill={row.you || p.tall ? PAINT.you : PAINT.rival} fillOpacity={p.tall && !row.you ? OTHER_OPACITY : 1} />
              </Bar>
            </BarChart>
          )}
        </div>
      ))}
    </div>
  );
}
