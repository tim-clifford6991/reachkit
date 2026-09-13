// BUILD §2.2 — daisyUI `progress`.
// src/ui/components/Progress.tsx
//
// `components.md` §1, verbatim: "`progress`. **Determinate only** — a
// caller cannot request an indeterminate bar. This is also the three driver
// mini-bars of the report's header strip (§4.1); mini-bars are *not* a
// sixth chart" | "default" (one state).
//
// `value` and `max` are both required numbers with no optional arm — the
// native `<progress>` element only becomes indeterminate when `value` is
// omitted, and the type here makes omitting it a compile error, so an
// indeterminate bar has no call shape a caller can reach.
import type React from "react";

export function Progress(p: {
  value: number;
  max: number;
  /** The card idiom's widening (issue #266, `components.md` §7): the same
   *  determinate bar on an **accent ground**, where `--sunk` and
   *  `--chart-*` have no contrast to stand on. daisyUI draws the bar in its
   *  own `color`, so the arm sets that to `--color-primary-content` — the
   *  theme's name for ink on a saturated ground — and the track is daisyUI's
   *  own mix of it. Not a sixth chart form: §2.4's inventory is closed and
   *  this adds nothing to it. */
  onAccent?: boolean;
  /** The accessible name. On the sign-in panel the label and the figure are
   *  already above the bar and printing them inside it would be the same
   *  claim twice, so the name is given here rather than rendered. */
  label?: string;
}): React.JSX.Element {
  const classes = ["progress", p.onAccent === true ? "text-primary-content" : "progress-primary"];
  return (
    <progress className={classes.join(" ")} value={p.value} max={p.max} aria-label={p.label} />
  );
}
