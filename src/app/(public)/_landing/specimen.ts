// The landing's one example business, read from How it works' software
// example so the landing and How it works draw the same Tidyslot. Values
// only: every sentence the landing says is in the copy registry. Domains end
// in `.example`, so no stranger's site is ever drawn.
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

/** The four feature cards' drawings. */
export const SPECIMEN_FEATURES = Object.freeze({
  /** Where a competitor's page sits for the Google card's search. */
  google: { rivalPlace: 2 },
});
