// src/lib/account/billing/hosted-serving.ts — BUILD §13, §9
//
// The one question the hosted edge asks before serving a page, and the two
// reasons the answer can be no.
//
// REQ-076 criterion 10: 30 days after a departed customer's paid-through
// date "ReachKit stops serving their hosted pages and every address that
// served one returns 410 Gone rather than a page, a redirect or a
// not-found" — and, separately, a customer who deletes their account has
// serving stop "at the moment of deletion", with that window never
// beginning at all (REQ-079 c6).
//
// **Two reasons, one code.** BP-060 decision 1: the caller answers 410 for
// both. 404 for a deletion would be dishonest — the page existed and is
// gone — and it de-indexes slower, which is the opposite of what a
// departing customer wants. The reason is returned so the caller can log
// which ending it was, never so it can answer differently.
//
// **Computed from timestamps; no job flips a boolean.** `stopHosting` in
// the maintenance tick is a notifier and a stamper, not a switch. That is
// what makes the stop idempotent: a tick that runs twice, late, or not at
// all still yields the right answer here, because the answer is a
// comparison and not a stored state.
//
// **A failed read is neither answer.** It is `unreadable`: nothing is
// served, because an erasure request may be behind the row, and nothing is
// declared gone, because a 410 on a short outage would de-index a paying
// customer's live pages. The edge answers it 503, which crawlers retry.
import { billingStore } from "./store";

export type HostedServingState =
  | { serve: true }
  | { serve: false; because: "retention_elapsed" | "account_deleted" | "unreadable" };

/** REQ-076 criterion 10 — what the hosted edge asks before serving a hosted
 *  address. Server-only, on the request path: p95 ≤ 10 ms, cacheable for
 *  60 s. */
export async function hostedServingState(siteId: string): Promise<HostedServingState> {
  const read = await billingStore().hosting(siteId);

  // Whether this account was erased is unknown, so it is neither served nor gone.
  if (!read.ok) return { serve: false, because: "unreadable" };

  // A site that does not exist is not a site whose retention elapsed.
  if (read.site === null) return { serve: false, because: "account_deleted" };

  // Deletion outranks retention, and needs no window: the two endings are
  // asked in this order because a deleted account may also have an elapsed
  // window, and the reason an operator needs is the one the customer chose.
  if (read.site.owner_deleted_at !== null) return { serve: false, because: "account_deleted" };

  const endsAt = read.site.hosted_serving_ends_at;
  if (endsAt === null) return { serve: true };

  // The boundary is inclusive: on the day serving stops, it has stopped.
  return new Date(endsAt).getTime() <= Date.now()
    ? { serve: false, because: "retention_elapsed" }
    : { serve: true };
}
