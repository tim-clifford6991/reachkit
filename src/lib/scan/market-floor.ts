// A pass that read the market and found too little of it to write anything. The fact is already stored as `questions` at its `zero` arm,
// so there is no new `stopped_reason`; every consumer (the pass's status, the release notice, the owner's alert) asks this predicate rather than re-deciding it.
import type { Question } from "@/lib/market/questions/phrase";
import type { Measured } from "@/lib/measure/measured";
import type { StoppedReason } from "./report";

/** Fewer questions than this and the pass has nothing to plan pages from. */
export const MARKET_QUESTION_FLOOR = 1;

/** True where the market was read and came back below the floor. An
 *  `unmeasured` set is not "too small": nobody got to read it. */
export function marketTooSmall(questions: Measured<readonly Question[]>): boolean {
  return questions.kind !== "unmeasured" && questions.value.length < MARKET_QUESTION_FLOOR;
}

/** A pass a ceiling stopped did not finish reading the market: never "market too small", never a reason to ask for a new category. It is measured again. */
export function stoppedOnCeiling(stoppedReason: StoppedReason): boolean {
  return stoppedReason === "time_ceiling" || stoppedReason === "spend_ceiling";
}
