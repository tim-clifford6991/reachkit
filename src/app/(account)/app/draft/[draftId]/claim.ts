// BUILD §4.6 — the claim-check badge, and the one rule that drops it.
//
// §4.6: "an edited draft … drops the claim-check badge until the check
// re-runs (one nano call) on save." REQ-045 criterion 3 asks the outcome to
// be stated **in every case**, including the case where the customer has
// recorded no do-not-claim entries at all — which states that there was
// nothing to check against, and is never a silent pass.
//
// Four states, four words, four tones, by one total table each. `Record<…>`
// over the union is what makes a fifth state a compile error here rather
// than a badge that renders with no word.
//
// `outstanding` is the state a save leaves behind (criterion 9). It carries
// a word — the customer is owed the knowledge that a check is running — and
// it carries no **outcome**, which is the thing criterion 9 withholds until
// a check has completed against the text as saved.
import type { CopyKey } from "@/lib/presentation/copy";
import type { Tone } from "@/ui/types";
import type { ClaimState } from "./model";

export const CLAIM_STATES = ["passed", "failed", "outstanding", "nothing_to_check"] as const;
export type ClaimStateName = (typeof CLAIM_STATES)[number];

export const CLAIM_COPY_KEY: Readonly<Record<ClaimStateName, CopyKey>> = Object.freeze({
  passed: "draft.claim.passed",
  failed: "draft.claim.failed",
  outstanding: "draft.claim.outstanding",
  nothing_to_check: "draft.claim.nothing-to-check",
});

/** §2.5: red "appears only for *the customer's problem being shown to
 *  them*" — a failed check is exactly that, and it is the only state here
 *  that earns it. A check that has not finished is not a problem, and an
 *  empty do-not-claim list is not one either. Every tone still arrives with
 *  its word beside it (`Badge` requires a text child), so the badge is
 *  never colour-alone. */
export const CLAIM_TONE: Readonly<Record<ClaimStateName, Tone>> = Object.freeze({
  passed: "ok",
  failed: "bad",
  outstanding: "neutral",
  nothing_to_check: "neutral",
});

/** Criterion 9's rule, as a function rather than as a comment: a save
 *  clears whatever the last check said. The claim state after a save is
 *  `outstanding` whatever it was before — there is no arm that carries a
 *  previous outcome forward, which is what "drops the badge until the check
 *  re-runs" means when it is code. */
export function claimAfterSave(): ClaimState {
  return { state: "outstanding" };
}
