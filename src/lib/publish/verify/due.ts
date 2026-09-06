// BUILD §9 — when a published page's one check is due, and the two ways it
// never will be.
//
// The dispositions are decided from the publication row and never from the
// destination kind. **`no_live_address` is decided from `live_url is null`**
// — and that is the seam that held. The rule was written against the
// address because that was the stated reason; the destination kind was only
// that day's instance of it. When the owner ruled on 2026-09-01 that every
// destination publishes live (ADR-084), WordPress rows gained an address
// and joined the verified population with no edit here and no second
// destination rule anywhere. `if (kind === 'wordpress')` would now silently
// exclude every WordPress page from the check REQ-062 criterion 1 promises
// it.
//
// **A recorded outcome is never due again, and `could_not_confirm` is a
// recorded outcome — ADR-085 (landmine).** A transport failure at 24 hours
// *is* a flake, and retrying flakes is what good code does; it is forbidden
// here because there is no second look. REQ-062's non-goal says it in
// terms: the check "is not retried, rescheduled or repeated; 'not
// confirmed' is a final outcome for that page, not a pending one". A retry
// that succeeded an hour later would record a different day's fact under
// the check's own date. `dueNow` selects on `verify is null` and on nothing
// else, which makes that true by construction rather than by a rule
// somebody has to keep. There is no backoff here, no reschedule, and no
// second selection predicate.
//
// The archived plan is WO-232.
import { publishDb } from "../db";
import type { VerifyDisposition } from "../types";
import { readStoredCheck } from "./stored";

/** Declared in `src/lib/publish/types.ts` — the leaf that imports nothing
 *  from this subsystem — and re-exported here, so every caller's spelling
 *  is this module's. The page record must name the recorded outcome for
 *  REQ-062 criterion 7, and declaring the union under `verify/` would make
 *  `record/ → verify/ → types.ts` a node-level cycle (ADR-092). */
export type { VerifyDisposition, VerifyOutcome } from "../types";

interface DispositionRow {
  id: string;
  live_url: string | null;
  published_at: string | null;
  unpublished_at: string | null;
  verify_due_at: string | null;
  verify: unknown;
}

const COLUMNS = "id, live_url, published_at, unpublished_at, verify_due_at, verify";

function asDate(value: string | null): Date | null {
  if (value === null) return null;
  const at = new Date(value);
  return Number.isNaN(at.getTime()) ? null : at;
}

export class PublicationNotFound extends Error {
  constructor(readonly publicationId: string) {
    super(`publications row ${publicationId} does not exist; no check can be disposed of for it.`);
    this.name = "PublicationNotFound";
  }
}

async function readRow(publicationId: string): Promise<DispositionRow> {
  const { data, error } = await publishDb()
    .from<DispositionRow>("publications")
    .select(COLUMNS)
    .eq("id", publicationId)
    .limit(1);
  if (error !== null) {
    throw new Error(`dispositionFor(${publicationId}): ${error.message}`);
  }
  const row = data?.[0];
  if (row === undefined) throw new PublicationNotFound(publicationId);
  return row;
}

/**
 * The disposition of one publication's 24-hour check.
 *
 * Precedence, and each step is load-bearing:
 *
 *   1. **a recorded outcome wins.** Whichever of the three arms it was, the
 *      check has run and this is `done` carrying the whole `VerifyOutcome`,
 *      `checkedAt` included — never a projection of it, which is what lets
 *      the page record hand a surface the state and the outcome as one
 *      value (ADR-085 Decision 5).
 *   2. **no address, no check.** A delivery that never reached an address
 *      has nothing to fetch. Since ADR-084 this arm is reached only by a
 *      delivery that never completed.
 *   3. **taken down before it was due.** The page's own record already says
 *      the check would find nothing, so no fetch is made — and the row is
 *      **not deleted**: deleting it re-arms the duplicate post ADR-080's
 *      guarantee exists to refuse.
 *   4. otherwise the due moment decides, and `not_yet` carries it, so a
 *      surface can state *when* the check will run in the 24 hours before
 *      it does (REQ-062 criterion 3).
 */
export async function dispositionFor(
  publicationId: string,
  now: Date = new Date()
): Promise<VerifyDisposition> {
  return dispositionOf(await readRow(publicationId), now);
}

/** The rule itself, over a row already read. `verify.ts` and the page
 *  record both hold the row in hand and would otherwise read it twice. */
export function dispositionOf(row: DispositionRow, now: Date): VerifyDisposition {
  const recorded = readStoredCheck(row.verify);
  if (recorded !== null) return { kind: "done", result: recorded.result };

  if (row.live_url === null) return { kind: "never", because: "no_live_address" };

  const dueAt = asDate(row.verify_due_at);
  const unpublishedAt = asDate(row.unpublished_at);
  if (unpublishedAt !== null && (dueAt === null || unpublishedAt.getTime() < dueAt.getTime())) {
    return { kind: "never", because: "taken_down_first" };
  }

  // An address with no due moment is a delivery that has not been recorded
  // as delivered; nothing is owed until the column that carries the moment
  // is written.
  if (dueAt === null) return { kind: "never", because: "no_live_address" };

  return now.getTime() < dueAt.getTime() ? { kind: "not_yet", dueAt } : { kind: "due" };
}

export type { DispositionRow };

/** The columns `dispositionOf` reads, so a caller that already holds the
 *  row selects the same set. */
export const DISPOSITION_COLUMNS = COLUMNS;

/**
 * The publications whose check has fallen due, oldest first.
 *
 * One indexed read over `idx_publications_verify_due` — the partial index
 * `(verify_due_at) where verify is null`. **The predicate is `verify is
 * null` and the due moment, and nothing else.** No backoff column, no
 * attempt counter, no "retry after" — a row with a recorded outcome is
 * absent here for ever, whichever of the three outcomes it recorded, and a
 * run that crashed before recording one leaves its row due, which is what
 * makes the job idempotent without remembering anything.
 */
export async function dueNow(limit: number, now: Date = new Date()): Promise<string[]> {
  const { data, error } = await publishDb()
    .from<{ id: string }>("publications")
    .select("id")
    .is("verify", null)
    .lte("verify_due_at", now.toISOString())
    .order("verify_due_at", { ascending: true })
    .limit(limit);
  if (error !== null) throw new Error(`dueNow: ${error.message}`);
  return (data ?? []).map((row) => row.id);
}
