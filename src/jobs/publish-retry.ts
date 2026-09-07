// src/jobs/publish-retry.ts — BUILD §11, §9
//
// §9: "failed → retry ×3 → needs_attention". #199 built the edge that
// decides a retry and the moment it falls due; nothing claimed it when it
// did, so a page that failed once never tried again unless a person acted.
// This is the tick that claims it.
//
// **It is a clock job, for the reasons `src/jobs/lead-nurture.ts` states,
// verbatim in shape.** A
// retry cannot be a chained event: `publish/execute`'s idempotency key is
// `(draftId, destinationId)`, so re-sending its event for the same page is
// deduped rather than delayed — the second delivery is a no-op, which is
// precisely what the at-most-once guarantee for a *post* is for. A delay
// per event is not available either: `JobTrigger`'s `afterHours` is per
// *job*, read once at `defineJob`. And a declined event is never
// re-delivered, where **a lost tick cannot lose a retry**: the next one
// re-reads the same row and it is still due.
//
// **This file holds no retry logic and no clock arithmetic.** Which pages
// have come round is `src/lib/publish/attempt/due.ts`'s, off the same
// `PUBLISH_RETRY_BACKOFF_MIN` pin `decideRetry` reads, and what happens to
// each one is `publishApproved()`'s — the same seam an approval comes
// through, so a retry is not a second kind of attempt. The last permitted
// retry moves the page to `needs_attention` through the machine's own edge
// inside that seam; there is no arm here for it, and no sixth outcome.
//
// **Idempotency is the row, not the payload.** A clock tick carries no
// `data`, so `idempotencyKey` is empty, exactly as `types.ts` describes for
// a tick: "whose idempotency is a database constraint owned by the engine,
// not by the trigger". Two ticks in one hour claim nothing twice — the
// first one's claim moves the page out of `failed` in one atomic transition
// and bumps `attempt_no` and `claimed_at`, so the second finds it neither
// failed nor due. The dedupe is on the retry's own due moment and never on
// `(draftId, destinationId)`, which would refuse the retry rather than
// schedule it.
//
// **In the kill switch's scope**: §11 stops "scan + generate + publish",
// and this publishes. `runJob()` stops it before the first write.
import { duePublishRetries, publishApproved } from "@/jobs/engine";
import { fanOut, settle } from "./fan-out";
import type { JobDefinition, Outcome } from "./types";

/** Hourly, on the hour — the same tick `draft/generate`, `weekly/refresh`
 *  and `lead/nurture` run on, and for the same reason: due-ness is decided
 *  per row inside the run, against the moment the row itself names, rather
 *  than by the schedule. An hour is coarser than the first backoff step
 *  (`PUBLISH_RETRY_BACKOFF_MIN[0]`, 5 minutes), so a retry waits at most
 *  one tick past its moment — which §9 permits: the schedule bounds how
 *  *soon* a retry may be made, never how late it may be. */
export const PUBLISH_RETRY_TICK_CRON = "0 * * * *";

export const publishRetry: JobDefinition = {
  id: "publish/retry",
  trigger: { kind: "cron", cron: PUBLISH_RETRY_TICK_CRON },
  idempotencyKey: [],
  async run(input): Promise<Outcome> {
    const due = await duePublishRetries(input.now);
    // An hour with nothing due is the ordinary case and is recorded as
    // such — never as a run, which would make the observability line say
    // work happened on every hour of every day.
    if (due.length === 0) return { outcome: "skipped", subjectId: null, reason: "not-due" };

    const results = await fanOut(due, (page) => publishApproved(page));
    return settle(results, null);
  },
};
