// docs/DESIGN.md, "The calm layer" — edges and lift (owner, 2026-09-24, #1064).
// src/ui/lift.ts
//
// "A clickable card lifts 2px on hover and its arrow nudges 3px; a card that
// does nothing does not move. The deep floating shadow is spent in two
// places only."
//
// Class strings, not a component: the card stays a daisyUI `card` on an
// `<a>`, and these ride beside its own classes. `CARD_LIFT` goes on the
// clickable card, which is also the `group` its arrow reads; `ARROW_NUDGE`
// goes on that arrow. A card that opens nothing takes neither.
//
// `FLOAT` is `--shadow-float` (`theme.css`), for the landing's product
// preview and the report's price card and nothing else.

export const CARD_LIFT =
  "group transition-[transform,box-shadow,border-color] duration-200 motion-safe:hover:-translate-y-0.5 hover:shadow-md";

export const ARROW_NUDGE = "transition-transform duration-200 motion-safe:group-hover:translate-x-[3px]";

export const FLOAT = "shadow-(--shadow-float)";
