// UI-SPEC §2 — an address inside one of the owner's sentences, in the mono face.
// src/app/_fallback/AddressLine.tsx
//
// Two screens write an address inside a sentence and the approved set draws
// it in JetBrains Mono: S7's "No more follow-up mail will reach {address} —
// …" and S8's "Reports live at {address}." §2 makes the face a rule —
// "numerals, dates, URLs, searches and code: JetBrains Mono with
// tabular-nums" — and a face is not something a string can carry, so the
// sentence is split around its slot at render time and the address takes
// `.num`, which is the one rule in `src/ui/type.css` that binds the mono
// family.
//
// **One sentence, one key, still.** The split is on the *resolved* string
// rather than on the registry's `{slot}` marker: `copy()` stays the only
// reader of `COPY`, the marker's syntax stays that module's private
// convention (`copy.ts`'s header: "no caller ever sees the marker"), and
// what this file splits is the owner's sentence with a sentinel where the
// substitution landed. The sentinel is U+0000 — no sentence written by
// anyone contains one — so the split can only ever fall where the address
// went, and a key whose sentence declares no `address` slot is a `copy()`
// throw naming the slot rather than a silent miss.
//
// The slot's name is this file's and not its caller's: both sentences call
// it `address`, one name has one home, and a component that took the name
// as a prop would let two screens spell the same slot differently.
import type React from "react";
import { copy, type CopyKey } from "@/lib/presentation/copy";

/** Not a character any sentence can contain, so the one split below is the
 *  substitution's own boundary and never a coincidence of the text. */
const SENTINEL = "\u0000";

/** The one slot name these two sentences declare. */
const SLOT = "address";

export function AddressLine(p: {
  /** Spelled `copyKey` and not `key`: `key` is React's own reserved prop
   *  and would never reach this component. */
  copyKey: CopyKey;
  /** The address that goes in it, drawn in the mono face. */
  address: string;
}): React.JSX.Element {
  const [before = "", after = ""] = copy(p.copyKey, { [SLOT]: SENTINEL }).split(SENTINEL);
  return (
    // **The line is a declared scroll container** (issue #327). `.num` bans
    // every break inside a value — `overflow-wrap`, `word-break` and
    // `white-space` all say so, and `src/ui/type.css` states why: "a value
    // that cannot fit now overflows its box instead of quietly rewriting
    // itself … ADR-093's rule decides what happens next — the *box*
    // changes, with the `overflow-x-auto` wrap". S8's address is 32 mono
    // characters and a full stop, which is 297px at the body rung; the
    // compact band's reading column is 288. So the box changes here, in the
    // same three classes the registered `Table` carries (`min-w-0` because
    // a scroll container that cannot shrink never scrolls).
    //
    // `text-start` is the fourth and it is not decoration: S8 centres its
    // column, and a line centred inside a box it overflows puts half the
    // overflow to the **left**, where no scroll position in a left-to-right
    // document can reach it — a value clipped, which is the one thing the
    // ruling that allows this box refuses. Where the line fits, the box is
    // shrink-to-fit and exactly as wide as its widest line, so starting and
    // centring are the same pixels; it differs only at the width where the
    // value would otherwise be cut.
    <p className="min-w-0 max-w-full overflow-x-auto text-start">
      {before}
      <span className="num">{p.address}</span>
      {after}
    </p>
  );
}
