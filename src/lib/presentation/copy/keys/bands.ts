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
  "band.winnability.winnable": ["Winnable", { slots: {}, fixedBy: "REQ-047 c10" }],
  "band.winnability.reach": ["Reach", { slots: {}, fixedBy: "REQ-047 c10" }],
  // Unhyphenated: "Not yet" is the rendered term; the hyphenated
  // 'not-yet' is the internal handle and never renders.
  "band.winnability.notYet": ["Not yet", { slots: {}, fixedBy: "REQ-047 c10" }],

  // BP-019 decision 6 (owner ruling, 2026-08-31): rival-size band words.
  "band.rivalSize.near": ["Similar size", { slots: {}, fixedBy: "REQ-096 c2" }],
  "band.rivalSize.middle": ["Larger", { slots: {}, fixedBy: "REQ-096 c2" }],
  "band.rivalSize.far": ["Much larger", { slots: {}, fixedBy: "REQ-096 c2" }],

  // BP-019 decision 6 (owner ruling, 2026-08-31): REQ-009 criterion 8's
  // three severity words.
  "severity.low": ["Minor", { slots: {}, fixedBy: "REQ-009 c8" }],
  "severity.mid": ["Worth fixing", { slots: {}, fixedBy: "REQ-009 c8" }],
  "severity.high": ["Critical", { slots: {}, fixedBy: "REQ-009 c8" }],

  // REQ-004 criterion 1, whose own words these are.
  "band.score.invisible": ["Invisible", { slots: {}, fixedBy: "REQ-004 c1" }],
  "band.score.hard-to-find": ["Hard to find", { slots: {}, fixedBy: "REQ-004 c1" }],
  "band.score.findable": ["Findable", { slots: {}, fixedBy: "REQ-004 c1" }],
  "band.score.dominant": ["Dominant", { slots: {}, fixedBy: "REQ-004 c1" }],
}) satisfies CopyPartition;
