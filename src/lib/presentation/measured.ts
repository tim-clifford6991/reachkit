// BUILD §2.5 — REQ-004's trichotomy, rendered — an unmeasured value says so.
// src/lib/presentation/measured.ts — WO-249, WO-278, BP-019
//
// renderMeasured(): REQ-004's trichotomy, rendered. There is no other way
// to put a measurement on a screen or in a mail. `Measured` and `CopyKey`
// are type-only imports; `copy` is the one value import.
import type { Measured } from "@/lib/measure/measured";
import type { CopyKey } from "./copy/index.ts";
import { copy } from "./copy/index.ts";

// Not exported: a second reader of the dash key is a second place a dash
// can be produced.
const DASH_KEY = "unmeasured.dash" satisfies CopyKey;

/** REQ-004's trichotomy, rendered. Exactly two branches — this shape, and
 *  not a three-arm switch:
 *
 *  (a) An unmeasured value cannot become a number. Inside the guard, `m`
 *  narrows to the `unmeasured` arm, which carries no `value` field.
 *  `o.format` is the only path from a `T` to a string, and the arm
 *  supplies none — "render an outage as 0" is uninhabited, not merely
 *  wrong.
 *
 *  (b) A measured zero cannot be dashed by a local edit. The fall-through
 *  is one branch covering `measured` and `zero` together, reached by
 *  narrowing by exclusion — the literal zero-kind string never appears in
 *  this file, so there is no zero branch to edit. */
export function renderMeasured<T>(
  m: Measured<T>,
  o: {
    format: (v: T) => string;
    unmeasuredLine: CopyKey; // differs by reason: undeterminable vs not_attempted
    what: string; // the subject unmeasuredLine's own {what} slot names (WO-287)
  }
): { text: string; isDash: boolean; line?: string } {
  if (m.kind === "unmeasured") {
    return { text: copy(DASH_KEY), isDash: true, line: copy(o.unmeasuredLine, { what: o.what }) };
  }
  return { text: o.format(m.value), isDash: false };
}
