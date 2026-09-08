// BUILD §4.5 — every headline number's goal, and what reaching it means.
//
// §4.5's data rule, verbatim: "max one headline number per module; every
// value carries its delta or its goal, never bare." A goal is therefore not
// a decoration on a tile — it is the half of that rule that is always
// available, because a delta needs a previous measurement and a goal does
// not.
//
// **Four keys again, since #353.** DECISIONS 2026-09-03 read: "Overview's
// AI-answers tile shows one reading only: weeks present in the trailing
// window. The composite score has no tile on Overview." The owner's
// approved screen set (2026-09-08) reverses the second half of that: ruling
// 6a names "Overview tile" as one of the surfaces that labels the
// Discoverability Score, and S12 draws it as the first of the three tiles
// with its delta and its band. The set is the newer artifact and #353
// follows it; the DECISIONS row recording the supersession is the owner's
// to write.
//
// The first half of the 2026-09-03 ruling stands untouched: the AI-answers
// tile still shows one reading, and no per-question figure appears on this
// screen. What came back is the score's own tile, and `GOAL_VALUES.score`
// — pinned all along as the free report's goal (§4.1) — is now the goal a
// score with no previous measurement to compare against falls back to.
//
// **The pairing lives here; the numbers do not.** Every value below is read
// from `GOAL_VALUES` (`src/lib/config/constants.ts`) and no numeric literal
// for a goal appears in this directory at all — so a change to a pin moves
// the screen, and a change to the screen cannot move a pin.
import type { CopyKey } from "@/lib/presentation/copy";
import { GOAL_VALUES } from "@/lib/config/constants";

/** The four headline numbers Overview leads a module with. */
export type GoalKey = "score" | "searches_appeared_in" | "ai_answers" | "pages_published";

export const GOAL_KEYS: readonly GoalKey[] = Object.freeze([
  "score",
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
    // The band word is what the set puts beside the score, and it is not a
    // goal: it is where the score stands now, not what it is climbing to.
    // So the goal is still here, still `GOAL_VALUES.score`, and it is what
    // the tile carries on the measurement that has no previous score to
    // make a delta from.
    score: { value: GOAL_VALUES.score, meansKey: "overview.tile.score.means" },
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
