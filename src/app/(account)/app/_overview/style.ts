// BUILD §4.5 — where Overview's modules sit, and nothing about how they look.
//
// **No stylesheet, deliberately.** §2.2 closes custom CSS at five surfaces —
// "the calendar grid, the day panel, the AI dot-matrix, chart SVGs, and the
// sidebar — nothing else" — and Overview is none of them. So this screen
// ships no `.css` file and no class of its own: what it needs is placement
// (a stack, a row of three, a rival row), which travels as style objects on
// the elements themselves, the same way `RivalSparkline` places its own
// three columns.
//
// Everything here is layout: `display`, `gap`, `grid-template-columns`,
// `min-width`. No colour is named that is not a §2.1 token, no type size is
// set below `--t-eyebrow`, the ladder's floor, and no rule here paints a
// registered component —
// the daisyUI classes those carry are untouched.
//
// `minWidth: 0` appears on every grid child on purpose: a grid item's
// default `min-width: auto` refuses to shrink below its content, which is
// how a long rival domain pushes a document into horizontal scroll at 320px
// and fails check 1 of the layout sweep.
import type React from "react";

const GAP_TIGHT = "0.5rem";
const GAP = "0.75rem";
const GAP_WIDE = "1.5rem";

/** The screen: five modules down one column. */
export const SCREEN: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: GAP_WIDE,
  minWidth: 0,
};

/** One module: its eyebrow, then its body. */
/** @deprecated Issue 266: the owner approved Take A on 2026-09-02 — "one
 *  card per module, the three stat tiles broken out as three boxes — six
 *  boxes" — so every module on this screen is now an idiom card
 *  (`.rk-idiom-card`), which carries the column, the gap, the surface, the
 *  radius and the shadow this object used to approximate with none of the
 *  last three. Kept until nothing imports it; no caller remains. */
export const MODULE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: GAP,
  minWidth: 0,
};

/** One rival's whole entry: its row, and — where REQ-096 c6 applies — the
 *  written line and the one control, directly under it. A column so the
 *  offer belongs to that rival and moves with it; a module-level banner
 *  would be a statement about the whole set, which c7 forbids the product
 *  implying (issue #223). */
export const RIVAL_ENTRY: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: GAP_TIGHT,
  minWidth: 0,
};

/** The offer's own box. Sunk rather than surfaced: §2.5 keeps rival
 *  strength neutral — a rival beyond reach is context, not the customer's
 *  problem — so it takes no tone, no border colour and no alarm. */
export const OFFER: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: GAP_TIGHT,
  minWidth: 0,
};

export const STACK: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: GAP_TIGHT,
  minWidth: 0,
};

/** The head: line and badge on one line where there is room, wrapping
 *  rather than shrinking where there is not (ADR-093 decision 3 — text is
 *  never shrunk to fit). */
export const HEAD: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: GAP,
  minWidth: 0,
};

/** The three tiles. `auto-fit` with a floor is what makes this one
 *  declaration serve all three bands: three across where 200px each fits,
 *  one across at 320px, and never a fourth column, because there are only
 *  ever three tiles. */
export const TILES: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(200px, 100%), 1fr))",
  gap: GAP,
  minWidth: 0,
};

/** One rival: name, sparkline, figure. Falls to one column at compact,
 *  where 132px of plot beside a domain name does not fit. */
export const RIVAL_ROW: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(240px, 100%), 1fr))",
  gap: GAP,
  alignItems: "center",
  minWidth: 0,
};

/** An alert: its line, and the one control that takes them to it. */
export const ALERT_ROW: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  justifyContent: "space-between",
  gap: GAP,
  minWidth: 0,
};

/** A chart's own column. Every chart in the inventory is drawn at
 *  `width: 100%` of whatever box it is put in, so this is that box. */
export const CHART_BOX: React.CSSProperties = { minWidth: 0, overflowX: "auto" };

/** §2.4, verbatim: "Inline SVG, **hand-sized viewBoxes** — no chart
 *  library." A 300-unit viewBox stretched across a 1360px column is drawn
 *  at 4.5×, which scales every direct label with it — an 8.5-unit numeral
 *  becomes 38px, and a chart of four weekly points reads as a poster. The
 *  cap keeps a full-width chart near the size it was drawn at, so its
 *  labels stay the size §2.3 sets them and the module keeps one headline's
 *  worth of weight instead of the page's.
 *
 *  It is a bound, not a width: below it the chart still fills its column,
 *  which is what keeps the compact band working. The chart that is the
 *  width of the screen — the growth line — takes it; the dot matrix sits
 *  inside a tile that is already narrower, and the sparkline carries its
 *  own `--w-spark-min` floor. The week strip no longer takes it: it is HTML
 *  cells at the ladder's own type size, and the set draws it the full width
 *  of its card (issue #521). */
export const CHART_PLATE: React.CSSProperties = {
  minWidth: 0,
  overflowX: "auto",
  maxWidth: "560px",
  width: "100%",
};

/** A module's own eyebrow. `.eyebrow` (§2.3's "uppercase 10.5–11px eyebrows
 *  for section labels") sets the case and the size; the colour is stated
 *  here rather than by borrowing `.rk-prov`, which is the *provenance*
 *  idiom and would put a section heading — a sentence — in the numeral
 *  face. */
export const EYEBROW: React.CSSProperties = {
  margin: 0,
  color: "var(--ink-3)",
  letterSpacing: "0.08em",
  fontWeight: 700,
};

/** A value and the delta or goal it carries, side by side. */
export const CARRY: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "baseline",
  gap: GAP_TIGHT,
  minWidth: 0,
};
