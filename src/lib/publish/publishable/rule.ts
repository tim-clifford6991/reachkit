// BUILD §9 — the predicate the state machine's guard reads: the one real implementation of the `PublishableRule`
// seam `machine/guards.ts` injects, so the machine never re-implements the veto window and this leaf never transitions.
// It imports `predicate.ts`, never `veto.ts` (which imports `transition()`), so no path leads back into `machine/` (ADR-092).
import type { DraftView } from "../types";
import { becomesPublishable } from "./predicate";

export interface PublishableRuleShape {
  becomesPublishable(draft: DraftView, at: Date): boolean;
}

/** `publishable_and_due`: criterion 2's four conjuncts, and due at the first publish time at or after that, never before,
 *  compared against the clock the whole pass was fixed against. */
export function publishableAndDue(draft: DraftView, at: Date): boolean {
  const answer = becomesPublishable(draft);
  return answer.publishable && answer.at.getTime() <= at.getTime();
}

/** The seam's implementation, frozen. */
export const PUBLISHABLE_RULE: PublishableRuleShape = Object.freeze({
  becomesPublishable: publishableAndDue,
});
