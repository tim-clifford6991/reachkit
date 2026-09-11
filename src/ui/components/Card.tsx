// BUILD §2.2 — daisyUI `card` / `card-body` / `card-title`.
// src/ui/components/Card.tsx
//
// `components.md` §1, verbatim: "`card`/`card-body`/`card-title`. Title slot
// takes a **verdict node**, not a metric label — §2.5: the card leads with
// the answer" | "default · degraded (one written line in place of a missing
// section — never an empty card, never a spinner)".
//
// `title` takes `React.ReactNode` (a verdict node — typically a `Badge` or a
// pair of them), never a plain label string, so a caller cannot pass a
// metric name where a verdict belongs by construction. The two states are a
// discriminated union on `state`, which is required and has no default:
// `degraded` carries `degradedLine` (the one written line) and no
// `children`; `default` carries `children` (the card body) and no
// `degradedLine`. Neither arm has a fallback string.
// ── The record for this file ─────────────────────────────────────────────
// Rulings of record for this module, moved out of `DECISIONS.md` on 2026-09-11
// (owner ruling: the record holds product rulings only; an implementation ruling
// belongs where the code is). Verbatim. The whole original record is
// `docs/archive/DECISIONS-full-2026-09-11.md`.
//
// DECISIONS 2026-09-07: A card's paragraphs never grow into stretched slack: card-body p is
//   grow-0 at the component (daisyUI's flex-grow: 1 default is overridden once in Card.tsx)
//   and module grids align items to the start; a value wrapped mid-word is caught by measuring
//   its line boxes (a whitespace-free mono run on two lines is a broken value), since the four
//   geometric checks cannot see it; the audit's "320px tables clip with no scroll container"
//   line was wrong — the registered Table's wrap was doing its job. — #277

import type React from "react";

type CardDefault = {
  state: "default";
  title: React.ReactNode;
  children: React.ReactNode;
  /** The approved set's `.card-accent` (UI-SPEC §2's component row:
   *  "`.card` (`.card-lg`, `.card-accent`)"): the same card, ringed in
   *  `--accent-line` rather than in `--line` — the card's own edge, in the
   *  accent. It marks the one card
   *  a screen is built around — on the report, the page it is giving away
   *  — and it is a *state of the card*, never a second fill: the accent
   *  stays in the edge, so the screen's one solid control keeps it.
   *  Optional, and absent everywhere it is not asked for. */
  accent?: boolean;
};

type CardDegraded = {
  state: "degraded";
  title: React.ReactNode;
  /** The one written line replacing a missing section — required, never a
   * fallback (BP-018 decision 2). Never an empty card, never a spinner. */
  degradedLine: string;
};

export type CardProps = CardDefault | CardDegraded;

export function Card(p: CardProps): React.JSX.Element {
  return (
    // 2026-09-05, issue #13: `card` alone is a radius and a layout in
    // daisyUI 5 — it paints no surface, draws no edge and casts no shadow.
    // `BUILD.md` §2.1 states the card idiom's own tokens (`--surface`,
    // `--line`, `--r-box`, `--shadow-card`) and §2.1's mapping puts them on
    // `base-100`/`base-300`, so the classes below are that mapping applied
    // rather than a second set of values: with only `card`, every card in
    // the product renders as white-on-white and the design system's own
    // surfaces are invisible.
    <div
      className={[
        "card bg-base-100 rounded-box border shadow-sm",
        p.state === "default" && p.accent === true ? "rk-accent-ring" : "border-base-300",
      ].join(" ")}
    >
      {/* `[&>p]:grow-0` (issue #244).
       *
       * daisyUI's own rule is `.card-body p { flex-grow: 1 }`, so every
       * paragraph in a card body absorbs whatever height the body has
       * spare. In a card the page stretched — a grid row matched to a
       * taller sibling, an `h-full` wrapper — that turns one line of text
       * into a 400px band and pushes everything under it down the card,
       * which is what the report's presence card was doing at 1024 and
       * 1280 (two bands of about 400px, above and below its bars).
       *
       * A card's content starts at the top. That is not a per-screen
       * choice, so it is stated here once rather than in every grid that
       * might stretch one — and the grid that stretched this one is fixed
       * too, in `_address/report-view.tsx`, because a card that keeps its
       * own height is the better answer where the layout allows it. */}
      <div className="card-body [&>p]:grow-0">
        {/* A card may be **headless**, and says so by passing `null`
            (issue #369). The approved set draws the offer card that way on
            both surfaces that carry it: it opens on the price, which is the
            answer §2.5 asks a card to lead with, and an eyebrow above it
            would name what the control below already names. The slot is
            still required — a caller opts out in writing rather than by
            omission — and an empty `card-title` is never rendered, because
            daisyUI gives it a margin and it would draw as a gap. */}
        {p.title === null ? null : <div className="card-title">{p.title}</div>}
        {p.state === "degraded" ? <p>{p.degradedLine}</p> : p.children}
      </div>
    </div>
  );
}
