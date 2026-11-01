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
import type { CopyKey } from "@/lib/presentation/copy";
import { WEEK_PLAN } from "@/lib/config/constants";

/* The S1 hero's own two — a six-week growth series and three tiles — went
   with `HeroShot.tsx` when the owner replaced that hero (2026-09-21,
   #935). They are not kept unrendered: an exported specimen of a rejected
   drawing is how a rejected drawing gets drawn again. The ruling's figures
   are `SPECIMEN_HERO` at the foot of this file; git holds the others. */

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
export const SPECIMEN_HERO_BUSINESS = "Harbor Plumbing";

/** The week's own figures. Monday's counts are the product's own
 *  (`_how/facts.ts`), never drawn here. */
export const SPECIMEN_HERO = Object.freeze({
  /** The hour a page goes live, as the day cells show it. */
  liveAt: "4:00 PM",
});

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

/* ── The landing's 2026-09-24 order (#1067) ──────────────────────────────
   The *Inside ReachKit* preview and the four *Why you should care* cards
   draw the same example business, so their values live beside the hero's.
   Domains end in `.example`, the reserved name, so no stranger's site is
   ever drawn. */

/** The example business's own site, and the page path its drafts land on. */
export const SPECIMEN_HERO_DOMAIN = "harborplumbing.example";
export const SPECIMEN_HERO_BLOG = "help.harborplumbing.example";

/** *AI answers*: the search asked, and the sites the answer cites. */
export const SPECIMEN_HERO_SEARCH = "slab leak repair cost austin";
export const SPECIMEN_HERO_CITED = ["harborplumbing.example", "austinpipeworks.example"] as const;

/** The competitor the example business's buyers pick instead. */
export const SPECIMEN_HERO_RIVAL = "austinpipeworks.example";

/** The story card's example data: the search both engines answer, and the
 *  week's first three pages with one live of the week's plan. Swapping the
 *  example business swaps these with its name and domains. */
export const SPECIMEN_HERO_QUERY = "plumber in Austin";
export const SPECIMEN_HERO_WEEK = Object.freeze({
  live: 1,
  planned: WEEK_PLAN.days,
  pages: ["Slab leaks", "Tankless heaters", "Drain cleaning"] as const,
});

/** The town the example business's buyers live in. */
export const SPECIMEN_HERO_PLACE = "Austin";

/** *Your page*: how long until the waiting page goes live. */
export const SPECIMEN_HERO_DUE = "6h 12m";

/** The four feature cards' drawings. */
export const SPECIMEN_FEATURES = Object.freeze({
  /** Where a national chain's page sits for the Google card's search. */
  google: { rivalPlace: 2 },
});
