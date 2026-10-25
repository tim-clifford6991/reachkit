// BUILD §9 — the retries that have come round, which the hourly tick re-enters through the seam an approval uses.
// The due moment is derived, `claimed_at + PUBLISH_RETRY_BACKOFF_MIN[attempt_no - 1]` as `decideRetry` does, never a
// `retry_due_at` column that would be a second copy of the schedule. The claim bumps both, so a second tick finds nothing due;
// `(draft_id, destination)` is a post's at-most-once key, never a retry key.
// Due: `delivery_state = 'failed'`, the page still in `failed`, and `attempt_no` inside `MAX_RETRIES` with the moment passed.
// The switch is not asked here: the claim's guard reads it at the attempt, so a held page is offered again next tick.
// One statement for the failed rows and one for their destinations, never one per page.
import { PUBLISH_RETRY_BACKOFF_MIN } from "@/lib/config/constants";
import { publishDb } from "../db";
import type { DestinationKind } from "../types";
import { MAX_RETRIES } from "./retry";

/** One page whose retry has come round, addressed as `publishApproved()` takes it. */
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

/** The moment `decideRetry` would name after `attemptNo` attempts, or `null` where no retry is left. */
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

  // A publication carries the kind (§10: one destination per kind) and the event an id, resolved here so every attempt
  // is addressed alike.
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
    // Disconnected since: nothing to address, so it waits, and returns once the customer reconnects.
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
