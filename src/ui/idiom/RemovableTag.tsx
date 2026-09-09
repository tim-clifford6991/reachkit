// BUILD §4.3 · UI-SPEC S10 — a chosen rival, with the control that removes it.
// src/ui/idiom/RemovableTag.tsx
//
// S10 draws the competitors a founder has chosen as **mono tags on the
// accent tint, each carrying an ×**. That is a removal control, not a
// toggle: the founder is taking this rival out of their set (REQ-026 c7),
// and the × is what says so.
//
// **Why this is not `Btn` with `pressed`.** The standing ruling of
// 2026-09-08 fixes `/setup`'s *toggle groups* — the suggested rivals, the
// mode, the destination — as the outline rank on the accent tint keyed on
// `aria-pressed`, and those still are: a suggestion toggles on and off.
// A chosen tag is the other thing. It has one action, removal, so
// `aria-pressed` would claim a state it does not have, and `Btn`'s label
// is a `string` with nowhere for the × to go.
//
// The × is decoration and `aria-hidden`: the control's accessible name is
// the owner's removal word with the domain in it, so a screen reader is
// told what the button does rather than read a multiplication sign.
import type React from "react";

export function RemovableTag(p: {
  /** The rival's own domain — a value, in the numeral face (§2.3). */
  value: string;
  /** Owner's. The accessible name for removing this one. */
  removeLabel: string;
  onRemove?: () => void;
}): React.JSX.Element {
  return (
    <button type="button" className="rk-tag" aria-label={p.removeLabel} onClick={p.onRemove}>
      <span className="num">{p.value}</span>
      {/* The glyph is drawn by the stylesheet (`.rk-tag-x::after`), not
          written here: it is decoration on an `aria-hidden` element, and a
          character in JSX text is what the copy sweep reads as product
          voice — correctly, since it cannot tell a multiplication sign
          from a sentence. */}
      <span className="rk-tag-x" aria-hidden />
    </button>
  );
}
