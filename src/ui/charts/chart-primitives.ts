// BUILD §2.4 — the chart bounds, written once
//
// §2.4 states its rules as bounds, not as single values: "One axis per
// chart, thin 2–2.5px lines, 3.5–5px endpoint dots with a surface-colored
// ring, faint gridlines at 2–3 values, hover tooltip on every mark
// (fixed-position, ink-on-bg, mono)" and "Inline SVG, hand-sized viewBoxes
// — no chart library."
//
// Every number below sits inside one of those bounds and every chart in
// this directory reads it from here, so the bounds are asserted once
// against the clause rather than five times against five transcriptions.
// These are the design system's own geometry, not product pins: they are
// layout parameters of five components and live with them, the same way
// the calendar grid's track rule lives with the calendar.
//
// **No CSS file, and that is deliberate.** §2.2 admits custom CSS for
// "chart SVGs", but a stylesheet has to be imported by the one root
// document, which is a shared file three in-flight branches are editing.
// The marks paint through SVG presentation attributes instead, and the one
// rule that cannot be an attribute — `:hover` — ships as a `<style>`
// element inside each `<svg>`.

/** One mono character's advance, as a share of the font size. There is no
 *  text metrics API in an SVG the server renders, so every width a chart
 *  reserves for its own text is this ratio × the size × the character
 *  count.
 *
 *  **Measured, and rounded up.** JetBrains Mono's own advance is 0.6em and
 *  the browser draws these labels at about 0.627em — the face that
 *  actually renders is whatever the stack resolves to, and a fallback is
 *  wider. 0.65 is above every value measured on this box (issue #352: a
 *  23-character rival domain was drawn four pixels past a gutter reserved
 *  at 0.6125). Over-reserving costs a hair of plot; under-reserving puts a
 *  value outside the viewBox, which the layout sweep reports — correctly —
 *  as a mark escaping its own box. */
const MONO_ADVANCE_RATIO = 0.65;

/** §2.4's stated bounds, as the geometry five charts draw with. */
export const CHART = {
  /** "thin 2–2.5px lines" — the line charts. */
  lineWidth: 2.25,
  /** "thin 2–2.5px lines" — the sparkline, at the bottom of the band
   *  because its plot is a sixth of the width. */
  sparkLineWidth: 2,
  /** "3.5–5px endpoint dots": SVG takes a radius, §2.4 states a diameter.
   *  4.4 units across. */
  endpointDotRadius: 2.2,
  /** "with a surface-colored ring" — the ring is the dot's own stroke, so
   *  a dot cannot be drawn without one. */
  ringWidth: 2,
  /** "One axis per chart." Each chart draws exactly one line with this
   *  width; the count is asserted, not trusted. */
  axisWidth: 1,
  /** "faint gridlines at 2–3 values" — two values, faint. */
  gridlineWidth: 1,
  gridlineOpacity: 0.7,
  gridlineCount: 2,
  /** Direct labels: name and value, in the mono utility. */
  labelSize: 8.5,
  nameSize: 7.5,
  /** The tooltip: mono, ink-on-bg. */
  tipTextSize: 8,
  tipHeight: 13,
  tipPadX: 4,
  /** One mono character's advance at `tipTextSize`, for sizing the chip
   *  around its own text. */
  tipCharAdvance: 8 * MONO_ADVANCE_RATIO,
  /** The same advance at `labelSize`, for reserving a gutter wide enough
   *  for the longest direct label a chart is given — a matrix row's name
   *  and a bar's name are **domains**, and a domain is a value that is
   *  never shortened to fit (§2.3). */
  labelCharAdvance: 8.5 * MONO_ADVANCE_RATIO,
} as const;

/** The non-series paint. Ink, line and surface only: no `--ok` and no
 *  `--warn` appears anywhere in this directory, and `--bad` appears once —
 *  `absentRing`, below. */
export const CHART_INK = {
  axis: "var(--line)",
  grid: "var(--line)",
  label: "var(--ink-2)",
  /** Provenance and the break rule — §2.5: "always visible but always
   *  quiet". */
  quiet: "var(--ink-3)",
  /** The ring around every endpoint dot (§2.4). */
  surface: "var(--surface)",
  sunk: "var(--sunk)",
  line: "var(--line)",
  /** The goal marker. Not a third series: it marks a distance, never a
   *  measurement, and no data ever paints with it. */
  goal: "var(--chart-goal)",
  /** §4.5's transcription, recorded so nobody later "corrects" it: the
   *  sparkline's endpoint dot is the accent on an otherwise grey rival
   *  row — "falling sparkline (gray, accent endpoint)". */
  accent: "var(--accent)",
  /** The one status colour in the inventory, and it is on a **state**, not
   *  a series: §4.1 fixes the AI matrix as "customer's row empty
   *  red-ringed", which §2.5 permits because red is "the customer's
   *  problem being shown to them". Nothing else in this directory may name
   *  it, and no rival mark can reach it — there is no prop that selects
   *  it. */
  absentRing: "var(--bad)",
  tipFill: "var(--ink)",
  tipText: "var(--bg)",
} as const;

/** SVG presentation tokens, named for the same reason the colours above
 *  are named: the copy sweep over `src/ui/**` presumes every string
 *  literal in a JSX attribute is product voice until something says
 *  otherwise, and an anchor or a dash pattern is paint, not a sentence.
 *  Naming them once leaves the inventory with no bare attribute strings at
 *  all — which is also how the colours are already handled here, so the
 *  file reads the same way throughout. */
export const SVG = {
  anchorMiddle: "middle",
  anchorEnd: "end",
  capRound: "round",
  /** A shape carrying no fill of its own — a ring, or a line. */
  unfilled: "none",
  /** What a tooltip hangs on: present to the pointer, invisible to the
   *  reader. */
  hitArea: "transparent",
  /** The goal rule (§4.5), the break rule (a domain changed), and a muted
   *  cell's edge (§6.2). */
  dashGoal: "3 4",
  dashBreak: "2 3",
  dashMuted: "2 2",
} as const;

/** The one rule §2.4 asks for that an SVG presentation attribute cannot
 *  express. Ships inside every chart's own `<svg>`, so the inventory needs
 *  no entry in the root document's stylesheet list.
 *
 *  The tooltip is **fixed-position**: every mark's chip is drawn at the
 *  same anchor on the chart, so the reading does not move under the
 *  pointer and two marks can never show at once. */
export const CHART_CSS =
  ".rk-tip{opacity:0;pointer-events:none}" +
  ".rk-mark:hover .rk-tip,.rk-mark:focus-visible .rk-tip{opacity:1}";

/** A hand-sized viewBox. Every chart declares its own as literals — §2.4:
 *  "Inline SVG, hand-sized viewBoxes — no chart library." */
export interface Box {
  readonly width: number;
  readonly height: number;
}

/** Evenly spread `n` marks across `[from, to]`, as the x of the i-th. A
 *  single mark sits in the middle rather than on the left edge, so a
 *  one-week series is a chart and not a stub. Returns a function rather
 *  than an array so no caller has to index one and no coordinate can come
 *  back `undefined`. */
export function spreadAt(n: number, from: number, to: number): (i: number) => number {
  if (n <= 1) return () => round((from + to) / 2);
  const step = (to - from) / (n - 1);
  return (i) => round(from + i * step);
}

/** Map a value onto the plot band. `max` of 0 puts everything on the
 *  floor, which is the honest drawing of an all-zero series — never a
 *  division by zero and never an empty frame. */
export function plot(value: number, max: number, top: number, bottom: number): number {
  if (max <= 0) return bottom;
  const clamped = Math.max(0, Math.min(value, max));
  return round(bottom - (clamped / max) * (bottom - top));
}

/** The 2 faint gridlines, as y coordinates inside the plot band. */
export function gridlines(top: number, bottom: number): number[] {
  const band = bottom - top;
  return Array.from({ length: CHART.gridlineCount }, (_, i) => round(bottom - (band * (i + 1)) / (CHART.gridlineCount + 1)));
}

/** The fixed-position tooltip chip's geometry, sized around its own text
 *  and clamped inside the viewBox so a long label cannot leave the box. */
export function tooltipBox(text: string, box: Box): {
  x: number;
  y: number;
  width: number;
  height: number;
  textX: number;
  textY: number;
} {
  const width = round(text.length * CHART.tipCharAdvance + CHART.tipPadX * 2);
  const x = round(Math.max(2, box.width - width - 2));
  const y = 2;
  return {
    x,
    y,
    width,
    height: CHART.tipHeight,
    textX: round(x + CHART.tipPadX),
    textY: round(y + CHART.tipHeight - CHART.tipPadX - 0.5),
  };
}

/** Two decimals. SVG coordinates are floats; the markup a test reads
 *  should not be. */
export function round(n: number): number {
  return Math.round(n * 100) / 100;
}
