// BUILD §8 hard rule 4 — the outstanding-recheck guard.
//
// The customer changes their do-not-claim list. Every page of theirs not
// yet handed to a destination has to be re-checked against the new list,
// whatever stage it sits in, and none of them may go to its destination
// until one passes.
//
// **Outstanding-ness is derived, never stored.** It is the comparison of
// two hashes: the one the draft's last verdict was reached against, and the
// one the site's list hashes to right now. There is no `outstanding`
// column, no `recheck_due` flag, no queue table and no version on `sites` —
// so there is nothing to be missed by a job that failed, nothing to be
// stale, and nothing a write can forget to bump. A draft is held from the
// instant the customer saves a change, before any job runs.
//
// One row read and a hash of a `jsonb` array: no model call, no vendor
// call. It sits on the publish path, so it is budgeted as a single-digit
// millisecond call.
//
// **This module cannot compel its own call.** The promise that no approval,
// schedule or retry puts a page carrying a forbidden claim on the
// customer's site is enforced at the publishing engine's one hand-off gate,
// which calls `claimRecheckOutstanding` before every transition into
// `publishing`. Removing that call passes every test in this directory.
import { generateStore } from "../store";
import { readRecordedVerdict } from "../record";
import { listHash } from "./hash";

/** True while this draft has no passing check, or its last passing check
 *  was reached against a different list than the site holds now. A draft
 *  the store does not hold is outstanding: a page we cannot read is not a
 *  page we may release. */
export async function claimRecheckOutstanding(draftId: string): Promise<boolean> {
  const store = generateStore();
  const draft = await store.draftById(draftId);
  if (draft === null) return true;
  const verdict = readRecordedVerdict(draft.claim_check);
  if (verdict === null || verdict.state !== "passed") return true;
  const site = await store.siteFacts(draft.site_id);
  if (site === null) return true;
  return verdict.listHash !== listHash(site.doNotClaim);
}

/** What the customer is told when a check failed: the entry it matched,
 *  which is a string they wrote. Never model output, and `null` for every
 *  other verdict — a passing check has nothing to name and an unrun one
 *  matched nothing. */
export async function outstandingMatch(draftId: string): Promise<{ matchedEntry: string } | null> {
  const draft = await generateStore().draftById(draftId);
  if (draft === null) return null;
  const verdict = readRecordedVerdict(draft.claim_check);
  return verdict !== null && verdict.state === "failed" ? { matchedEntry: verdict.matchedEntry } : null;
}
