// BUILD §2 — ADR-093's three bands.
// src/ui/layout/bands.ts
//
// BP-018 `## Public interface`, "Layout (ADR-093)" — `BANDS`, `Band` and
// `Arm` transcribed verbatim (WO-269 file plan). `BAND_MIN` is this order's
// own: the lower bound of each band, in CSS px. `design/tokens.md` §2b is
// the one home for the two breakpoint values (rule 2.4); the three numbers
// below transcribe it and ADR-093 decision 2 (WO-269 rests-on row 3), and
// the conformance suite (`tests/ui/layout/layout.test.ts`) pins them back
// against `:root`'s declared custom properties so the transcription and the
// CSS declaration cannot silently diverge (the pinned-value shape,
// structure.md rule 5).

// ── Layout (ADR-093). Three bands, closed; a fourth is an ADR, not a query. ──
export const BANDS = ["compact", "medium", "wide"] as const;
export type Band = (typeof BANDS)[number];

/** What this surface does in one band. No optional member: a surface that has
 *  nothing to say at a band says so with `same-as-below`, which is a decision
 *  someone made rather than a field someone forgot. */
export type Arm =
  | { kind: "same-as-below" }
  | { kind: "columns"; count: 1 | 2 | 3 }
  | { kind: "declared"; note: string };

/**
 * The lower bound of each band, in CSS px. No other magic number belongs in
 * this file — each of the three carries the token or decision it transcribes.
 */
export const BAND_MIN: Record<Band, number> = {
  // ADR-093 decision 2: "the product therefore commits to 320 CSS px and
  // above" — the supported floor. Not a `--breakpoint-*` token: decision 1
  // only mints tokens for the two boundaries between bands.
  compact: 320,
  // `design/tokens.md` §2b `--breakpoint-lg` (1024px): "The sidebar
  // returns" — the structural fact ADR-093 decision 1's table uses to place
  // the compact|medium boundary.
  medium: 1024,
  // `design/tokens.md` §2b `--breakpoint-xl` (1280px): "The day panel sits
  // beside the grid" — the structural fact ADR-093 decision 1's table uses
  // to place the medium|wide boundary.
  wide: 1280,
};
