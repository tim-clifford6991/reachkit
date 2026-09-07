// BUILD §4.7, §8 — the one writer of `sites.do_not_claim`, and the sweep
// that runs beside it.
//
// §4.7 gives the customer a do-not-claim list and §8 makes it a hard output
// filter. REQ-053 c5's timeliness half is what this module carries: when
// the list changes, the pages already written have to be re-checked against
// it, and they have to be re-checked *soon* rather than at whatever moment
// each next happens to be touched.
//
// **The hold does not depend on this call, and that distinction matters.**
// A page is outstanding when the hash of the list it was checked against is
// not the hash of the list as it stands — a derived fact, so every page is
// held from the instant the list changes, whether or not anything sweeps.
// `sweepOutstandingRechecks` clears the hold sooner; it is not what creates
// it. That is why a sweep that fails leaves the customer's pages held
// rather than published unchecked, and why this function reports what the
// sweep found instead of failing the save.
//
// **The write and the sweep are one call site, on purpose.** Until this
// module existed, `tests/publish/machine/claim-recheck.test.ts` held the
// obligation open with a no-writer assertion — "no file under `src/` writes
// the list, so there is no write that could skip the sweep" — and that
// assertion is what would have failed the day a writer appeared somewhere
// else. It is now the assertion that this is the only one.
//
// The archived plan is WO-089's sibling; the decision is DECISIONS
// 2026-09-07 (#178).
import { dbAdmin } from "@/lib/db";
import { withDraftCost } from "../cost";
import { sweepOutstandingRechecks, type SweepOutcome } from "./sweep";

interface MinimalResult {
  data: unknown;
  error: { message: string } | null;
}

interface MinimalQuery extends PromiseLike<MinimalResult> {
  update(values: Record<string, unknown>): MinimalQuery;
  eq(column: string, value: string): MinimalQuery;
}

interface MinimalClient {
  from(table: string): MinimalQuery;
}

/** The list, as it is stored: entries trimmed, blanks dropped, order the
 *  customer's own, duplicates removed. Normalising on the way in is what
 *  makes the hash stable — two lists that filter identically must not read
 *  as two different lists and re-check every page for nothing. */
export function normaliseClaimList(entries: readonly string[]): string[] {
  const out: string[] = [];
  for (const entry of entries) {
    const trimmed = entry.trim();
    if (trimmed === "" || out.includes(trimmed)) continue;
    out.push(trimmed);
  }
  return out;
}

export interface SaveClaimListResult {
  /** The list as stored. */
  doNotClaim: readonly string[];
  /** What the sweep found, or `null` where it could not run — a sweep that
   *  failed leaves every affected page held, which is the safe direction
   *  and the state the guard already produces on its own. */
  swept: SweepOutcome | null;
}

/**
 * Writes the customer's do-not-claim list and re-checks what it affects.
 *
 * The write lands first: the guard reads the stored list, so a page must
 * never be judged against a list the customer has not saved. The sweep then
 * spends through `withDraftCost` — the one place this engine's cap context
 * is opened, so a re-check costs what a generation step costs and is
 * ledgered the same way, rather than opening a second context with its own
 * idea of the ceiling.
 */
export async function saveDoNotClaim(a: {
  siteId: string;
  entries: readonly string[];
  /** The scan every ledger row this sweep writes is keyed to
   *  (`fetches.scan_id` is `not null`). The caller supplies it because the
   *  caller is the one that knows which scan grounds this site's pages. */
  scanId: string;
}): Promise<SaveClaimListResult> {
  const doNotClaim = normaliseClaimList(a.entries);

  const client = dbAdmin() as unknown as MinimalClient;
  const { error } = await client
    .from("sites")
    .update({ do_not_claim: doNotClaim })
    .eq("id", a.siteId);
  if (error !== null) {
    throw new Error(`saveDoNotClaim: could not save the list: ${error.message}`);
  }

  try {
    const swept = await withDraftCost({ scanId: a.scanId }, (cost) =>
      sweepOutstandingRechecks(cost, a.siteId)
    );
    return { doNotClaim, swept };
  } catch {
    // The list is saved and every affected page is already held by the
    // guard. A sweep that could not run is a delay in clearing that hold,
    // never a reason to tell the customer their list did not save.
    return { doNotClaim, swept: null };
  }
}
