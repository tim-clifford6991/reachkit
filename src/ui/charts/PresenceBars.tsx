// BUILD §2.4 — the presence bars
//
// §4.1 module 2, right card: occupancy over the searches actually
// measured. The customer's bar is `--chart-you`, every rival's is
// `--chart-rival`, and there is no third colour and no legend-only mode —
// every bar carries its own name and its own value beside it (§2.4).
//
// **A rival bar cannot be made an alarm.** §2.5: "Rival strength is
// neutral gray, never red." The rival props carry no tone, no size, no
// band and no severity, so there is nothing to put a violation in; the
// colour is read from `SERIES_COLOR` by identity and by nothing else.
//
// **Zero is a measurement, not an error** (§6.6). The customer's `0` is
// drawn as their own track, empty and ringed in `--bad`, with `0/12`
// direct-labelled beside it — the approved screen set's own occupancy row
// (UI-SPEC §2, "rival gray, customer accent, zero row red-ringed, `n/12`
// direct-labelled"). An absent row would say they were never measured,
// which is a different claim; the ring is §2.5's one admitted red — "the
// customer's problem being shown to them" — and no rival mark can reach
// it, because it is selected by identity and by a zero of their own.
//
// **Every bar is drawn on its own track.** The track is `--sunk`, the same
// ground the dot matrix's muted cell stands on, so a short bar reads
// against the length it could have had rather than against the card.
import type React from "react";
import { CHART, CHART_INK, type Box, round, SVG } from "./chart-primitives";
import { SERIES_COLOR } from "./series";
import { ChartFrame, Mark } from "./mark";

/** One bar. No tone, and no member a severity could travel in. */
export interface PresenceBar {
  readonly name: string;
  readonly value: number;
}

const WIDTH = 320;
/** The axis, and the right edge of the name gutter. */
const AXIS_X = 86;
const NAME_X = 82;
const TOP = 10;
const ROW_PITCH = 24;
const BAR_HEIGHT = 10;
/** The longest a bar can be drawn — the width of every row's track; the
 *  value label follows the bar. */
const BAR_MAX = 168;
/** A zero still occupies its row (§6.6): a rival's zero is a hairline
 *  stub, the customer's own is the ringed track. */
const ZERO_STUB = 2.5;
/** The ring around the customer's empty row, and the track's own radius. */
const RING_WIDTH = 1.5;
const BAR_RADIUS = 2;

function barWidth(value: number, max: number): number {
  if (value <= 0 || max <= 0) return ZERO_STUB;
  return round(Math.max(ZERO_STUB, (Math.min(value, max) / max) * BAR_MAX));
}

/** `n/m`, composed here rather than as two SVG children: the denominator
 *  is part of the reading (§2.4 — "every value carries its denominator"),
 *  and a slash written as a JSX child is a string literal in a voice
 *  position. */
function ratio(value: number, measured: number): string {
  return `${value}/${measured}`;
}

export function PresenceBars(p: {
  /** Drawn last, at the foot of the chart, in the accent (§4.1). */
  you: PresenceBar;
  /** Context, in the order the caller ordered them. */
  rivals: readonly PresenceBar[];
  /** The denominator every bar is drawn against — the searches measured,
   *  not the largest bar, so the customer's share of the whole is what the
   *  drawing shows. */
  measured: number;
  label: string;
}): React.JSX.Element {
  const rows: { bar: PresenceBar; kind: "you" | "rival" }[] = [
    ...p.rivals.map((bar) => ({ bar, kind: "rival" as const })),
    { bar: p.you, kind: "you" as const },
  ];
  const box: Box = { width: WIDTH, height: TOP + rows.length * ROW_PITCH + 4 };

  return (
    <ChartFrame box={box} label={p.label}>
      {/* The one axis: the baseline every bar starts from. */}
      <line
        className="rk-axis"
        x1={AXIS_X}
        y1={6}
        x2={AXIS_X}
        y2={box.height - 6}
        stroke={CHART_INK.axis}
        strokeWidth={CHART.axisWidth}
      />

      {rows.map((row, i) => {
        const y = TOP + i * ROW_PITCH;
        const w = barWidth(row.bar.value, p.measured);
        const colour = SERIES_COLOR[row.kind];
        // The customer's own empty row: the track, ringed, and no fill.
        // Never a rival's — `kind` is the only thing that selects it.
        const ringed = row.kind === "you" && row.bar.value <= 0;
        return (
          <g key={`${row.kind}-${row.bar.name}`}>
            <text
              className="num"
              x={NAME_X}
              y={y + 8}
              textAnchor={SVG.anchorEnd}
              fontSize={CHART.labelSize}
              fill={row.kind === "you" ? colour : CHART_INK.label}
            >
              {row.bar.name}
            </text>
            <rect
              x={AXIS_X}
              y={y}
              width={BAR_MAX}
              height={BAR_HEIGHT}
              rx={BAR_RADIUS}
              fill={CHART_INK.sunk}
              stroke={ringed ? CHART_INK.absentRing : SVG.unfilled}
              strokeWidth={ringed ? RING_WIDTH : 0}
            />
            {ringed ? null : (
              <rect x={AXIS_X} y={y} width={w} height={BAR_HEIGHT} rx={BAR_RADIUS} fill={colour} />
            )}
            <text
              className="num"
              x={round(AXIS_X + BAR_MAX + 4)}
              y={y + 8}
              fontSize={CHART.labelSize}
              fill={row.kind === "you" ? colour : CHART_INK.label}
            >
              {ratio(row.bar.value, p.measured)}
            </text>
          </g>
        );
      })}

      <g>
        {rows.map((row, i) => (
          <Mark
            key={`mark-${row.kind}-${row.bar.name}`}
            box={box}
            tip={`${row.bar.name} · ${ratio(row.bar.value, p.measured)}`}
            x={AXIS_X}
            y={TOP + i * ROW_PITCH - 3}
            width={WIDTH - AXIS_X}
            height={BAR_HEIGHT + 6}
          />
        ))}
      </g>
    </ChartFrame>
  );
}
