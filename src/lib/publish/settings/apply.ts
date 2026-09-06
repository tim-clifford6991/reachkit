// BUILD §9 · REQ-073 c4 — the four re-deadline rules, as one pure function.
//
// A saved settings change applies to every draft not yet published, and
// what it does to each one is decided here: no clock read, no database
// read, no settings read of its own. Every limb is testable at its
// boundary because the whole situation arrives as an argument.
//
// The four rules, in order:
//
//   1. **Scope.** A draft not yet published is in scope, including one
//      already in review. A `published`, `skipped` or `unpublished` draft is
//      untouched — a page that has gone out, been stopped or been taken down
//      is not re-deadlined by a setting.
//   2. **Never shortened.** A window already running is never cut by a
//      change: the result is never earlier than the deadline in force.
//      A customer who narrows their window must not thereby lose the
//      interval they already had on a page in front of them.
//   3. **Lengthened keeps the later.** A draft in review whose window is
//      lengthened keeps `max(currentDeadline, enteredReviewAt + next)`.
//   4. **The Copilot restart.** A draft in review whose window already
//      expired **under Copilot** starts its window again at the moment of
//      the change — so a switch to Autopilot never makes a held draft
//      publishable without the interval the settings state.
//
// Rule 4 is scoped to `in_review` on purpose: a draft already in `approved`
// reached that state through an explicit approval, and a settings change
// does not revoke an approval.
//
// The archived plan is WO-220.
import type { State } from "../types";
import type { PublishingSettings } from "./settings";

const MS_PER_HOUR = 3_600_000;

/** The states a settings change reaches. Derived from §9's ten by
 *  subtraction, so a new state joins the in-scope set unless it is one a
 *  page has come to rest in. */
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
  /** When the page entered review. Read from the draft's own transition
   *  record, never from a clock at the moment of the change. */
  enteredReviewAt: Date;
  currentDeadline: Date;
  previous: PublishingSettings;
  next: PublishingSettings;
  changedAt: Date;
}

/**
 * REQ-073 criterion 4, as one pure function over one draft.
 *
 * Returns the deadline the draft holds after the change. For a draft out of
 * scope (rule 1) that is the deadline it already had — the function is
 * total, and "untouched" is expressed as "the same value", never as a null
 * a caller has to remember to skip.
 */
export function newVetoDeadline(a: ReDeadlineInput): Date {
  // Rule 1 — scope.
  if (!isNotYetPublished(a.state)) return a.currentDeadline;

  const nextWindowMs = a.next.vetoHours * MS_PER_HOUR;

  // Rule 4 — the Copilot restart. A draft held in review under Copilot past
  // its own deadline has no interval left; the change gives it one, counted
  // from the moment of the change. Checked before rule 3 because a draft
  // whose window has already expired is not a window "being lengthened".
  if (
    a.state === "in_review" &&
    a.previous.mode === "copilot" &&
    a.currentDeadline.getTime() <= a.changedAt.getTime()
  ) {
    return new Date(a.changedAt.getTime() + nextWindowMs);
  }

  // Rule 3 — a draft in review whose window is lengthened keeps the later
  // of the two expiry moments. Written as a max rather than as a
  // "lengthened?" test, which is the same answer and one fewer branch to
  // disagree with rule 2.
  if (a.state === "in_review") {
    const fromReview = a.enteredReviewAt.getTime() + nextWindowMs;
    return new Date(Math.max(a.currentDeadline.getTime(), fromReview));
  }

  // Rule 2 — for every other in-scope state the window in force stands. A
  // page not in review has no running window to lengthen, and shortening
  // one is what rule 2 forbids outright.
  return a.currentDeadline;
}
