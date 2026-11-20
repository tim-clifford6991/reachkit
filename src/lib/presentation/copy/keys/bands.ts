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
  "band.winnability.winnable": ["Winnable", { slots: {} }],
  "band.winnability.reach": ["Reach", { slots: {} }],
  // Unhyphenated: "Not yet" is the rendered term; the hyphenated
  // 'not-yet' is the internal handle and never renders.
  "band.winnability.notYet": ["Not yet", { slots: {} }],

  // BP-019 decision 6 (owner ruling, 2026-08-31): rival-size band words.
  "band.rivalSize.near": ["Similar size", { slots: {} }],
  "band.rivalSize.middle": ["Larger", { slots: {} }],
  "band.rivalSize.far": ["Much larger", { slots: {} }],

  // BP-019 decision 6 (owner ruling, 2026-08-31): REQ-009 criterion 8's
  // three severity words.
  "severity.low": ["Minor", { slots: {} }],
  "severity.mid": ["Worth fixing", { slots: {} }],
  "severity.high": ["Critical", { slots: {} }],

  // REQ-004 criterion 1, whose own words these are.
  "band.score.invisible": ["Invisible", { slots: {} }],
  "band.score.hard-to-find": ["Hard to find", { slots: {} }],
  "band.score.findable": ["Findable", { slots: {} }],
  "band.score.dominant": ["Dominant", { slots: {} }],
}) satisfies CopyPartition;
