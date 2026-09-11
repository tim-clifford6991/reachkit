// BUILD §9 — the weekly judgement's one public entry.
//
// Four things leave this leaf and nothing else: the four standings and the
// types they are made of, the judgement, the two reads every surface and
// the Monday mail share, and the store seam the suites swap. The
// projections (`weekMeasurementsFrom`) and the three pure decisions
// (`evaluateAcceptance`, `verdictFor`, `movementFor`) are internal — a
// caller that reached them could produce a verdict from a measurement that
// is not the week's.
// ── The record for this file ─────────────────────────────────────────────
// Rulings of record for this module, moved out of `DECISIONS.md` on 2026-09-11
// (owner ruling: the record holds product rulings only; an implementation ruling
// belongs where the code is). Verbatim. The whole original record is
// `docs/archive/DECISIONS-full-2026-09-11.md`.
//
// DECISIONS 2026-09-01: A page has four ways of having no ordinary verdict — verdict / not
//   judgeable / not measured / no week — none may be merged, and all four are terminal. —
//   ADR-071, ADR-072
//
// DECISIONS 2026-09-06: Weekly verdicts: one `page_verdicts` row per published page per week,
//   unique on (publication_id, week_start); evaluate first, age second — a page under three
//   weeks that already passes reads working, one that does not reads too_early; a prior
//   not_judgeable short-circuits before evaluation; readWeek never falls back to a
//   neighbouring week. ARCHITECTURE's opportunities row names `judgeWeek()` / `readWeek()` /
//   `weeklyDigest()` (not `judgePublished()`). — #138

export type {
  CheckId,
  Movement,
  NotJudgeableCause,
  Verdict,
  VerifyNote,
  WeekMeasurements,
  WeekStanding,
  WeekStart,
} from "./types";
export { NOT_JUDGEABLE_CAUSES } from "./types";

export { judgeWeek, type PageStanding } from "./judge";
export { readWeek, weeklyDigest, type DigestPage } from "./read";

export { readVerification, setVerdictStore, type PublishedPage, type VerdictStore } from "./store";
