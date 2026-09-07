// BUILD §2.2, §2.5 — the approved card idiom's head slot (issue #266).
// src/ui/idiom/CardHead.tsx
//
// design/tokens.md §9.1: "Card head: a rounded-square icon chip in
// `--accent-bg`/`--accent`, an 11px uppercase eyebrow at `.1em` in
// `--ink-3`, an optional pill on the right." It is a **widening of the
// registered `Card`**, not a sixteenth component: it renders the head a
// card body leads with, and `components.md` §7 carries the row.
//
// `eyebrow` is required and has no default. A card head with no label is a
// card that leads with a picture, and §2.5 says every card leads with the
// answer. `icon` is optional: see its own note below.
//
// The chip is `--s-6` square. The ruled spacing ladder is closed
// (`design/tokens.md` §2) and 32 is the rung the idiom's drawn 30 lands on;
// a 30px token would be a value between two rungs, which the ladder's own
// rule refuses.
import type React from "react";

export function CardHead(p: {
  /** The chip's glyph — decorative, and **optional**. The idiom's own
   *  drawing puts a lucide glyph here; v3 ships no icon set, and adding one
   *  is a dependency the owner has not been asked for. A chip with no glyph
   *  is still the chip the idiom draws — a rounded square in
   *  `--accent-bg`/`--accent` — and it says nothing it cannot back up: an
   *  icon that means something is a claim, and three cards whose copy is
   *  not written yet cannot carry three claims. */
  icon?: React.ReactNode;
  /** Required, no default. The card's own answer, as a written line. */
  eyebrow: string;
  /** Optional, on the right: a `Badge`, a `Stat` label, a verdict chip. */
  pill?: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="rk-head">
      <span className="rk-head-l">
        <span className="rk-head-chip" aria-hidden>
          {p.icon ?? null}
        </span>
        <span className="eyebrow">{p.eyebrow}</span>
      </span>
      {p.pill ?? null}
    </div>
  );
}
