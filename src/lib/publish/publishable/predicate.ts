// BUILD §9 — REQ-057 criterion 2's conjuncts, in exactly one place.
//
// Criterion 2, verbatim: "Given a page in review, when it publishes, then
// it publishes under this rule and no other: a page becomes publishable
// when its veto window has expired or it was explicitly approved, and no
// edit is unsaved and no claim re-check is outstanding (REQ-053 criterion
// 5, which fixes when one stands outstanding on a draft and how it clears);
// it publishes at the first publish time at or after it becomes
// publishable, and never before."
//
// **This function reads no clock.** "Its veto window has expired" is not
// evaluated against `now` here: the deadline *is* the moment the page
// becomes publishable, and the first publish time at or after that moment
// is what the function returns. Whether that moment has arrived is the
// `publishable_and_due` guard's question, asked with the clock the whole
// pass was fixed against — one clock per pass, never two.
//
// It reads no settings either. The governing pair arrives on the
// `DraftView`, so two evaluations of one draft under two pairs give two
// answers and nothing here queries for either.
//
// The archived plan is WO-215.
import type { DraftView } from "../types";
import { nextPublishTimeAtOrAfter } from "../settings/clock";
import { settingsOf } from "../settings/pair";

/** The four conjuncts, closed. A fifth would be a change to criterion 2.
 *
 *  - `window` — autopilot with no veto window running, so nothing has yet
 *    expired.
 *  - `unapproved` — copilot without an explicit approval. Under copilot,
 *    expiry is not an approval (criterion 3).
 *  - `unsaved_edit` — criterion 2's third conjunct.
 *  - `claim_recheck` — criterion 2's fourth (REQ-053 c5's state). */
export type NotPublishable = "window" | "unapproved" | "unsaved_edit" | "claim_recheck";

/** Not a fifth conjunct: the absence of the one input criterion 2's final
 *  clause needs. "It publishes at the first publish time" cannot be
 *  answered for a site whose publish hour has no zone to be read in, and
 *  `sites.timezone` is nullable by design (REQ-073 c1 forbids a zone the
 *  customer never stated). The page is held, exactly as the ceilings hold
 *  it for the same reason — never published in a zone nobody chose. */
export type Unresolvable = "zone_not_set";

export type PublishableAnswer =
  | { publishable: true; at: Date }
  | { publishable: false; because: NotPublishable | Unresolvable };

/**
 * The one expression of criterion 2 in the codebase.
 *
 * `at` is the first publish time at or after the moment the page became
 * publishable — obtained from `nextPublishTimeAtOrAfter`, never from a
 * second clock and never computed here.
 *
 * **The `unsaved_edit` arm is kept deliberately.** It is criterion 2's
 * third conjunct, and no current caller can reach it — the draft view is
 * loaded after the editor has saved. Removing it because nothing reaches it
 * would make the predicate silently weaker the first time an unsaved-edit
 * path appears; it is a guard, not a behaviour. One test pins it.
 */
export function becomesPublishable(d: DraftView): PublishableAnswer {
  // Criterion 2's own order: the disjunct first, then the two negatives.
  const became = becameAt(d);
  if (typeof became === "string") return { publishable: false, because: became };

  if (d.hasUnsavedEdit) return { publishable: false, because: "unsaved_edit" };
  if (d.claimRecheckOutstanding) return { publishable: false, because: "claim_recheck" };

  if (d.governing.timezone === null) return { publishable: false, because: "zone_not_set" };

  return { publishable: true, at: nextPublishTimeAtOrAfter(became, settingsOf(d.governing)) };
}

/**
 * "Its veto window has expired **or** it was explicitly approved" — the
 * moment the page became publishable, or the reason it has not.
 *
 * The approval is checked first because it is unconditional: an approved
 * page is publishable under either mode, and under copilot it is the only
 * way. Under copilot the first disjunct is unconditionally false, so an
 * expired window answers `unapproved` and never `publishable` — criterion
 * 3, written as the absence of a branch rather than as a branch that
 * happens to be right.
 */
function becameAt(d: DraftView): Date | NotPublishable {
  if (d.approvedAt !== null) return d.approvedAt;
  if (d.governing.mode === "copilot") return "unapproved";
  // Autopilot: the deadline is the moment the window expires, and at a
  // window of zero the deadline is the moment the draft entered review, so
  // the page is publishable at once (criterion 7).
  if (d.vetoDeadline === null) return "window";
  return d.vetoDeadline;
}
