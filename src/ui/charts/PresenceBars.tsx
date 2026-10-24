"use client";
// BUILD §2.4 — the presence bars, drawn by Recharts (#550)
//
// Occupancy over the searches measured. Rivals first, the customer last;
// the customer's bar is `--chart-you`, every rival's `--chart-rival`, each on
// a `--color-base-200` track the length of `measured`, each named with its own name and
// `n/m`. Rival props carry no tone, so a rival cannot be made an alarm (§2.5).
//
// Zero is a measurement (§6.6): the customer's `0` is their whole track,
// unfilled and ringed in `--color-error`; a rival's zero is a stub. Neither row is
// dropped.
//
// **Each label is a line of its own, above a full-width bar (#943).** Both
// strings used to be custom `YAxis` ticks. `width="auto"` measures the nodes
// carrying `recharts-cartesian-axis-tick-value` and a custom `tick` renders
// no such node, so the axis took no width and the ticks were drawn outside
// an `<svg>` that carries the UA's `overflow: hidden` — four rivals reading
// `t`, `t`, `g`, `m`. docs/DESIGN.md's 2026-09-20 ruling says what to do
// instead: "A bar gets its own full-width line under its label." So each row
// is a line of HTML above its own one-bar chart, which also gives the label
// that rule's clamp (one line, the whole value on `title`) and leaves the
// ratio unclamped, because a value cut in half is a different value. No axis
// is drawn at all, so no text is left inside the drawing to be cut by it —
// and the labels being on screen is what the old `Tooltip` was for.
import type React from "react";
import { Bar, BarChart, Cell, XAxis, YAxis } from "recharts";
import { SERIES_DRAW } from "@/ui/motion";

/** Theme paint and Recharts keys, named: values, never copy. */
const PAINT = {
  you: "var(--chart-you)",
  rival: "var(--chart-rival)",
  track: "var(--color-base-200)",
  absentRing: "var(--color-error)",
  none: "none",
} as const;
const KEY = {
  vertical: "vertical",
  number: "number",
  category: "category",
  name: "name",
  length: "length",
} as const;

/** One bar. No tone, and no member a severity could travel in. */
export interface PresenceBar {
  readonly name: string;
  readonly value: number;
  /** What stands beside the name; "{value}/{measured}" where none is given. */
  readonly text?: string;
}

interface Row {
  name: string;
  kind: "you" | "rival";
  /** The drawn length: the reading, or the whole track for the ringed row. */
  length: number;
  ringed: boolean;
  ratio: string;
}

/** The track's height, in CSS px — the board's own 10. The chart is exactly
 *  this tall and carries no margin, so the bar *is* the track. */
const BAR_HEIGHT = 10;

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
      ratio: bar.text ?? `${bar.value}/${p.measured}`,
    };
  });
  const domain: [number, number] = [0, Math.max(p.measured, 1)];

  return (
    /* `items-stretch` is not decoration: daisyUI styles a `card`'s `figure`
       as its image area and centres what is inside it, so without this each
       row shrinks to the width of its own label and the "full-width bar"
       the 2026-09-20 ruling asks for is 216px of a 550px card. */
    <figure
      aria-label={p.label}
      className="m-0 flex w-full min-w-0 flex-col items-stretch gap-3"
    >
      {rows.map((row) => (
        <div key={`${row.kind}-${row.name}`} className="flex min-w-0 flex-col gap-1">
          {/* The label's own line. The domain can grow, so it is clamped to
              one with its whole value on `title`; the ratio is a value, so
              it never clamps and the row gives it the width it asks for. */}
          <div className="flex min-w-0 items-baseline gap-2">
            <span
              className="num min-w-0 flex-1 truncate text-sm"
              style={row.kind === "you" ? { color: PAINT.you } : undefined}
              title={row.name}
            >
              {row.name}
            </span>
            <span className="num text-sm whitespace-nowrap">{row.ratio}</span>
          </div>
          <BarChart
            responsive
            layout={KEY.vertical}
            data={[row]}
            barSize={BAR_HEIGHT}
            margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
            style={{ width: "100%", height: BAR_HEIGHT }}
          >
            <XAxis type={KEY.number} hide domain={domain} />
            <YAxis type={KEY.category} dataKey={KEY.name} hide />
            <Bar
              dataKey={KEY.length}
              minPointSize={2.5}
              radius={2}
              {...SERIES_DRAW}
              background={{ fill: PAINT.track, radius: 2 }}
            >
              <Cell
                fill={row.ringed ? PAINT.track : row.kind === "you" ? PAINT.you : PAINT.rival}
                stroke={row.ringed ? PAINT.absentRing : PAINT.none}
                strokeWidth={row.ringed ? 1.5 : 0}
              />
            </Bar>
          </BarChart>
        </div>
      ))}
      <ul className="sr-only">
        {rows.map((row) => (
          <li key={`${row.kind}-${row.name}`}>{`${row.name} · ${row.ratio}`}</li>
        ))}
      </ul>
    </figure>
  );
}
