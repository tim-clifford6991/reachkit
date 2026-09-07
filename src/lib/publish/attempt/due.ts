// BUILD §9 — the retries that have come round.
//
// §9: "failed → retry ×3 → needs_attention". `retry.ts` decides *whether* a
// failed page gets another attempt and *when*; this is the read that finds
// the ones whose moment has arrived, so the hourly tick can re-enter them
// through the same seam an approval does.
//
// **The due moment is derived, not stored** — and that is the point of this
// file rather than a column. The claim already writes both facts it takes:
// `publications.claimed_at` is the moment of the attempt and `attempt_no`
// is which one it was, so the moment the next retry falls due is
// `claimed_at + PUBLISH_RETRY_BACKOFF_MIN[attempt_no - 1]` — the same
// arithmetic `decideRetry` does, off the same pin. A `retry_due_at` column
// would be a second copy of the schedule, and the two would disagree the
// day one was corrected.
//
// It also gives the sweep its idempotency for free, and on the right key.
// The first tick's claim moves the page `failed` to `publishing` in one
// atomic transition and bumps `attempt_no` and `claimed_at`; a second tick
// in the same hour finds it neither failed nor due. Nothing is deduped on
// `(draft_id, destination)` — that is the at-most-once guarantee for a
// *post*, and using it as a retry key is exactly what makes a re-sent
// `publish/execute` event a no-op instead of an attempt.
//
// **Three predicates, and each is one the policy already states:**
//
//   1. the delivery failed — `delivery_state = 'failed'`;
//   2. the page is still in `failed` — a page already moved to
//      `needs_attention` has come to rest, and one a customer has moved on
//      is not this tick's to touch. The machine would refuse the edge
//      anyway; asking here means the tick does not report an attempt it
//      never made;
//   3. the retry is permitted and has come round — `attempt_no` inside
//      `MAX_RETRIES`, and the moment above at or before `now`.
//
// The switch is **not** asked here. §9 withholds a retry while publishing
// is off rather than cancelling it, and the guard that does so is read
// inside the claim at the moment of the attempt — so a held page is offered
// to the tick, refused there, and offered again on the next one. Asking
// twice would be a second copy of a rule whose whole point is that it is
// read where the decision is made.
//
// One statement for the failed rows, one for the destinations they need. A
// per-page read here would be one round trip per failed page per hour.
import { PUBLISH_RETRY_BACKOFF_MIN } from "@/lib/config/constants";
import { publishDb } from "../db";
import type { DestinationKind } from "../types";
import { MAX_RETRIES } from "./retry";

/** One page whose retry has come round, addressed the way
 *  `publishApproved()` takes it. */
export interface DueRetry {
  readonly draftId: string;
  readonly destinationId: string;
}

const MS_PER_MINUTE = 60_000;

interface FailedRow {
  id: string;
  draft_id: string;
  destination: DestinationKind;
  attempt_no: number;
  claimed_at: string;
  drafts?: { state?: string | null; site_id?: string | null } | null;
}

interface DestinationRow {
  id: string;
  site_id: string;
  kind: DestinationKind;
}

/** The moment `decideRetry` would name for a page that has made
 *  `attemptNo` attempts, or `null` where no further retry is permitted. */
export function retryDueAt(claimedAt: Date, attemptNo: number): Date | null {
  const retriesSoFar = Math.max(0, attemptNo - 1);
  if (retriesSoFar >= MAX_RETRIES) return null;
  const minutes = PUBLISH_RETRY_BACKOFF_MIN[retriesSoFar] ?? 0;
  return new Date(claimedAt.getTime() + minutes * MS_PER_MINUTE);
}

export async function dueRetries(now: Date): Promise<readonly DueRetry[]> {
  const failed = await publishDb()
    .from<FailedRow>("publications")
    .select("id, draft_id, destination, attempt_no, claimed_at, drafts(state, site_id)")
    .eq("delivery_state", "failed");
  if (failed.error !== null) {
    throw new Error(`publish/due: could not read the failed publications: ${failed.error.message}`);
  }

  const rows = failed.data ?? [];
  const due = rows.filter((row) => {
    if (row.drafts?.state !== "failed") return false;
    const dueAt = retryDueAt(new Date(row.claimed_at), row.attempt_no);
    return dueAt !== null && dueAt.getTime() <= now.getTime();
  });
  if (due.length === 0) {
    logSweep({ failed: rows.length, due: 0 });
    return [];
  }

  // The event carries a destination *id* and a publication carries the
  // *kind* (§10 gives a site at most one destination of each kind, which is
  // why the row can). Resolving it here rather than in the tick keeps
  // `publishApproved()` one shape: whatever occasioned an attempt, it is
  // addressed the same way.
  const siteIds = [
    ...new Set(
      due.map((row) => row.drafts?.site_id).filter((id): id is string => typeof id === "string")
    ),
  ];
  const destinations = await publishDb()
    .from<DestinationRow>("destinations")
    .select("id, site_id, kind")
    .in("site_id", siteIds)
    .is("deleted_at", null);
  if (destinations.error !== null) {
    throw new Error(`publish/due: could not read the destinations: ${destinations.error.message}`);
  }

  const byPair = new Map(
    (destinations.data ?? []).map((row) => [`${row.site_id} ${row.kind}`, row.id])
  );

  const retries: DueRetry[] = [];
  for (const row of due) {
    const siteId = row.drafts?.site_id;
    if (typeof siteId !== "string") continue;
    const destinationId = byPair.get(`${siteId} ${row.destination}`);
    // A page whose destination was disconnected since it failed is not
    // offered: there is nothing to address the attempt to, and the edge
    // reports that as a hold rather than as an attempt (`deliver.ts`). It
    // returns to the tick the moment the customer reconnects.
    if (destinationId === undefined) continue;
    retries.push({ draftId: row.draft_id, destinationId });
  }

  logSweep({ failed: rows.length, due: retries.length });
  return retries;
}

/** One line per tick, carrying the counts and nothing about a customer. */
function logSweep(fields: { failed: number; due: number }): void {
  console.log(JSON.stringify({ event: "publish_retry_sweep", ...fields }));
}
