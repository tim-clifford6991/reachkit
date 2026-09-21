// SPEC §7 (2026-09-20, #908, issue 930) — "a day card holds the date and
// **exactly one number** (searches a month before the page is live, its
// position and change once it is)".
//
// Exactly one, and which one is a property of the page rather than of the
// screen — so it is decided here, once, as a closed union, and the card
// renders whichever arm it is handed. A card that chose between two numbers
// in its own JSX is a card that can draw both, and "exactly one" would be a
// convention instead of a shape.
//
// **The three arms are three different claims:**
//
//   volume         the demand the page was planned against — a measurement
//                  the pass took and stored, which is all there is to say
//                  about a page that is not live yet.
//   position       where the site stands for that search now, and how far
//                  it moved since the previous measurement. A page that is
//                  live has a place; the demand it was chosen for is no
//                  longer the interesting number about it.
//   first-measure  the page is live and this week's pass measured no place
//                  for it. That is not a zero and not a dash: the page went
//                  out and the next weekly pass is when it is first placed,
//                  so the card names that day ("Mon"). §9 judges a page
//                  from the week it is measured in, and nothing here
//                  invents a measurement in front of it.
//
// A card with no page carries no number at all, which is the fourth arm and
// the reason this returns a union rather than a nullable number: `none` is
// a card state, not a missing value.
import { firstMeasuredLabel } from "./dates";
import type { PageOnDay } from "./month";

/** Where the site stands for a live page's search, as the weekly judgement
 *  recorded it. Both members are plain numbers: a standing that could not
 *  be measured is not a `PageStanding` at all — it is the absence of one,
 *  which is the `first-measure` arm. */
export interface PageStanding {
  /** This week's place. */
  position: number;
  /** The place the previous recorded measurement held, or `null` where
   *  this is the first — a page measured once has a position and no
   *  change, and a change of `0` would claim it held still. */
  previous: number | null;
}

export type DayNumber =
  | { kind: "volume"; text: string }
  | { kind: "position"; text: string; change: number | null }
  | { kind: "first-measure"; text: string }
  | { kind: "none" };

/** Searches a month, compact — "1.9k/mo", "12.4k/mo". A **value**, not a
 *  sentence: §2.3's numeral rule covers it and the copy registry does not,
 *  exactly as `dates.ts` says of a formatted date. The card has room for
 *  one short number and a five-digit demand has to fit an 88px column, so
 *  the compact notation is the one that keeps the rule rather than a taste.
 *
 *  The unit is lower-cased because `Intl`'s compact notation capitalises
 *  it ("12.4K") and the approved set draws it lower ("12.4k/mo"); the
 *  grouping and the rounding are `Intl`'s. */
export function compactPerMonth(value: number): string {
  const compact = new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
  return `${compact.toLowerCase()}/mo`;
}

/** A place, as the card writes it: `#11`. */
export function placeLabel(position: number): string {
  return `#${String(position)}`;
}

/**
 * The one number a day card carries.
 *
 * Pure — a page in, an arm out — so every case is decided by a test with no
 * DOM and no database, and so the phone list and the month grid cannot
 * disagree about which number a day shows.
 */
export function dayNumberOf(page: PageOnDay | null): DayNumber {
  if (page === null) return { kind: "none" };

  if (page.stage !== "live") {
    // A page that is not live is still a plan, and the demand is the
    // measurement it was planned against. An unmeasured demand draws no
    // number at all rather than a dash: the card's number is optional and a
    // dash in its place would read as a measurement of zero interest.
    const volume = page.why.volume;
    if (volume.kind === "unmeasured") return { kind: "none" };
    return { kind: "volume", text: compactPerMonth(volume.value) };
  }

  const standing = page.standing;
  if (standing === null) return { kind: "first-measure", text: firstMeasuredLabel() };
  return {
    kind: "position",
    text: placeLabel(standing.position),
    // A search position is better the smaller it is, so a move *up* the
    // results is a fall in the number. The card states the direction the
    // founder reads, not the arithmetic sign.
    change: standing.previous === null ? null : standing.previous - standing.position,
  };
}
