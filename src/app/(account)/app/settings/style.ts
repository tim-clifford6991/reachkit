// Canvas: Settings — the screen's shared class vocabulary.
//
// Tailwind utilities over the approved tokens: no stylesheet, no class of
// this screen's own, and every gap, radius, size and colour a token.

/** The screen: its cards down one column, as the artboard draws them. */
export const SCREEN = "flex min-w-0 flex-col gap-(--s-4)";

/** The screen's head: the title, and the line under it. */
export const HEAD = "flex min-w-0 flex-col gap-(--s-2)";

/** A card's head: the label, and whatever the artboard sets opposite it.
 *  `w-full` because daisyUI's card title is a flex row of its own, and a
 *  shrink-to-fit head leaves `justify-between` no width to push across. */
export const CARD_HEAD = "flex w-full flex-wrap items-center justify-between gap-(--s-3)";

/** The label half of a head: the glyph, and the eyebrow beside it. */
export const CARD_LABEL = "flex min-w-0 items-center gap-(--s-2) text-(color:--ink-3)";

/** A card's body: its parts one under another. */
export const SECTION = "flex min-w-0 flex-col gap-(--s-3)";

/** A tighter stack — a field under its label, a line under a value. */
export const STACK = "flex min-w-0 flex-col gap-(--s-2)";

/** The controls at a card's foot, in one line where they fit. */
export const CONTROLS = "flex min-w-0 flex-wrap items-center gap-(--s-3)";

/** One setting: the name at the near edge, the value and its control at the
 *  far one — the row the artboard draws on every card. */
export const ROW = "flex min-w-0 flex-wrap items-center justify-between gap-(--s-3)";
export const ROW_NAME = "min-w-0 text-(length:--t-sm) text-(color:--ink-2) wrap-anywhere";
export const ROW_VALUE = "flex min-w-0 flex-wrap items-center gap-(--s-2)";

/** A stored value: mono, because each is a numeral, a date, a domain or a
 *  code-like string. */
export const VALUE = "num min-w-0 wrap-anywhere";

/** A card's one headline figure, at the artboard's h2. */
export const FIGURE = "num text-(length:--h2) font-semibold wrap-anywhere";

/** The quiet line a card answers with, and the smaller aside under it. */
export const QUIET = "min-w-0 text-(length:--t-sm) text-(color:--ink-2) wrap-anywhere";
export const EXPLAIN = "explain min-w-0 wrap-anywhere";

/** The artboard's inset row: a destination on its own tinted ground. */
export const INSET_ROW =
  "flex min-w-0 flex-wrap items-center justify-between gap-(--s-3) rounded-(--r-field) border border-base-300 bg-(--bg) p-(--s-3)";

/** A step opened under a control: a change in flight, or a consequence. */
export const STEP_WARN =
  "flex min-w-0 flex-col gap-(--s-2) rounded-(--r-field) border border-warning/40 bg-warning/10 p-(--s-3)";
export const STEP_BAD =
  "flex min-w-0 flex-col gap-(--s-2) rounded-(--r-field) border border-error/40 bg-error/10 p-(--s-3)";

/** The hairline between one card's parts. */
export const RULE = "min-w-0 border-t border-base-300";

/** Tags wrap, and each folds inside its card: a claim is a sentence. */
export const TAGS = "flex min-w-0 flex-wrap gap-(--s-2)";

/** The danger card. Its edge is the theme's own line slot re-pointed to
 *  `--bad-line` for this subtree, so the one card whose controls destroy
 *  something is drawn in red without a second card component. */
export const DANGER = "min-w-0 [--color-base-300:var(--bad-line)]";
export const DANGER_LABEL = "flex min-w-0 items-center gap-(--s-2) text-(color:--bad)";

/** The stepper: two ends and the window between them. */
export const STEPPER = "flex min-w-0 flex-wrap items-center gap-(--s-3)";

/** The mode pair: two named choices, the chosen one carrying the tint. */
export const CHOICES = "grid min-w-0 grid-cols-1 gap-(--s-2) sm:grid-cols-2";
export const CHOICE =
  "min-w-0 rounded-(--r-box) border border-base-300 p-(--s-3) text-start text-(length:--t-sm) font-semibold text-(color:--ink-2) aria-pressed:border-primary aria-pressed:bg-(--accent-bg) aria-pressed:text-primary";

/** A card head's glyph, at the size `docs/DESIGN.md` fixes for chrome. */
export const GLYPH = 20;
export const STROKE = 1.75;
