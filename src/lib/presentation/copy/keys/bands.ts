// BUILD §2.5 — the band words.
// src/lib/presentation/copy/keys/bands.ts — BP-020 decision 5, WO-041
//
// The band and severity words. The one partition seeded with real strings
// (WO-041 step 5): every value below is a transcription of an approved
// artifact, never a choice (constitution rule 1.2 — copying a recorded
// owner ruling is not inventing one). None of the thirteen is owner-owed:
// they have values, so copy() returns them.
import type { CopyPartition } from "../registry.ts";

export const BANDS_COPY = Object.freeze({
  // BP-019 decision 6 (owner ruling, 2026-08-31): winnability band words.
  "band.winnability.winnable": "Winnable",
  "band.winnability.reach": "Reach",
  // Unhyphenated: "Not yet" is the rendered term; the hyphenated
  // 'not-yet' is the internal handle and never renders.
  "band.winnability.notYet": "Not yet",

  // BP-019 decision 6 (owner ruling, 2026-08-31): rival-size band words.
  "band.rivalSize.near": "Similar size",
  "band.rivalSize.middle": "Larger",
  "band.rivalSize.far": "Much larger",

  // BP-019 decision 6 (owner ruling, 2026-08-31): REQ-009 criterion 8's
  // three severity words.
  "severity.low": "Minor",
  "severity.mid": "Worth fixing",
  "severity.high": "Critical",

  // REQ-004 criterion 1, whose own words these are.
  "band.score.invisible": "Invisible",
  "band.score.hard-to-find": "Hard to find",
  "band.score.findable": "Findable",
  "band.score.dominant": "Dominant",
}) satisfies CopyPartition;
