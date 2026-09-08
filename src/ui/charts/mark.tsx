// BUILD §2.4 — the frame and the tooltip, shared by the five
//
// Lower-case file name on purpose: this is a module of the charts
// directory, not a member of the closed inventory. The inventory test
// reads the PascalCase `.tsx` files, so a sixth chart cannot hide here.
//
// §2.4: "hover tooltip on every mark (fixed-position, ink-on-bg, mono)".
// **Fixed-position** is transcribed literally — every mark's chip is drawn
// at the same anchor on its chart, so the reading does not travel under
// the pointer and two chips can never be on screen at once.
//
// The marks layer is drawn *after* the chart body, so a chip always paints
// over the drawing rather than under a later bar. It carries no colour of
// its own and no data: a mark is a hit area, a `<title>` and a chip, and
// what it says is the same string the drawing already direct-labelled.
import type React from "react";
import { CHART, CHART_CSS, CHART_INK, type Box, tooltipBox, SVG } from "./chart-primitives";

/** The `<svg>` itself. `label` is the caller's — no component in this
 *  directory owns a string, so the accessible name comes from the copy
 *  registry at the call site. */
export function ChartFrame(p: {
  box: Box;
  label: string;
  /** The sparkline's `--w-spark-min` floor: below it the endpoint dot
   *  would scale under §2.4's 3.5px. Only the sparkline needs one. */
  minWidth?: number;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <svg
      viewBox={`0 0 ${p.box.width} ${p.box.height}`}
      role="img"
      aria-label={p.label}
      style={{ width: "100%", height: "auto", display: "block", minWidth: p.minWidth }}
    >
      <style>{CHART_CSS}</style>
      {p.children}
    </svg>
  );
}

/** One mark's hover surface. `tip` is the whole chip text, already the
 *  name and the value the drawing labelled — never a second fact. */
export function Mark(p: {
  box: Box;
  tip: string;
  /** The hit area, in viewBox units. */
  x: number;
  y: number;
  width: number;
  height: number;
}): React.JSX.Element {
  const chip = tooltipBox(p.tip, p.box);
  return (
    <g className="rk-mark" tabIndex={0}>
      <title>{p.tip}</title>
      <rect x={p.x} y={p.y} width={p.width} height={p.height} fill={SVG.hitArea} />
      <g className="rk-tip">
        <rect x={chip.x} y={chip.y} width={chip.width} height={chip.height} rx={3} fill={CHART_INK.tipFill} />
        {/* `textLength` is the fit, not the estimate: the chip is sized
            from `CHART.tipCharAdvance` and the text is then drawn to
            exactly the width that leaves, so a face wider than the estimate
            cannot push a tooltip past the edge of its own viewBox (issue
            #351 — that is a `<g>` escaping its `<svg>`, which the layout
            sweep's check 2 reports). `spacingAndGlyphs` rather than the
            default `spacing`: at a tenth of a unit per character, squeezing
            the glyphs with the gaps is what keeps a mono chip looking
            mono. */}
        <text
          className="num"
          x={chip.textX}
          y={chip.textY}
          fontSize={CHART.tipTextSize}
          fill={CHART_INK.tipText}
          textLength={chip.width - CHART.tipPadX * 2}
          lengthAdjust={SVG.fitGlyphs}
        >
          {p.tip}
        </text>
      </g>
    </g>
  );
}

/** An endpoint dot: §2.4's 3.5–5px, ringed in `--surface` so it reads on
 *  top of its own line. The ring is the stroke, so there is no call shape
 *  that draws an unringed dot. */
export function EndpointDot(p: { cx: number; cy: number; fill: string }): React.JSX.Element {
  return (
    <circle
      cx={p.cx}
      cy={p.cy}
      r={CHART.endpointDotRadius}
      fill={p.fill}
      stroke={CHART_INK.surface}
      strokeWidth={CHART.ringWidth}
    />
  );
}
