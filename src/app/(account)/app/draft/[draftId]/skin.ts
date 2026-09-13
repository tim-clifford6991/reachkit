// `Canvas: DailyAction` — this screen\'s class lists, named once.
//
// Tailwind utilities over the approved tokens: no stylesheet, no `rk-*`
// class and no value that is not a token (`docs/DESIGN.md`).

/** The canvas\'s card: the surface, a hairline edge, `--r-box`, the one
 *  card shadow, and 24px of inset. */
export const CARD =
  "flex min-w-0 flex-col gap-(--s-4) rounded-(--r-box) border border-base-300 bg-base-100 p-(--s-5) shadow-sm";

/** 11px, uppercase, 700, `.1em` tracking — the rung and the case, with no
 *  ink of its own so the two spends below each state one. */
const EYEBROW_BASE = "text-(length:--t-eyebrow) font-bold uppercase tracking-[0.1em]";

/** The eyebrow in the quiet ink — every card head on this screen. */
export const EYEBROW = `${EYEBROW_BASE} text-(color:--ink-3)`;

/** The eyebrow on the accent tint, where the block it labels is the
 *  product speaking rather than a quiet aside. */
export const EYEBROW_ACCENT = `${EYEBROW_BASE} text-(color:--accent)`;

/** The accent-tinted block the canvas draws for the grounded fact and for
 *  the Decide box: `--accent-bg` inside an `--accent-line` edge. */
export const TINTED =
  "flex min-w-0 flex-col gap-(--s-2) rounded-(--r-box) border border-(--accent-line) bg-(--accent-bg) p-(--s-4)";

/** The hairline between a card\'s parts. */
export const RULE = "m-0 border-0 border-t border-base-300";

/** A quiet 13px line. */
export const QUIET = "text-(length:--t-sm) text-(color:--ink-2)";

/** A provenance line: the mono face §2.3 requires, folding at its spaces.
 *  `.num` alone is `nowrap` — right for one value, wrong for a line of
 *  several — so these carry §2.3's ruled `.num-phrase` opt-in. */
export const PROV = "num num-phrase text-(length:--t-xs) text-(color:--ink-3)";

/** A quiet aside the product speaks. Prose, so it is set in the UI face and
 *  never the mono one — that is the whole difference between this and
 *  `PROV` beside it. */
export const NOTE = "text-(length:--t-explain) text-(color:--ink-3)";

/** REQ-093 c2\'s label, as the canvas wears it: a mono chip on the sunk
 *  ground at the far end of the card\'s first row. */
export const GEN =
  "num num-phrase inline-flex items-center rounded-(--r-pill) bg-base-200 px-(--s-2) py-(--s-1) text-(length:--t-eyebrow) text-(color:--ink-3)";
