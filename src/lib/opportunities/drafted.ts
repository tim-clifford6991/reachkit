// SPEC §7 — what a draft's life does to the opportunity it was written from
// (issue 712).
//
// "Opportunity status (2026-09-15): a written draft queues its
// opportunity; a vetoed draft dismisses it." Nothing moved a row out of
// `open` before this, so `nextForDay` offered the same opportunity every
// evening and §8's near-duplicate gate refused the second page against the
// first: a site left alone got one page and then none.
//
// A published page's row keeps what the weekly verdict already does to it
// (`markDone` on an acceptance test that passed). A draft the rules stopped
// for the last time releases its row back to `open` (2026-09-16, #788):
// left `queued`, the opportunity was held by a page nothing would finish.
import { opportunityStore } from "./store";

/** A draft now exists for this opportunity: it leaves the open set. */
export async function queueForDraft(opportunityId: string): Promise<void> {
  await opportunityStore().markQueued(opportunityId);
}

/** The customer stopped the draft written from this opportunity: it is not
 *  offered again the next evening, and nothing is spent on it twice. */
export async function dismissForVeto(opportunityId: string): Promise<void> {
  await opportunityStore().markDismissed(opportunityId);
}

/** A draft written from this opportunity came to rest in `needs_attention`
 *  (#788): the row goes back to the open set. Only `queued` moves. */
export async function releaseForDraft(opportunityId: string): Promise<void> {
  await opportunityStore().markOpen(opportunityId);
}
