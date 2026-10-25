// BUILD §9 · REQ-073 c4 — what a saved settings change does to each draft not yet published, as one pure function
// (no clock, database or settings read), so every limb is testable at its boundary:
//   1. Scope: a draft not yet published, in review included; `published`, `skipped` and `unpublished` are untouched.
//   2. Never shortened: the result is never earlier than the deadline in force.
//   3. Lengthened keeps the later: in review, `max(currentDeadline, enteredReviewAt + next)`.
import type { State } from "../types";
import type { PublishingSettings } from "./settings";

const MS_PER_HOUR = 3_600_000;

/** The states a settings change reaches: §9's ten minus the resting ones, so a new state joins unless it rests. */
export const NOT_YET_PUBLISHED: readonly State[] = Object.freeze([
  "planned",
  "generating",
  "in_review",
  "approved",
  "publishing",
  "failed",
  "needs_attention",
] as const);

export function isNotYetPublished(state: State): boolean {
  return NOT_YET_PUBLISHED.includes(state);
}

export interface ReDeadlineInput {
  state: State;
  /** When the page entered review, from its own transition record, never a clock. */
  enteredReviewAt: Date;
  currentDeadline: Date;
  previous: PublishingSettings;
  next: PublishingSettings;
  changedAt: Date;
}

/** The deadline one draft holds after the change. Total: out of scope, "untouched" is the same value, never a null. */
export function newVetoDeadline(a: ReDeadlineInput): Date {
  // Rule 1 — scope.
  if (!isNotYetPublished(a.state)) return a.currentDeadline;

  const nextWindowMs = a.next.vetoHours * MS_PER_HOUR;

  // Rule 3 — a max rather than a "lengthened?" test: the same answer, and one fewer branch to disagree with rule 2.
  if (a.state === "in_review") {
    const fromReview = a.enteredReviewAt.getTime() + nextWindowMs;
    return new Date(Math.max(a.currentDeadline.getTime(), fromReview));
  }

  // Rule 2 — out of review there is no running window to lengthen, and the one in force stands.
  return a.currentDeadline;
}
