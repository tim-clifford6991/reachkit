// BUILD §3, UI-SPEC S1 — the landing's specimen figures.
// src/app/(public)/_landing/specimen.ts
//
// **What the landing's drawn components show, and why these numbers are
// admissible.** REQ-099 c4 requires the hero to show "the product's own
// running interface — the screens a customer actually uses — rather than a
// stock illustration, a photograph, or a mock-up of a product that does
// not exist", and c8 governs every figure inside it. The owner's ruling 5c
// of 2026-09-08 settles c8 for this surface: the drawn figures render as
// drawn, without a source date or an example line.
//
// The owner's ruling of **2026-09-21** (#935) then replaced the hero
// itself with Round 11's *one week, one card*, which does carry a written
// example line — because it names a business, and a named business has to
// say it is an example. `SPECIMEN_HERO` at the foot of this file is that
// card's, and `landing.hero.example` is its line.
//
// It is a `const`, not a generator: a specimen that varied per call would
// make the layout sweep and its pixel baselines non-deterministic.
//
// **It holds no sentence.** Every word the hero component renders comes
// from the copy registry — the Overview's own tile labels and headline,
// because what the frame shows is the Overview (REQ-099 c4: "every word
// visible inside it is one the product itself renders on that screen").
// What is here is figures, dates and a week's shape.
/** One day of the specimen week: its date, its state, and the state's
 *  written word — the cell's accessible name (`WeekCard.tsx`). */
export interface WeekDay {
  readonly date: string;
  readonly state: "done" | "today" | "to-come" | "nothing-measured";
  readonly mark: string;
}

/** Seven, by type: a week with a day dropped has no call shape. */
export type SevenDays = readonly [WeekDay, WeekDay, WeekDay, WeekDay, WeekDay, WeekDay, WeekDay];
import type { GrowthWeek } from "@/ui/charts";
import { copy, type CopyKey } from "@/lib/presentation/copy";

/* The S1 hero's own two — a six-week growth series and three tiles — went
   with `HeroShot.tsx` when the owner replaced that hero (2026-09-21,
   #935). They are not kept unrendered: an exported specimen of a rejected
   drawing is how a rejected drawing gets drawn again. The ruling's figures
   are `SPECIMEN_HERO` at the foot of this file; git holds the others. */

/**
 * The sign-in panel's own specimen (#937).
 *
 * It lives here, with the landing's, because this module is the product's
 * one home for a drawn figure that measures nothing — and the sign-in
 * screen was carrying its own three literals in the route file, which is
 * two places for "the number the product shows a stranger" to be edited
 * and to drift.
 *
 * **These are not the hero's figures, and must not be.** The owner's
 * ruling 5c of 2026-09-08 fixes the sign-in card at 47/100 with `+6 pts
 * est.`, and the hero at its own; two approved drawings, two sets of
 * figures, one module that holds both. That the two scores now agree at 47
 * is the Round 11 board's doing and not a shared value: neither reads the
 * other, and correcting one must not move the other. The delta is a copy key
 * (`signin.panel.delta`) rather than a number here, because the owner
 * wrote it with its unit and its hedge in one string.
 *
 * The domain is the IANA-reserved name, never a stranger's real one.
 */
export const SPECIMEN_SIGNIN = Object.freeze({
  domain: "example.com",
  score: 47,
  /** The score is out of one hundred. */
  max: 100,
});

/** The seven days of the specimen week.
 *
 *  **Three states, not four.** The set's week fixture marks one day
 *  *unmeasured*; the week card names each cell by its state's word
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

/* ── The hero component's own figures (#935) ──────────────────────────────
   Owner ruling 2026-09-21: the landing hero is Round 11 `R11-H4-Week` —
   one card holding one week. Its numbers land here for this module's
   standing reason: a drawn figure that measures nothing has one home, and
   a route file is not it.

   **They are their own, and are not shared with the sign-in card above.**
   This card draws the week that moved a score from 22 to 47 — still under
   the `findable` boundary, which is the whole of its argument: a product
   still climbing is a more honest picture than one that has arrived. The
   sign-in card's 47 is a different drawing that happens to land on the
   same number, and neither reads the other.

   **No sentence is here.** The card's words are `landing.hero.*` in the
   registry; what is here is numbers, dates and a business's name. */

/** The one place the example business is named. A business name is a
 *  value, not a sentence: it fills `landing.hero.ai.answer`'s `{you}`
 *  slot, and the card's last line says in writing that it is an example. */
export const SPECIMEN_HERO_BUSINESS = "Harbour Bike Repair";

/** The card's head: the score as the week left it, out of one hundred,
 *  and what it rose by. */
export const SPECIMEN_HERO = Object.freeze({
  score: 47,
  /** The score is out of one hundred, as `SPECIMEN_SIGNIN` says. */
  max: 100,
  delta: 25,
  /** Monday's two counts. */
  searches: 400,
  questions: 12,
  /** The hour a page is live, as the day cells show it. */
  liveAt: "07:00",
});

/** The line under the week: eleven measured weeks climbing from 22 to the
 *  card's own 47, so the last reading and the head's number are the same
 *  fact drawn twice. A `const` for the reason above it — a series that
 *  varied per call would make the layout sweep non-deterministic. */
export const SPECIMEN_HERO_WEEKS: readonly [GrowthWeek, ...GrowthWeek[]] = [
  { name: "1", value: 22 },
  { name: "2", value: 23 },
  { name: "3", value: 25 },
  { name: "4", value: 26 },
  { name: "5", value: 28 },
  { name: "6", value: 31 },
  { name: "7", value: 34 },
  { name: "8", value: 37 },
  { name: "9", value: 41 },
  { name: "10", value: 44 },
  { name: "11", value: SPECIMEN_HERO.score },
];

/** BUILD §6.3a / DECISIONS 2026-08-28: US-English only, one location
 *  constant. The two formatters below turn the fixed dates into the words
 *  the card draws — a date format, never a sentence, which is why neither
 *  is a copy key (`report-view.tsx`'s `formatMeasuredOn` is the same
 *  call for the same reason). */
const SPECIMEN_LOCALE = "en-US";

/** The Monday the specimen week starts on, and the day autopilot was
 *  switched on. Fixed dates in UTC: a week derived from `new Date()` would
 *  redraw itself every day and no sweep could hold it still. */
const HERO_WEEK_MONDAY = Date.UTC(2026, 7, 31);
const HERO_AUTOPILOT_SINCE = Date.UTC(2026, 7, 12);
const MS_PER_DAY = 86_400_000;

/** "12 Aug" — the day the pill names. */
export function specimenAutopilotSince(): string {
  return new Date(HERO_AUTOPILOT_SINCE).toLocaleDateString(SPECIMEN_LOCALE, {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

/** One cell of the hero's week: its weekday word and the page that went
 *  live on it. Monday carries no page — it is the day that measures — and
 *  the card draws it as the one cell that reads differently. */
export interface HeroDay {
  readonly weekday: string;
  /** The page title's key, or `null` on the day nothing publishes. */
  readonly page: CopyKey | null;
}

/** Six cells: Monday measures, Tuesday to Saturday each publish one page.
 *  Sunday is not drawn — the product publishes at most one page a day and
 *  the board's week is six cells wide, not seven. */
export type SixDays = readonly [HeroDay, HeroDay, HeroDay, HeroDay, HeroDay, HeroDay];

export function specimenHeroWeek(): SixDays {
  const pages: readonly (CopyKey | null)[] = [
    null,
    "landing.hero.page.1",
    "landing.hero.page.2",
    "landing.hero.page.3",
    "landing.hero.page.4",
    "landing.hero.page.5",
  ];
  const weekday = (index: number): string =>
    new Date(HERO_WEEK_MONDAY + index * MS_PER_DAY).toLocaleDateString(SPECIMEN_LOCALE, {
      weekday: "short",
      timeZone: "UTC",
    });
  return pages.map((page, index) => ({ weekday: weekday(index), page })) as unknown as SixDays;
}
