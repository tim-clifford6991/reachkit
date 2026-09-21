// SPEC §4 (2026-09-20, #908) — a search's difficulty against the ceiling
// this site is judged by, "as a bar with a mark at the ceiling".
//
// **Not a chart, and so not Recharts.** docs/DESIGN.md rule 2 puts *every
// series* in Recharts; this is one value, once, in a table cell — there is
// no series here to draw. The ladder in "Admitting new UI" says daisyUI
// first, and daisyUI has the element: `progress`. The ceiling is one more
// box over it, positioned with Tailwind utilities.
//
// **It cannot escape its own box, and it is not out of flow.** The mark is
// the right border of a box whose width is the ceiling's own per cent — a
// border is inside the border box, so at 100% the mark stands on the bar's
// last pixel rather than two pixels past it. The bar and the mark are two
// grid items in **one cell**, which is how they stack without either of
// them being positioned: `position: absolute` would put the mark out of
// flow, and the layout law holds an out-of-flow box to the viewport's own
// edges (`checkContainment`, #913) — inside a table that scrolls sideways
// on a phone, every mark past the 390th pixel is then an offender, which is
// exactly what the sweep reported when this was absolute.
//
// **Colour is state, not identity** (§2.5): a search at or under the
// ceiling is one this site can take (success); one above it is not
// (error). Neither is ever colour alone — the number stands beside the bar,
// and the whole control carries a written name.
import type React from "react";
import { copy } from "@/lib/presentation/copy";

/** The vendor's keyword difficulty runs 0–100, which is what makes a per
 *  cent of the bar and a point of difficulty the same thing. */
const SCALE = 100;

export function DifficultyBar(p: {
  /** 0–100, already known to be measured — an unmeasured difficulty has no
   *  bar to draw and the cell shows its dash instead. */
  difficulty: number;
  /** What this site is judged against, or `null` where its ranked count was
   *  never measured. No ceiling, no mark: the bar then states the search's
   *  own difficulty and claims nothing about the site. */
  ceiling: number | null;
}): React.JSX.Element {
  const within = p.ceiling === null || p.difficulty <= p.ceiling;
  const label =
    p.ceiling === null
      ? copy("overview.search.difficulty.label.no-limit", { difficulty: String(p.difficulty) })
      : copy("overview.search.difficulty.label", {
          difficulty: String(p.difficulty),
          ceiling: String(p.ceiling),
        });

  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className="grid h-3 w-16 shrink-0 grid-cols-1 grid-rows-1 items-center"
      data-testid="difficulty-bar"
    >
      <progress
        className={`progress col-start-1 row-start-1 h-1.5 w-full ${
          within ? "progress-success" : "progress-error"
        }`}
        value={Math.min(p.difficulty, SCALE)}
        max={SCALE}
      />
      {p.ceiling === null ? null : (
        <span
          aria-hidden
          data-testid="difficulty-ceiling-mark"
          className="pointer-events-none col-start-1 row-start-1 h-3 justify-self-start border-r-2 border-base-content/70"
          style={{ width: `${Math.min(p.ceiling, SCALE)}%` }}
        />
      )}
    </span>
  );
}
