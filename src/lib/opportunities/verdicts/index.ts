// BUILD §9 — the weekly judgement's one public entry.
//
// Five things leave this leaf and nothing else: the four standings and the
// types they are made of, the judgement, the two reads every surface and
// the Monday mail share, a page's label, and the store seam the suites swap. The
// projections (`weekMeasurementsFrom`) and the two pure decisions
// (`evaluateAcceptance`, `movementFor`) are internal — a
// caller that reached them could produce a verdict from a measurement that
// is not the week's.
export type {
  CheckId,
  Label,
  Movement,
  NotJudgeableCause,
  Verdict,
  VerifyNote,
  WeekMeasurements,
  WeekStanding,
  WeekStart,
} from "./types";
export type { IndexState } from "./seen";

export { judgeWeek, type PageStanding } from "./judge";
export { readWeek, weeklyDigest, type DigestPage } from "./read";

export { setVerdictStore, type PublishedPage, type VerdictStore } from "./store";
