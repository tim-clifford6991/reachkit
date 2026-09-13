// Canvas: Dashboard — the screen's shared class vocabulary.
//
// Tailwind utilities over the approved tokens: no stylesheet, no class of
// this screen's own, and every gap, radius, size and colour a token.
// `min-w-0` rides on every grid and flex child on purpose — a grid item's
// default `min-width: auto` refuses to shrink below its content, which is
// how a long domain pushes the document into horizontal scroll at 320.

/** The screen: its sections down one column. */
export const SCREEN = "flex min-w-0 flex-col gap-(--s-5)";

/** The screen's head: the line, and the badge opposite it. It wraps rather
 *  than shrinking — text is never shrunk to fit. */
export const HEAD = "flex min-w-0 flex-wrap items-center justify-between gap-(--s-3)";

/** A card's head: the label, and whatever the artboard sets opposite it.
 *  `w-full` because daisyUI's `.card-title` is a flex row of its own, and a
 *  shrink-to-fit head leaves `justify-between` no width to push across. */
export const CARD_HEAD = "flex w-full flex-wrap items-center justify-between gap-(--s-3)";

/** The label half of a head: the glyph and the eyebrow beside it. */
export const CARD_LABEL = "flex min-w-0 items-center gap-(--s-2) text-(color:--ink-3)";

/** A card's body: its parts one under another. */
export const SECTION = "flex min-w-0 flex-col gap-(--s-3)";

/** A tighter stack — inside a tile, or under one figure. */
export const STACK = "flex min-w-0 flex-col gap-(--s-2)";

/** The dim line under a card's own answer. */
export const QUIET = "text-(color:--ink-2)";

/** Provenance: quiet, mono, at the ladder's floor rung. */
export const PROV = "num text-(length:--t-eyebrow) text-(color:--ink-3)";

/** A value and the delta or goal it carries, side by side. */
export const CARRY = "flex min-w-0 flex-wrap items-baseline gap-(--s-2)";

/** The artboard's two tiles: side by side where they fit, stacked at the
 *  compact floor, and never a third column — there are only ever two. */
export const TILES = "grid min-w-0 grid-cols-1 gap-(--s-4) sm:grid-cols-2";

/** The score card's two halves: the figure, and the series beside it. */
export const SCORE_SPLIT = "flex min-w-0 flex-wrap items-center gap-(--s-5)";

/** The series half. It takes the room left over and keeps a floor, so the
 *  chart wraps under the figure rather than being squeezed. */
export const SCORE_SERIES = "flex min-w-0 flex-1 basis-(--w-form) flex-col gap-(--s-2)";

/** One rival's whole entry: its row, and the offer that belongs to it. */
export const RIVAL_ENTRY = "flex min-w-0 flex-col gap-(--s-2)";

/** One rival: the plot, and the figure it carries. */
export const RIVAL_ROW =
  "grid min-w-0 grid-cols-[repeat(auto-fit,minmax(min(240px,100%),1fr))] items-center gap-(--s-3)";

/** The offer's own box, under the rival it is about. */
export const OFFER = "flex min-w-0 flex-col items-start gap-(--s-2)";

/** A chart's own column. Every chart in the inventory is drawn at 100% of
 *  whatever box it is put in, so this is that box. */
export const CHART_BOX = "min-w-0 overflow-x-auto";

/** A card head's glyph, at the size DESIGN.md fixes for chrome. */
export const GLYPH = 20;
export const STROKE = 1.75;
