// BUILD §2.2 — the approved card idiom's box (issue #266).
// src/ui/idiom/IdiomCard.tsx
//
// The registered `Card` with the idiom's own skin: no border, separated by
// `--shadow-card`, and the head slot above the body. The idiom's first rule
// — "soft grey `--bg` ground, white `--surface` cards separated by shadow,
// never a border" — is why a card has a shadow at all. It drew that
// separation with a heavier `--shadow-lift` of its own until issue #349:
// the approved set (`docs/design/approved/tokens.css`) names one card
// shadow, so the lift is resolved to it rather than kept as a value nobody
// approved.
//
// The radius is `--r-box` 14px, and ruling 8a (2026-09-08) struck the
// `--r-card` 18px the idiom had proposed beside it — "Card radius is
// `--r-box: 14px` everywhere". This component always drew the 14; what
// changed is that the alternative no longer exists.
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
