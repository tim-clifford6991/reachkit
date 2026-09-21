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
    // **A declared scroll container, and it takes its card's alignment**
    // (issue #327; alignment corrected 2026-09-21 on the owner's review of
    // #936).
    //
    // `.num` bans every break inside a value — `overflow-wrap`,
    // `word-break` and `white-space` all say so, and `src/ui/type.css`
    // states why: "a value that cannot fit now overflows its box instead
    // of quietly rewriting itself … ADR-093's rule decides what happens
    // next — the *box* changes, with the `overflow-x-auto` wrap". So the
    // box changes here, in the same classes the registered `Table` carries
    // (`min-w-0`, because a scroll container that cannot shrink never
    // scrolls).
    //
    // **It was `text-start`, and that was the wrong half of a real
    // hazard.** A line centred inside a box it overflows puts half the
    // overflow to the *left*, where no scroll position in a left-to-right
    // document can reach it. True — but the sentence around the value
    // wraps at its spaces, so at the widths the 2026-09-20 ruling names
    // the paragraph does not overflow at all: at 390 it is 326px holding a
    // 289px value, 37px to spare, and it simply takes two lines.
    // `text-start` then left-aligned those two lines under a centred
    // heading and a centred line, which is what the owner saw.
    //
    // So the sentence centres with the rest of the card, and the hazard is
    // recorded rather than guarded against at a width the product does not
    // claim: below about 330 the value would overflow and centring would
    // put some of it out of reach. The floor is 390.
    //
    // (The other fix — the scroll box on the value's own span — was tried
    // and reverted: `overflow` gives an inline-block a new formatting
    // context, which moved the sentence's closing full stop 3px off the
    // baseline at every width, to buy a guard that never fires above 330.)
    <p className="min-w-0 max-w-full overflow-x-auto">
      {before}
      <span className="num">{p.address}</span>
      {after}
    </p>
  );
}
