// BUILD §9 — when a published page's one check is due, and the two ways it never will be.
// Decided from the publication row, never the destination kind: `no_live_address` is `live_url is null`, so an
// `if (kind === 'wordpress')` would silently drop every WordPress page from REQ-062 c1's check.
// A recorded outcome is never due again, `could_not_confirm` included (ADR-085): the check "is not retried, rescheduled
// or repeated; 'not confirmed' is a final outcome". `dueNow` selects on `verify is null` alone, with no backoff.
import { publishDb } from "../db";
import type { VerifyDisposition } from "../types";
import { readStoredCheck } from "./stored";

/** Declared in the `types.ts` leaf, since the page record names it (REQ-062 c7) and declaring it here would close
 *  `record/ → verify/ → types.ts` into a cycle (ADR-092). */
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

/** The disposition of one publication's 24-hour check, in precedence order:
 *   1. a recorded outcome wins: `done` with the whole `VerifyOutcome`, never a projection (ADR-085 decision 5);
 *   2. no address, no check;
 *   3. taken down before it was due: no fetch, and the row is never deleted, which would re-arm ADR-080's duplicate post;
 *   4. otherwise the due moment, carried by `not_yet` so a surface can say when (REQ-062 c3). */
export async function dispositionFor(
  publicationId: string,
  now: Date = new Date()
): Promise<VerifyDisposition> {
  return dispositionOf(await readRow(publicationId), now);
}

/** The rule over a row already in hand, as `verify.ts` and the page record hold it. */
export function dispositionOf(row: DispositionRow, now: Date): VerifyDisposition {
  const recorded = readStoredCheck(row.verify);
  if (recorded !== null) return { kind: "done", result: recorded.result };

  if (row.live_url === null) return { kind: "never", because: "no_live_address" };

  const dueAt = asDate(row.verify_due_at);
  const unpublishedAt = asDate(row.unpublished_at);
  if (unpublishedAt !== null && (dueAt === null || unpublishedAt.getTime() < dueAt.getTime())) {
    return { kind: "never", because: "taken_down_first" };
  }

  // No due moment: not yet recorded as delivered, so nothing is owed.
  if (dueAt === null) return { kind: "never", because: "no_live_address" };

  return now.getTime() < dueAt.getTime() ? { kind: "not_yet", dueAt } : { kind: "due" };
}

export type { DispositionRow };

/** The columns `dispositionOf` reads, for a caller selecting the row itself. */
export const DISPOSITION_COLUMNS = COLUMNS;

/** Publications whose check is due, oldest first, over the partial index `idx_publications_verify_due`. Only `verify is
 *  null` and the due moment: a recorded row is gone for ever, and a crashed run leaves its row due, so the job is idempotent. */
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
