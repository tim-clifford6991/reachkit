// BUILD §9 — the two predicates the state machine's guards read.
//
// `machine/guards.ts` declares `PublishableRule` as a seam and injects it,
// so the machine never re-implements the veto window and this leaf never
// takes a transition. This file is the seam's one real implementation: two
// booleans over a `DraftView`, delegating to the modules that own them.
//
// It imports `predicate.ts` and `telling.ts` and **not** `veto.ts`, which
// imports `transition()`. That is what keeps the graph acyclic at file
// granularity (ADR-092): `machine/guards.ts → publishable/rule.ts →
// {predicate, telling}` has no path back into `machine/`.
//
// The archived plans are WO-215 and WO-216.
import type { DraftView } from "../types";
import { becomesPublishable } from "./predicate";
import { toldCurrentPair } from "./telling";

export interface PublishableRuleShape {
  becomesPublishable(draft: DraftView, at: Date): boolean;
  toldCurrentPair(draft: DraftView): boolean;
}

/**
 * `publishable_and_due`, as one boolean.
 *
 * Two halves, and the guard's name says both: **publishable** is criterion
 * 2's four conjuncts, and **due** is "at the first publish time at or after
 * it becomes publishable, and never before" — the moment the predicate
 * returns, compared against the clock the whole pass was fixed against.
 */
export function publishableAndDue(draft: DraftView, at: Date): boolean {
  const answer = becomesPublishable(draft);
  return answer.publishable && answer.at.getTime() <= at.getTime();
}

/** `customer_told`, as one boolean. REQ-057 c8: no page publishes at all
 *  without the customer having been told on the pair it actually publishes
 *  under. Both "never told" and "told on a pair that has since changed"
 *  hold the page. */
export function customerTold(draft: DraftView): boolean {
  return toldCurrentPair(draft).told;
}

/** The seam's implementation, frozen. */
export const PUBLISHABLE_RULE: PublishableRuleShape = Object.freeze({
  becomesPublishable: publishableAndDue,
  toldCurrentPair: customerTold,
});
