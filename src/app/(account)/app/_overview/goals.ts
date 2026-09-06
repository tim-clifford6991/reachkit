// BUILD §4.5 — every headline number's goal, and what reaching it means.
//
// §4.5's data rule, verbatim: "max one headline number per module; every
// value carries its delta or its goal, never bare." A goal is therefore not
// a decoration on a tile — it is the half of that rule that is always
// available, because a delta needs a previous measurement and a goal does
// not.
//
// **Three keys, not four.** DECISIONS 2026-09-03, verbatim: "Overview's
// AI-answers tile shows one reading only: weeks present in the trailing
// window. The composite score has no tile on Overview." — superseding
// §4.5's own tile 3. `GOAL_VALUES.score` still exists and is still pinned;
// it is the free report's goal (§4.1), not this screen's, and a `GoalKey`
// that named it would be a tile with nowhere to render.
//
// **The pairing lives here; the numbers do not.** Every value below is read
// from `GOAL_VALUES` (`src/lib/config/constants.ts`) and no numeric literal
// for a goal appears in this directory at all — so a change to a pin moves
// the screen, and a change to the screen cannot move a pin.
import type { CopyKey } from "@/lib/presentation/copy";
import { GOAL_VALUES } from "@/lib/config/constants";

/** The three headline numbers Overview leads a module with. */
export type GoalKey = "searches_appeared_in" | "ai_answers" | "pages_published";

export const GOAL_KEYS: readonly GoalKey[] = Object.freeze([
  "searches_appeared_in",
  "ai_answers",
  "pages_published",
]);

/** `value` is required, not optional: `pages_published` was the one goal
 *  the product had no number for, and the owner ruled it at 30 on
 *  2026-08-31 (a month of daily pages). With all three carrying a value, a
 *  goalless headline is unrepresentable rather than merely unusual. */
export const GOALS: Readonly<Record<GoalKey, { value: number; meansKey: CopyKey }>> = Object.freeze(
  {
    searches_appeared_in: {
      value: GOAL_VALUES.searches_appeared_in,
      // §4.5's own footnote sentence — the one place the product says what
      // reaching this number means.
      meansKey: "overview.growth.footnote.goal",
    },
    ai_answers: { value: GOAL_VALUES.ai_answers, meansKey: "overview.tile.ai-answers.means" },
    pages_published: { value: GOAL_VALUES.pages_published, meansKey: "overview.tile.pages.means" },
  }
);
