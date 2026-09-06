// BUILD §9 — retry at most three times, withheld while the switch is off.
//
// §9: "failed → retry ×3 → needs_attention", and "Failed publish: back in
// the queue with a written reason; expired credential is a **state**
// (reconnect prompt, queue holds), not an error loop."
//
// The decision is one pure function of three facts — the reason, how many
// attempts have been made, and whether publishing is on — so every limb is
// testable without a clock and without a row. The scheduler over it is
// thin on purpose.
//
// **No page rests in `failed` without either a further attempt scheduled or
// the move to `needs_attention` already made** — with exactly one
// exception, and it is the reason this file reads the switch at all: while
// publishing is off, a retry that was due is *withheld* and the page is
// held in `failed` rather than moved. It becomes due again the moment
// publishing resumes. Moving it to `needs_attention` instead would bring a
// page to rest as needing the customer for something the customer already
// did on purpose.
//
// The archived plan is WO-214.
import { PUBLISH_RETRY_BACKOFF_MIN } from "@/lib/config/constants";
import { isPublishingOn } from "../switch";
import type { GuardDeps } from "../machine";
import { transition } from "../machine";
import type { Actor, FailureReason } from "../types";
import { isRetryable } from "./index";

/** §9's "×3", read off the backoff pin rather than written a second time:
 *  the schedule has one entry per retry, so the count and the schedule
 *  cannot disagree. */
export const MAX_RETRIES = PUBLISH_RETRY_BACKOFF_MIN.length;

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

/**
 * The whole policy, as one total function.
 *
 * Order matters and is §9's own: a reason the customer must clear is not a
 * retry that was due, so it comes to rest as needing them whether or not
 * publishing is on. Only a retry that *was* due is withheld by the switch.
 */
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

/**
 * Applies the decision to the page.
 *
 * A `needs_attention` decision is taken **in the same invocation** — that
 * is what keeps §9's promise that no page rests in `failed` with neither a
 * retry due nor that move made. A `retry` decision takes no edge: the page
 * stays in `failed` until its due moment, when the job claims it again and
 * `failed → publishing` is the edge that moves it.
 */
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
