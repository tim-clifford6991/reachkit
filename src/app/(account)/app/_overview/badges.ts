// docs/DESIGN.md rule 1 — the daisyUI badge each tone wears on Overview.
//
// One map, in one file, because the header, the three tiles and the page
// waiting for review all draw the same five tones and two maps are how one
// tone comes to be painted two ways on one screen. Class names, never
// sentences: every badge still carries its own word beside the colour
// (§2.5 — identity is never colour alone).
import type { Tone } from "@/ui/types";

export const BADGE: Readonly<Record<Tone, string>> = Object.freeze({
  accent: "badge badge-primary",
  ok: "badge badge-success badge-soft",
  warn: "badge badge-warning badge-soft",
  bad: "badge badge-error badge-soft",
  neutral: "badge badge-ghost",
});
