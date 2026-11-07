// The landing's one example business, read from How it works' software
// example so the landing and How it works draw the same Tidyslot. Values
// only: every sentence the landing says is in the copy registry. Domains end
// in `.example`, so no stranger's site is ever drawn.
import { WEEK_PLAN } from "@/lib/config/constants";
import { EXAMPLES, LIVE_AT } from "../_how/specimen";

const EXAMPLE = EXAMPLES.software;

/** The hours the step pictures print. */
export const SPECIMEN_HERO = Object.freeze({
  /** The hour a page goes live, as the day rows show it. */
  liveAt: LIVE_AT,
  /** The hour the Monday email arrives. */
  mailAt: "8:00 AM",
});

export const SPECIMEN_HERO_BUSINESS = EXAMPLE.business;
export const SPECIMEN_HERO_DOMAIN = EXAMPLE.site;

/** The competitor the example business's buyers pick instead. */
export const SPECIMEN_HERO_RIVAL = EXAMPLE.report.rivals[0]!;

/** The story card's search: the one example search that fits its bar at 1280 and 390 (decision 2026-11-06-2452). */
export const SPECIMEN_HERO_QUERY = EXAMPLE.questions[3]!.search;

/** The week's first three pages, short enough for the story card's rows, with one live of the week's plan. */
export const SPECIMEN_HERO_WEEK = Object.freeze({
  live: 1,
  planned: WEEK_PLAN.days,
  pages: ["Double bookings", "Round-robin booking", "No-show reminders"] as const,
});

/** The four feature cards' drawings. */
export const SPECIMEN_FEATURES = Object.freeze({
  /** Where a competitor's page sits for the Google card's search. */
  google: { rivalPlace: 2 },
});
