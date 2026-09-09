// BUILD §3, UI-SPEC S1 — the landing's specimen figures.
// src/app/(public)/_landing/specimen.ts
//
// **What the hero component shows, and why these numbers are admissible.**
// REQ-099 c4 requires the component to show "the product's own running
// interface — the screens a customer actually uses — rather than a stock
// illustration, a photograph, or a mock-up of a product that does not
// exist", and c8 governs every figure inside it. The owner's ruling 5c of
// 2026-09-08 settles c8 for this surface: "the sign-in card (47/100, `+6
// pts est.`) and the hero component's figures render as drawn on
// `example.com`, without a source date or an example line". So the figures
// below are the approved set's own, on the IANA-reserved name, and the
// component carries neither a measured-on date nor an "these are an
// example" line — 5c removed both.
//
// It is a `const`, not a generator: a specimen that varied per call would
// make the layout sweep and its pixel baselines non-deterministic.
//
// **It holds no sentence.** Every word the hero component renders comes
// from the copy registry — the Overview's own tile labels and headline,
// because what the frame shows is the Overview (REQ-099 c4: "every word
// visible inside it is one the product itself renders on that screen").
// What is here is figures, dates and a week's shape.
import type { SevenDays } from "@/ui/charts";
import type { GrowthWeek } from "@/ui/charts";
import { copy } from "@/lib/presentation/copy";

/** The growth series the set draws — six measured weeks, starting at 12.
 *  §6.6's "the line leaving the floor" is the live screen's rule; a
 *  six-week specimen is the set's drawing of an account six weeks in. */
export const SPECIMEN_WEEKS: readonly [GrowthWeek, ...GrowthWeek[]] = [
  { name: "1", value: 12 },
  { name: "2", value: 31 },
  { name: "3", value: 44 },
  { name: "4", value: 61 },
  { name: "5", value: 96 },
  { name: "6", value: 128 },
];

/** The three tiles, as the set draws them: the score with its delta, the
 *  AI-answers count over its denominator, and the pages published. */
export const SPECIMEN_TILES = Object.freeze({
  score: "62",
  scoreDelta: "8",
  aiAnswers: "2",
  aiAnswersOf: "12",
  published: "17",
});

/** The seven days of the specimen week.
 *
 *  **Three states, not four.** The set's week fixture marks one day
 *  *unmeasured*; `WeekStrip` writes a state's word inside its own cell
 *  (`mark`), and the product has written words for three of its four
 *  states — done, today and next (`overview.week.day.*`). The fourth has
 *  no sentence yet, and a specimen is not a place to mint one: the rule is
 *  that copy is added as a key with the marker, and a `TODO(copy)` printed
 *  inside a week cell on the landing hero would be worse than a week that
 *  shows the three states the product can name. Issue #353 draws the
 *  Overview and owns the fourth word; this follows it when it lands. */
export function specimenWeek(): SevenDays {
  const done = copy("overview.week.day.done");
  const day = (date: string, state: "done" | "today" | "to-come", mark: string) => ({ date, state, mark }) as const;
  return [
    day("26", "done", done),
    day("27", "done", done),
    day("28", "done", done),
    day("29", "done", done),
    day("30", "done", done),
    day("01", "today", copy("overview.week.day.today")),
    day("02", "to-come", copy("overview.week.day.to-come")),
  ];
}
