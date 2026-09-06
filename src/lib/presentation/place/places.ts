// BUILD §6.6 — every place a value or a module can sit, and the one line
// each carries when the customer has no presence yet.
//
// The cold-start law: "every derivation in the product must work for a
// domain that ranks for nothing … Every empty-at-cold-start module states
// what fills it: 'appears after your first pages rank', never a blank."
// (REQ-091 c2.) This registry is what makes that a property rather than a
// review note: a place is a name, and a name has exactly one line.
//
// `PlaceKey` is `keyof typeof PLACES` — the union, not a branded string.
// BP-021's interface block declared it both ways and the two cannot both
// hold: a brand does not stop an arbitrary string being cast into it, and
// the property the sweep needs ("a place rendered but unregistered fails
// **by name**") is the union's. Cost of reversing: one type alias here;
// no consumer changes, because every consumer receives a `PlaceKey` rather
// than constructing one.
import type { CopyKey } from "../copy/index.ts";

export interface PlaceSpec {
  /** The one line this place carries when the customer has no presence
   *  yet. It must say both things REQ-091 c2 requires: that they have no
   *  presence yet, and what will fill it. Its words are the owner's — this
   *  file holds a key, never a sentence. */
  line: CopyKey;
  /** What this place holds when it is not empty. `'module'` is a place
   *  with no value position at all — a list with no entries, a chart with
   *  no series — which REQ-091 c2 reaches explicitly. */
  holds: "value" | "list" | "series" | "module";
  /** Where a sibling requirement already fixes this place's wording, the
   *  clause that fixes it. That fixed line is the place's one line and
   *  this registry adds no second; it still has to say criterion 2's two
   *  things, which `places.test.ts` asserts rather than assumes. */
  fixedBy?: string;
}

/** The seeded set. It is not closed: every surface that gains an empty
 *  place appends its own row here, and the cold-start sweep fails a place
 *  rendered but unregistered **by name** rather than passing over it. */
export const PLACES = Object.freeze({
  "overview.weekly-presence.chart": {
    line: "place.overview.weekly-presence.chart",
    holds: "series",
    fixedBy: "REQ-041 c3",
  },
  "overview.weekly-presence.week": {
    line: "place.overview.weekly-presence.week",
    holds: "value",
    fixedBy: "REQ-065 c3",
  },
  "overview.weekly-presence.partial-week": {
    line: "place.overview.weekly-presence.partial-week",
    holds: "value",
    fixedBy: "REQ-065 c4",
  },
  "calendar.date.page": {
    line: "place.calendar.date.page",
    holds: "module",
    fixedBy: "REQ-043 c5",
  },
  "report.first-page.rival": {
    line: "place.report.first-page.rival",
    holds: "value",
    fixedBy: "REQ-010 c1",
  },
} as const satisfies Record<string, PlaceSpec>);

export type PlaceKey = keyof typeof PLACES;

/** Whether a string names a registered place. The sweep's "fails by name"
 *  half: a marker found in rendered output that is not a `PlaceKey` is
 *  reported with the string it found, not swallowed. */
export function isPlaceKey(candidate: string): candidate is PlaceKey {
  return Object.prototype.hasOwnProperty.call(PLACES, candidate);
}
