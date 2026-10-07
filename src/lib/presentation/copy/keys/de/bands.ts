// src/lib/presentation/copy/keys/de/bands.ts — the `bands` partition in German
// (SPEC §6, owner D66 of 2026-10-07, issue 1311): what a German site's
// founder and its report's reader are shown. Drafted (issue 759); the pull
// request lists every sentence for the owner to correct.
//
// One entry per key of `../bands.ts`, with the same `{slots}`. A key left out
// is shown in English.
import type { CopyTranslation } from "../../translated.ts";

export const BANDS_COPY_DE = {
  "band.winnability.winnable": "Machbar",
  "band.winnability.reach": "Ambitioniert",
  "band.winnability.notYet": "Noch nicht",

  "band.rivalSize.near": "Ähnlich groß",
  "band.rivalSize.middle": "Größer",
  "band.rivalSize.far": "Viel größer",

  "severity.low": "Gering",
  "severity.mid": "Lohnt sich zu beheben",
  "severity.high": "Kritisch",

  "band.score.invisible": "Unsichtbar",
  "band.score.hard-to-find": "Schwer zu finden",
  "band.score.findable": "Auffindbar",
  "band.score.dominant": "Dominant",
} as const satisfies CopyTranslation;
