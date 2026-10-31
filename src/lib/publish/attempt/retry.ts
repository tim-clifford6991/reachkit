// BUILD §9 — "failed → retry ×3 → needs_attention"; an expired credential is a state (reconnect, queue holds), not an
// error loop. One pure decision over the reason, the attempts and the switch, with a thin scheduler over it.
// No page rests in `failed` without a further attempt scheduled or the move to `needs_attention` made, except while
// publishing is off: a due retry is withheld, since the customer paused on purpose and is not needed.
import { PUBLISH_RETRY_BACKOFF_MIN } from "@/lib/config/constants";
import { critical, needsYouOf } from "../record/needs-you";
import { isPublishingOn } from "../switch";
import type { GuardDeps } from "../machine";
import { transition } from "../machine";
import type { Actor, FailureReason } from "../types";
import { isRetryable } from "./index";

/** §9's "×3", read off the backoff pin so the count and the schedule cannot disagree. */
export const MAX_RETRIES = PUBLISH_RETRY_BACKOFF_MIN.length;

/** Owner O7's daily re-attempt of a publish tried to exhaustion, made through `needs_attention → publishing`, whose
 *  guards all still hold it. */
export const REATTEMPT_BY: Actor = { kind: "system", job: "publish/retry" };

/** Whether a page resting on a publish tried to exhaustion is re-attempted now: 23 h after its last claim, while the
 *  cause is not yet critical. A destination the customer must fix is never re-attempted here. */
export function reattemptDue(page: { state: unknown; transitions: unknown; claimedAt: Date }, now: Date): boolean {
  const cause = page.state === "needs_attention" ? needsYouOf({ state: "needs_attention", transitions: page.transitions, meta: null }) : null;
  if (cause?.kind !== "delivery" || critical(cause, now)) return false;
  // 23 h, so an hourly tick that lands late never slips a whole day and seven days hold seven re-attempts.
  return now.getTime() - page.claimedAt.getTime() >= 23 * 3_600_000;
}

export type RetryDecision =
  | { kind: "retry"; dueAt: Date; retryNo: number }
  | { kind: "withheld" }
  | { kind: "needs_attention"; because: "reason_needs_customer" | "retries_exhausted" };

export interface RetryFacts {
  reason: FailureReason;
  /** How many attempts have been made, the first included. */
  attemptNo: number;
  switchOn: boolean;
}

/** The whole policy. §9's order: a reason the customer must clear rests as needing them even with publishing off; only
 *  a due retry is withheld by the switch. */
export function decideRetry(facts: RetryFacts, at: Date): RetryDecision {
  if (!isRetryable(facts.reason)) {
    return { kind: "needs_attention", because: "reason_needs_customer" };
  }

  const retriesSoFar = Math.max(0, facts.attemptNo - 1);
  if (retriesSoFar >= MAX_RETRIES) {
    return { kind: "needs_attention", because: "retries_exhausted" };
  }

  if (!facts.switchOn) return { kind: "withheld" };

  const minutes = PUBLISH_RETRY_BACKOFF_MIN[retriesSoFar] ?? 0;
  return {
    kind: "retry",
    dueAt: new Date(at.getTime() + minutes * 60_000),
    retryNo: retriesSoFar + 1,
  };
}

export interface ScheduleRetryArgs {
  draftId: string;
  siteId: string;
  reason: FailureReason;
  attemptNo: number;
  by: Actor;
  at?: Date;
  deps?: GuardDeps;
  switchOn?: boolean;
}

/** Applies the decision. `needs_attention` is taken in the same invocation, which keeps §9's promise; a `retry` takes no
 *  edge until the job claims it again by `failed → publishing`. */
export async function scheduleRetry(a: ScheduleRetryArgs): Promise<RetryDecision> {
  const at = a.at ?? new Date();
  const switchOn = a.switchOn ?? (await isPublishingOn(a.siteId));
  const decision = decideRetry({ reason: a.reason, attemptNo: a.attemptNo, switchOn }, at);

  if (decision.kind === "needs_attention") {
    await transition(a.draftId, "needs_attention", a.by, {
      at,
      ...(a.deps === undefined ? {} : { deps: a.deps }),
      reason: decision.because,
    });
  }

  return decision;
}
