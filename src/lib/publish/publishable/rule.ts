// BUILD §9 — the two predicates the state machine's guards read: the one real implementation of the `PublishableRule`
// seam `machine/guards.ts` injects, so the machine never re-implements the veto window and this leaf never transitions.
// It imports `predicate.ts` and `telling.ts`, never `veto.ts` (which imports `transition()`), so no path leads back into `machine/` (ADR-092).
import type { DraftView } from "../types";
import { becomesPublishable } from "./predicate";
import { toldCurrentPair } from "./telling";

export interface PublishableRuleShape {
  becomesPublishable(draft: DraftView, at: Date): boolean;
  toldCurrentPair(draft: DraftView): boolean;
}

/** `publishable_and_due`: criterion 2's four conjuncts, and due at the first publish time at or after that, never before,
 *  compared against the clock the whole pass was fixed against. */
export function publishableAndDue(draft: DraftView, at: Date): boolean {
  const answer = becomesPublishable(draft);
  return answer.publishable && answer.at.getTime() <= at.getTime();
}

/** `customer_told`. REQ-057 c8: no page publishes without the customer told on the pair it publishes under;
 *  "never told" and "told on a pair that has since changed" both hold it. */
export function customerTold(draft: DraftView): boolean {
  return toldCurrentPair(draft).told;
}

/** The seam's implementation, frozen. */
export const PUBLISHABLE_RULE: PublishableRuleShape = Object.freeze({
  becomesPublishable: publishableAndDue,
  toldCurrentPair: customerTold,
});
