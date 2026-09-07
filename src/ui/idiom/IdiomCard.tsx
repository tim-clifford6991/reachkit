// BUILD §2.2 — the approved card idiom's box (issue #266).
// src/ui/idiom/IdiomCard.tsx
//
// The registered `Card` with the idiom's own skin: no border, separated by
// `--shadow-lift`, and the head slot above the body. design/tokens.md §9.1's
// first rule — "soft grey `--bg` ground, white `--surface` cards separated
// by shadow, never a border" — is the whole reason `--shadow-lift` exists,
// because `--shadow-card` is a 1px hairline that cannot carry an edge once
// the border is gone.
//
// The radius is the **ruled** `--r-box` 14px. The idiom proposed
// `--r-card` 18px as a second variable rather than an edit of the first,
// precisely so that a ruled value would not be re-drawn; taking the 18 here
// would be the unruled value arriving by being drawn (tokens.md §9.2).
//
// `head` is required. `pad="lg"` is the "--s-6 for a larger card" arm and is
// the caller's opt-in — a card never infers its own padding from how wide
// its column happens to be (ADR-093 decision 4 hands that judgement to the
// preview gate, not to a token).
import type React from "react";

export function IdiomCard(p: {
  head: React.ReactNode;
  children: React.ReactNode;
  pad?: "lg";
  testId?: string;
}): React.JSX.Element {
  return (
    <section className="rk-idiom-card" data-pad={p.pad} data-testid={p.testId}>
      {p.head}
      {p.children}
    </section>
  );
}
