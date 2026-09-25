// The ReachKit mark, once — the one drawing every size and every file reads.
// src/lib/brand/mark.ts — issue #982
//
// **In `src/lib/` because everything needs it.** The screens draw it
// (`src/app/_brand/Brand.tsx`), the share cards draw it, the mail shell
// draws it — and `structure.md` rule 6 is one-way: `src/lib/` may not
// import from `src/app/`, so a mark that lived under `app/` could not be
// the mail's. It is plain data and one string builder, with no React and
// no framework, which is what `src/lib/` is for: `src/lib/mail/shell/
// tokens.ts` holds the mail's design values on the same footing.
//
// **Owner ruling 2026-09-21:** the mark is Round 9 · `R9-L1-Chip` · **Fade**
// — the rising dome with its grain as a smooth fade, inside the violet chip
// — from the logo canvas's own board. The geometry below is that board's,
// redrawn rather than traced: a 64-unit box, a 15-unit corner, and one
// semicircle of radius 24 centred at (32, 50), filled with a single linear
// gradient from opaque to nearly clear across the rise.
//
// **One SVG at every size** (the owner's standing rule). The small sizes are
// this drawing scaled down and nothing else — there is no 16px variant, no
// second path set, no stipple. That is why the fade is a real
// `<linearGradient>`: a grain drawn as dots would have to be redrawn for
// each size, and the rule exists precisely to forbid that.
//
// **The chip's violet is fixed, and does not follow the theme.** `--accent`
// is `#5b4be0` in light and `#9bb4ff` in dark, and `--color-primary` reads
// it — so `bg-primary` would repaint the mark in dark. The ruling is "the
// chip stays violet; the wordmark takes the dark theme's ink. One drawing,
// two inks", so the chip carries the brand's own colour and only the word
// beside it moves. This is the one place that colour is written.
//
// Every consumer reads from here: `Brand.tsx` (the screens), the share
// cards and the tab icon under `(public)/_seo/`, and `scripts/brand/` for
// the committed raster set. `tests/ui/design/mark-and-glyphs.test.ts` keeps
// it the only place.

/** A shape carrying no fill of its own. Named because the copy sweep
 *  presumes a bare string in a JSX attribute is product voice until
 *  something says otherwise, and a fill of `none` is paint, not a
 *  sentence. (`chart-primitives.ts` names the same value for the share
 *  card; that file is debt `docs/DESIGN.md` says to delete with the card
 *  it serves, so the mark keeps its own rather than reaching into it.) */
export const MARK_UNFILLED = "none";

/** The drawing's own box. Every coordinate below is in these units; a
 *  caller asks for pixels and the `viewBox` does the scaling. */
export const MARK_BOX = 64;

/** The chip: a rounded square at the board's own corner radius. */
export const MARK_RADIUS = 15;

/** The brand's violet — see this file's header for why it is a constant
 *  and not `--accent`. It is the light theme's `--accent` value, which is
 *  what makes the mark and the product's accent agree wherever the theme
 *  is light, and what keeps the mark itself when the theme is not. */
export const MARK_CHIP = "#5b4be0";

/** The ink the dome is drawn in, before the fade takes it down. White on
 *  the violet, which is `--on-accent`'s light value for the same reason
 *  the chip is `--accent`'s. */
export const MARK_INK = "#ffffff";

/** The rising dome: a half-disc of radius 24 standing on the chip's lower
 *  third, which is the board's `M8 50 A24 24 0 0 1 56 50 Z`. */
export const MARK_DOME = "M8 50 A24 24 0 0 1 56 50 Z";

/**
 * The fade across the rise, as the board draws it: opaque until well into
 * the arc, then away to almost nothing at the top right. Written as the
 * gradient's own numbers rather than as a path so that scaling the mark
 * scales the fade with it — which is the whole of the one-drawing rule.
 */
export const MARK_FADE = Object.freeze({
  x1: 0.15,
  y1: 1,
  x2: 0.95,
  y2: 0.1,
  /** Where the opaque stop sits, before the run to transparent. */
  from: 0.38,
  /** What is left at the far end — not zero: the board keeps a trace of
   *  the dome's far shoulder, and at 16px that trace is most of what
   *  separates this mark from a plain half-disc. */
  toOpacity: 0.12,
});

/**
 * The gradient's `id`.
 *
 * The default for a standalone document (`brandMarkSvg`). The React
 * `BrandMark` does not share it across instances: a document that draws
 * the mark twice resolves `url(#…)` to the first definition, and when that
 * one is inside a `display:none` subtree Chromium paints nothing for the
 * rest (#1060). Each rendered instance appends its own `useId()`.
 *
 * It is a prop on the component all the same, so a caller that needs a
 * distinct one — a standalone document, an embedded sprite — can say so.
 */
export const MARK_FADE_ID = "rk-mark-fade";

/**
 * The mark as a standalone SVG document.
 *
 * This is what `scripts/brand/` writes to `favicon.svg` and rasterises the
 * rest of the set from, so the committed PNGs and the screens cannot come
 * to show two different marks. The React rendering in `Brand.tsx` draws
 * the same four elements; `tests/ui/design/brand-mark.test.ts` holds the
 * two equal rather than trusting them to stay that way.
 */
export function brandMarkSvg(options: { size?: number; id?: string } = {}): string {
  const id = options.id ?? MARK_FADE_ID;
  const size = options.size;
  const dimensions = size === undefined ? "" : ` width="${size}" height="${size}"`;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg"${dimensions} viewBox="0 0 ${MARK_BOX} ${MARK_BOX}" fill="${MARK_UNFILLED}">`,
    "<defs>",
    `<linearGradient id="${id}" x1="${MARK_FADE.x1}" y1="${MARK_FADE.y1}" x2="${MARK_FADE.x2}" y2="${MARK_FADE.y2}">`,
    `<stop offset="${MARK_FADE.from}" stop-color="${MARK_INK}"/>`,
    `<stop offset="1" stop-color="${MARK_INK}" stop-opacity="${MARK_FADE.toOpacity}"/>`,
    "</linearGradient>",
    `<clipPath id="${id}-clip"><rect width="${MARK_BOX}" height="${MARK_BOX}" rx="${MARK_RADIUS}"/></clipPath>`,
    "</defs>",
    `<g clip-path="url(#${id}-clip)">`,
    `<rect width="${MARK_BOX}" height="${MARK_BOX}" fill="${MARK_CHIP}"/>`,
    `<path d="${MARK_DOME}" fill="url(#${id})"/>`,
    "</g>",
    "</svg>",
  ].join("");
}
