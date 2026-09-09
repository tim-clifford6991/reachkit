// BUILD §2.2, §4.3 · UI-SPEC S10 — the approved set's option pair.
// src/ui/idiom/OptionCard.tsx
//
// S10 draws the mode and the destination as **pairs of pressable cards**,
// not as chip rows: a title with an optional `default` badge, one dim line
// under it, and — for the hosted destination — the CNAME record inside the
// card it belongs to. A chip row cannot hold the line or the record, which
// is why the set draws a card.
//
// **Not a sixteenth daisyUI component.** BUILD §2.2's set of fifteen is
// closed and this is a widening of the idiom the way `ActionPanel` is: the
// idiom's own vocabulary (`--surface`, `--r-box`, the accent tint) on a
// `<button>`. It writes no daisyUI class.
//
// **Selected is `aria-pressed`, and the tint is keyed off it** — the
// standing ruling of 2026-09-08 (#288, and DECISIONS' own row for
// `/setup`: "every toggle group draws selected as the outline rank on the
// accent tint keyed on aria-pressed"). So a card that looks chosen is
// chosen in the accessibility tree by construction, and the two cannot
// diverge.
//
// `title` and `line` are the owner's words and both required — an option
// with no line is an option whose consequence nobody stated. `line` may be
// the registry's `TODO(copy)` marker, which is the honest rendering while
// the sentence is owed; it may not be absent.
import type React from "react";

export function OptionCard(p: {
  /** Owner's. The option's own name. */
  title: string;
  /** Owner's. One dim line saying what choosing it means. */
  line: string;
  chosen: boolean;
  /** The word for a preselected option, where the model marks one
   *  (REQ-027 c1). Absent on every other card. */
  badge?: string;
  /** What the option carries inside it — the hosted destination's CNAME
   *  record, and nothing else so far. */
  children?: React.ReactNode;
  onChoose?: () => void;
  testId?: string;
}): React.JSX.Element {
  return (
    <button
      type="button"
      className="rk-opt"
      aria-pressed={p.chosen}
      onClick={p.onChoose}
      data-testid={p.testId}
    >
      <span className="rk-opt-t">
        {p.title}
        {p.badge === undefined ? null : <span className="rk-opt-badge">{p.badge}</span>}
      </span>
      <span className="rk-opt-d">{p.line}</span>
      {p.children}
    </button>
  );
}
