// BUILD §6.6 — the one arbiter: a place holding nothing gets exactly one
// line, over a closed cause union with a fixed precedence.
//
// ADR-011 (DECISIONS 2026-08-31), verbatim: "One arbiter (`account()`)
// decides a place's single empty-state line over a closed cause union with
// fixed precedence; ReachKit's own stop outranks every other cause that is
// also true."
//
// **Read ADR-011 before reordering the array below.** Two of its rows read
// as wrong and are load-bearing:
//
//   · `reachkit-stopped` first — a customer who paused publishing *and* hit
//     a spend ceiling is told about the stop only. Naming the paused cause
//     as well reads as more honest and is what REQ-092 c7 forbids in as
//     many words ("whether or not that other reason is also true").
//   · `unrecognised` above `supply-exhausted` — a cause nobody classified
//     falls to "some cause emptied this", never to "there was nothing worth
//     publishing". REQ-043 c3 reserves that sentence to genuinely exhausted
//     supply; the friendly line is the one that must not be inherited.
//
// The arms carrying a `line` are produced by the node that owns the
// sentence and handed in already rendered — which is what keeps this file
// free of any dependency on `../stopped/` and the graph acyclic.
import { copy } from "../copy/index.ts";
import { PLACES, type PlaceKey } from "./places.ts";

export type Cause =
  | { tag: "reachkit-stopped"; line: string } // ../stopped's stoppedWorkStatement
  | { tag: "customer-instruction"; line: string } // REQ-047 c5, via REQ-043 c5
  | { tag: "named"; line: string } // any cause a requirement names, REQ-043 c4
  | { tag: "unrecognised" } // a cause no requirement names
  | { tag: "supply-exhausted" } // REQ-043 c3, and only ever this
  | { tag: "no-presence-yet" }; // REQ-091 c2, the baseline account

export type CauseTag = Cause["tag"];

/** The ordering, and its only home. Adding a seventh cause is an edit to
 *  this file, which puts the author in front of the order (ADR-011 point
 *  6): an open registry would let a cause be registered without ever
 *  meeting it, and an unordered set cannot satisfy "exactly one account". */
export const CAUSE_PRECEDENCE: readonly CauseTag[] = Object.freeze([
  "reachkit-stopped",
  "customer-instruction",
  "named",
  "unrecognised",
  "supply-exhausted",
  "no-presence-yet",
] as const);

/** Total over `Cause`. REQ-091 c2's "exactly one written line" and REQ-043
 *  c5's "exactly one account of itself" are this one call: one line out,
 *  never two, never a concatenation, never nothing. An empty `causes` array
 *  is the baseline account — the customer simply has no presence yet — and
 *  not a path that returns undefined. */
export function account(
  place: PlaceKey,
  causes: readonly Cause[]
): { line: string; cause: CauseTag } {
  for (const tag of CAUSE_PRECEDENCE) {
    const found = causes.find((cause) => cause.tag === tag);
    if (found === undefined) continue;
    return { line: lineFor(place, found), cause: found.tag };
  }
  return { line: copy(PLACES[place].line), cause: "no-presence-yet" };
}

/** The switch is closed with a `never` assignment, so a seventh arm added
 *  to `Cause` does not compile until it is placed in `CAUSE_PRECEDENCE`
 *  and given a line here. */
function lineFor(place: PlaceKey, cause: Cause): string {
  switch (cause.tag) {
    case "reachkit-stopped":
    case "customer-instruction":
    case "named":
      // Rendered by the node that owns the sentence and returned unchanged:
      // re-rendering it here would be the second account ADR-011 exists to
      // make impossible.
      return cause.line;
    case "unrecognised":
      return copy("cause.unrecognised");
    case "supply-exhausted":
      return copy("cause.supply-exhausted");
    case "no-presence-yet":
      return copy(PLACES[place].line);
    default: {
      const exhaustive: never = cause;
      return exhaustive;
    }
  }
}
