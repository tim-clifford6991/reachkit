// BUILD §2.4 — the SVG presentation tokens the OG card still draws with.
//
// Debt, kept for one caller (docs/DESIGN.md: "`chart-primitives.ts` … debt
// kept only for `AiDotMatrixChart` … and the OG card; delete them with
// those"). The hand-drawn charts are gone — the series are Recharts (#550)
// and the AI-answers matrix is CSS grid (issue 730) — and the social card
// (`src/app/(public)/_seo/og-card.tsx`) renders through `next/og`, which
// takes inline SVG and no Recharts, so its two stroke tokens stay here
// until that card is redrawn. Delete this file with it.

/** SVG presentation tokens, named because the copy sweep presumes a bare
 *  string literal in a JSX attribute is product voice until something says
 *  otherwise, and a cap or a fill of `none` is paint, not a sentence. */
export const SVG = {
  capRound: "round",
  /** A shape carrying no fill of its own — a ring, or a line. */
  unfilled: "none",
} as const;
