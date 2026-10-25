// BUILD §9 — REQ-057 criterion 2's conjuncts, in exactly one place: publishable when the veto window has expired or it
// was explicitly approved, no edit is unsaved and no claim re-check is outstanding (REQ-053 c5); it publishes at the first
// publish time at or after that, never before.
// No clock: the deadline is the moment it becomes publishable, and whether it has arrived is `publishable_and_due`'s
// question, one clock per pass. No settings read: the governing pair arrives on the `DraftView`.
import type { DraftView } from "../types";
import { nextPublishTimeAtOrAfter } from "../settings/clock";
import { settingsOf } from "../settings/pair";

/** The three conjuncts, closed; a fourth would be a change to criterion 2.
 *  - `window` — no veto window running, so nothing has yet expired.
 *  - `unsaved_edit` — criterion 2's third conjunct.
 *  - `claim_recheck` — criterion 2's fourth (REQ-053 c5's state). */
export type NotPublishable = "window" | "unsaved_edit" | "claim_recheck";

/** Not a conjunct: the first publish time has no zone to be read in. `sites.timezone` is nullable by design (REQ-073 c1
 *  forbids a zone the customer never stated), so the page is held, never published in a zone nobody chose. */
export type Unresolvable = "zone_not_set";

export type PublishableAnswer =
  | { publishable: true; at: Date }
  | { publishable: false; because: NotPublishable | Unresolvable };

/** The one expression of criterion 2; `at` comes from `nextPublishTimeAtOrAfter`, never a second clock.
 *  The `unsaved_edit` arm is kept though no caller reaches it today: removing it would silently weaken the predicate. */
export function becomesPublishable(d: DraftView): PublishableAnswer {
  // Criterion 2's own order: the disjunct first, then the two negatives.
  const became = becameAt(d);
  if (typeof became === "string") return { publishable: false, because: became };

  if (d.hasUnsavedEdit) return { publishable: false, because: "unsaved_edit" };
  if (d.claimRecheckOutstanding) return { publishable: false, because: "claim_recheck" };

  if (d.governing.timezone === null) return { publishable: false, because: "zone_not_set" };

  return { publishable: true, at: nextPublishTimeAtOrAfter(became, settingsOf(d.governing)) };
}

/** The moment the window expired or the page was approved, or why not. The approval is the system's own
 *  (`closeExpiredWindows`); no customer approves a page. */
function becameAt(d: DraftView): Date | NotPublishable {
  if (d.approvedAt !== null) return d.approvedAt;
  // At a zero window the deadline is the moment of entering review, so it is publishable at once (criterion 7).
  if (d.vetoDeadline === null) return "window";
  return d.vetoDeadline;
}
