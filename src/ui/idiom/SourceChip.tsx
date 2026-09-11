// BUILD §2.2, UI-SPEC §2 `Source chip | .srcchip` — the card head's provenance chip (#487).
// src/ui/idiom/SourceChip.tsx
//
// "mono 11.5 on `--sunk`, names a source and date." One renderer for every
// head that names where its reading came from: the report's two module-2
// cards (S2 — "Google AI answers · {date}", "your market's 12 biggest
// searches"), Overview's growth tile and the draft's copy card. Until #487
// the two report heads spelled it as a neutral `Badge` — a state chip, 700
// weight in the sans face — and the other two wrote `.rk-srcchip` inline.
//
// A widening of `Card`'s head slot, not a sixteenth component: it carries
// no daisyUI class and rides in `CardHead`'s `pill`.
//
// `wrap` is the report's arm. A date never folds (it is one value), so the
// chip is `nowrap` by default; the report's source lines are phrases in a
// half-width card, and at the compact band a phrase that cannot fold is
// wider than the card. Opted in, never inferred — whether a source is one
// value or a line of language is the caller's call, as with `Num`'s
// `phrase`, and it spends the same class.
import type React from "react";

export function SourceChip(p: {
  /** The source, already written — a copy key's text or a formatted date. */
  children: string;
  wrap?: boolean;
}): React.JSX.Element {
  return (
    // The wrap arm is `.num-phrase` — §2.3's ruled opt-in for a mono line
    // of language that folds at its spaces and never inside a word (#307).
    <span
      className={p.wrap === true ? "rk-srcchip num-phrase" : "rk-srcchip"}
      data-wrap={p.wrap === true ? "" : undefined}
    >
      {p.children}
    </span>
  );
}
