// BUILD §6.6 — the one renderer for a place. A surface asks for a place,
// not for a value; the emptiness decision is made here and never at the
// call site.
//
// `Place<T>` has exactly two arms. There is no `blank`, no `hidden`, no
// `placeholder`, no `spinner` and no `undefined` arm — REQ-091 c2's "no
// blank, dash or placeholder value stands anywhere a value would sit, and
// no module is hidden, dropped or collapsed for holding nothing yet" is
// unrepresentable here rather than tested for downstream.
//
// A value of `null`, of `[]`, or a `Measured` whose kind is `'unmeasured'`
// is not a blank: it is a cause, and `account()` turns it into exactly one
// line. That is also why a cold start is never accounted for as a
// measurement that could not be taken (REQ-004 c8): the two vocabularies —
// `CauseTag` and `UnmeasuredReason` — share no member.
import { account, type Cause, type CauseTag } from "./account.ts";
import { PLACES, type PlaceKey } from "./places.ts";
import { copy } from "../copy/index.ts";

export type Place<T> =
  | { state: "filled"; place: PlaceKey; value: T }
  | { state: "accounted"; place: PlaceKey; line: string; cause: CauseTag };

/** The line for a place holding nothing because the customer has no
 *  presence yet. BP-019's declared signature, kept: a caller that has
 *  already decided the place is empty and has no cause to arbitrate. */
export function emptyStateLine(place: PlaceKey): { line: string } {
  return { line: copy(PLACES[place].line) };
}

/** Everything this module treats as "holds nothing". Deliberately narrow:
 *  `0` is a measured zero and fills its place (REQ-004 c7), and `''` is a
 *  string a caller composed, not an absence. */
function holdsNothing(place: PlaceKey, value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (isUnmeasured(value)) return true;
  // A `'module'` place has no value position at all: a chart with no
  // series, a list with no entries. Its "value" is whatever the module
  // would draw, so an object with no own entries holds nothing.
  if (PLACES[place].holds === "module" && typeof value === "object") {
    return Object.keys(value as object).length === 0;
  }
  return false;
}

function isUnmeasured(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    "kind" in value &&
    (value as { kind: unknown }).kind === "unmeasured"
  );
}

export function renderPlace<T>(
  place: PlaceKey,
  value: T | readonly [] | null,
  causes?: readonly Cause[]
): Place<T> {
  if (holdsNothing(place, value)) {
    return { state: "accounted", place, ...account(place, causes ?? []) };
  }
  return { state: "filled", place, value: value as T };
}
