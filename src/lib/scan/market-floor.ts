// Issue #770 (cold-start RCA #764, phase 1) — a pass that read the market
// and found too little of it to write anything.
//
// **The reason is already stored; this is the one reading of it.** A market
// too small to phrase a question from is `questions` at its `zero` arm — a
// measurement whose answer was nothing, never a vendor failure. No new
// `stopped_reason` and no blob version: the report field that fits is the
// one that holds the fact, and every consumer (the pass's status, the
// release notice, the owner's alert) asks this predicate rather than
// re-deciding it.
import type { Question } from "@/lib/market/questions/phrase";
import type { Measured } from "@/lib/measure/measured";
import type { StoppedReason } from "./report";

/** Fewer questions than this and the pass has nothing to plan pages from.
 *  One — i.e. zero questions — until phase 2 decides the real minimum. */
export const MARKET_QUESTION_FLOOR = 1;

/** True where the market was read and came back below the floor. An
 *  `unmeasured` set is not "too small": nobody got to read it. */
export function marketTooSmall(questions: Measured<readonly Question[]>): boolean {
  return questions.kind !== "unmeasured" && questions.value.length < MARKET_QUESTION_FLOOR;
}

/** A pass a ceiling stopped did not finish reading the market (issue 855,
 *  owner): it is never *market too small*, and the founder is never asked
 *  to change a category for it. It is measured again. */
export function stoppedOnCeiling(stoppedReason: StoppedReason): boolean {
  return stoppedReason === "time_ceiling" || stoppedReason === "spend_ceiling";
}
