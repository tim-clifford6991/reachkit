// SPEC §7 — what a draft's life does to the opportunity it was written from
// (issue 712).
//
// "Opportunity status (2026-09-15): a written draft queues its
// opportunity; a vetoed draft dismisses it; needs_attention leaves it
// queued." Nothing moved a row out of `open`
// before this, so `nextForDay` offered the same opportunity every evening
// and §8's near-duplicate gate refused the second page against the first:
// a site left alone got one page and then none.
//
// Two writes and no third. A published page's row keeps what the weekly
// verdict already does to it (`markDone` on an acceptance test that
// passed); a page that came to rest in `needs_attention` leaves its row
// queued, so a page the customer can still restart is not offered twice.
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
