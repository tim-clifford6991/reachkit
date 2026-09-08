// BUILD §2.5 · REQ-004 c1 — the four score bands' tones, once.
// src/ui/bands.ts
//
// The band is a written word first (`SCORE_BANDS` in
// `src/lib/presentation/bands.ts`); the tone only agrees with it. Red is
// the customer's own problem being shown to them (§2.5), which "Invisible"
// is.
//
// **One map rather than one per surface** — the same argument
// `src/lib/presentation/bands.ts` makes for `PAGE_VERDICTS`: the report's
// verdict head (§4.1) and Overview's score tile (§4.5, UI-SPEC S12) speak
// the same four bands, and two maps are how two screens come to draw one
// band two colours. Issue #353 gave the score its second surface and the
// map its own file.
//
// **Here rather than in `src/lib/presentation/`**, where its written half
// lives: `Tone` is a `src/ui` type, and no file under `src/lib/**` imports
// from `@/ui` — a rule this file would be the first to break.
import type { BandHandle } from "@/lib/measure/bands";
import type { Tone } from "./types";

export const BAND_TONE: Readonly<Record<BandHandle, Tone>> = Object.freeze({
  invisible: "bad",
  "hard-to-find": "warn",
  findable: "ok",
  dominant: "ok",
});
