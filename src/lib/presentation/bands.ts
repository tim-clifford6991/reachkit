// BUILD §2.5 — the band words a verdict chip speaks.
// src/lib/presentation/bands.ts — WO-248, WO-278 (BP-019 decision 5;
// LIMITING_LINES added under rule 1.1, see WO-278 `## Decision taken under
// rule 1.1`)
//
// The band and severity handle→CopyKey maps. Every value here is a
// CopyKey; no string a person reads lives in this file. `CopyKey` is a
// type-only import — this module contributes no runtime edge into the
// copy registry and cannot be the reason a surface pulls the whole copy
// table in. Imports nothing from `src/lib/config/`: the boundaries a score
// is banded against are BP-005's `SCORE_BAND_BOUNDS`; this file holds only
// the words a banded handle renders as.
//
// ADR-001 is why the two band sets (`winnability`, `rivalSize`) sit in one
// file, `BAND_LABELS` — the disjointness it records is a property of this
// one export (WO-007). No flattened array of the six band
// terms is exported here, and no `BAND_TERMS` constant: a hand-written
// six-element array would be the seventh copy that lets a fourth term
// through undetected (ADR-001 point 4).
import type { CopyKey } from "./copy/index.ts";

/** BP-019 decision 6 (owner ruling, 2026-08-31): the winnability and
 *  rival-size band words. An annotation, not `satisfies` — totality over
 *  the two handle unions is the property that matters here, and a missing
 *  or a fourth handle is a compile error at the `Record<>`. */
export const BAND_LABELS: {
  winnability: Record<"winnable" | "reach" | "not-yet", CopyKey>;
  rivalSize: Record<"near" | "middle" | "far", CopyKey>;
} = {
  winnability: {
    winnable: "band.winnability.winnable",
    reach: "band.winnability.reach",
    // Deliberate asymmetry, not smoothed (BP-019 decision 6): the handle
    // is 'not-yet', hyphenated; the CopyKey is camel-cased 'notYet'; the
    // rendered term is "Not yet", unhyphenated. All three are correct in
    // their own place.
    "not-yet": "band.winnability.notYet",
  },
  rivalSize: {
    near: "band.rivalSize.near",
    middle: "band.rivalSize.middle",
    far: "band.rivalSize.far",
  },
};

/** REQ-004 criterion 1's own four words, transcribed, never chosen — the
 *  order `BUILD.md` §5 states: invisible, hard-to-find, findable,
 *  dominant. No boundary and no number here: BP-005's `SCORE_BAND_BOUNDS`
 *  holds the four boundaries, this map holds the four words. */
export const SCORE_BANDS: Record<"invisible" | "hard-to-find" | "findable" | "dominant", CopyKey> = {
  invisible: "band.score.invisible",
  "hard-to-find": "band.score.hard-to-find",
  findable: "band.score.findable",
  dominant: "band.score.dominant",
};

/** REQ-009 c8's three levels, ascending in the count (ruled by the owner
 *  on 2026-08-31): index 0 is the level a problem measured at 0 carries,
 *  index 2 the most severe, so "the larger count never carries the lower
 *  severity" is a property of the tuple's order. Not keyed by the handle —
 *  consumers index it by ordinal through BP-027's handle→index map (low:
 *  0, mid: 1, high: 2), so `SEVERITY['low']` is a compile error by
 *  design. */
export const SEVERITY: readonly [CopyKey, CopyKey, CopyKey] = [
  "severity.low",
  "severity.mid",
  "severity.high",
] as const;

/** Added 2026-09-04 under rule 1.1 (WO-278 `## Decision taken under rule
 *  1.1`): BP-024 decision 6 removed the three driver bars and put one
 *  written line in their place, naming BP-019 as the node that holds it.
 *  Same shape as `SCORE_BANDS`: a handle becomes a `CopyKey` and nothing
 *  else. The three keys ship owner-owed and empty; `copy()` throws naming
 *  the key rather than rendering a blank. */
export const LIMITING_LINES: Readonly<Record<"foundations" | "answerability" | "presence", CopyKey>> = {
  foundations: "verdict.limiting.foundations",
  answerability: "verdict.limiting.answerability",
  presence: "verdict.limiting.presence",
};

/** Added 2026-09-06, issue #47 (REQ-063): the four words a published
 *  page's weekly standing is spoken as. Same shape as `SCORE_BANDS` — a
 *  handle becomes a `CopyKey` and nothing else — and one map rather than
 *  one per surface, because §4.5's Overview, §4.6's calendar and §12's
 *  Monday mail all speak the same four and must not word them
 *  differently.
 *
 *  The fourth is not a fourth verdict: REQ-063 c6's page carries it "in
 *  place of the three". The two row-less standings — a week that was not
 *  measured, and a page this week could not decide — have no entry here at
 *  all: they are properties of a week and a measurement rather than
 *  verdicts, they are stated once per week and not once per page (ADR-071
 *  point 3), and giving them a word beside these four is the merge
 *  ADR-071 forbids. */
export const PAGE_VERDICTS: Readonly<
  Record<"working" | "too_early" | "not_working" | "not_judgeable", CopyKey>
> = {
  working: "verdict.page.working",
  too_early: "verdict.page.too_early",
  not_working: "verdict.page.not_working",
  not_judgeable: "verdict.page.not_judgeable",
};
