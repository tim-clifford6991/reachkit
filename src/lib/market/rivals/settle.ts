// BUILD §6.6 · §4.3 — the one write that settles the market and the set.
//
// The archived plan is WO-085's second half. Two columns on the site row,
// written once: `sites.category` and `sites.competitors`. It adds no
// column, no table and no migration — both already exist on the baseline
// schema.
//
// **The set that is written is exactly the set the founder chose.** No
// candidate is merged in from the suggestion list on the way past, no
// domain the founder did not accept or type ever joins it, and nothing
// here re-infers a market: this module resolves no import into
// `src/lib/llm/` or `src/lib/vendors/`, so there is no call it could make
// to change its mind about either decision (REQ-026 c4, c13).
//
// **`origin` is stored, never inferred.** Each rival is written as
// `{ domain, origin }`, so "a domain change clears every suggestion and
// keeps everything the founder typed" survives a reload and a later domain
// change — `clearSuggested` reads a fact rather than guessing one.
//
// **One statement, idempotent on `siteId`.** A resubmitted form cannot
// produce two rival sets: the write is an update of one row by its
// primary key, so the second call leaves exactly the state the first did.
//
// **An empty set is a legal outcome and is written as one** (REQ-026 c11):
// `[]` is stored, not skipped, so a founder who rejected every suggestion
// is settled rather than left looking un-settled.
//
// This module is the write for those two decisions only. Setup's other
// decisions, its refusals and the deep-pass enqueue are `completeSetup`'s
// (`src/app/(account)/setup/submit.ts`), which is where `SetupStore`
// declares what #42 still owes; when that store lands for real, this
// function is what its `commitSetup` calls for these two columns rather
// than a second implementation of them.
import { db } from "@/lib/db";
import type { RivalSet } from "../setup/rivals";

export type SettleOutcome = { ok: true } | { ok: false; because: "write_failed" };

/**
 * Writes the confirmed market and the confirmed rival set.
 *
 * `category` is written verbatim — unaltered and un-normalised. What the
 * founder entered is the market the product uses from then on, and
 * trimming, casing or mapping it here would be the product quietly
 * deciding it knew better (REQ-026 c2).
 *
 * A failed write is an outcome, not a throw: the caller decides what the
 * founder is told, and a screen that cannot settle must not be a stack
 * trace.
 */
export async function settleSetup(a: {
  siteId: string;
  category: string;
  rivals: RivalSet;
}): Promise<SettleOutcome> {
  const competitors = a.rivals.map((rival) => ({ domain: rival.domain, origin: rival.origin }));

  const { error } = await db()
    .from("sites")
    .update({ category: a.category, competitors })
    .eq("id", a.siteId);

  logSettle({ rivals: competitors.length, ok: error === null });
  return error === null ? { ok: true } : { ok: false, because: "write_failed" };
}

/** BP-034's submit-outcome line. Counts and the outcome only — neither the
 *  category the founder typed nor a rival domain reaches it. */
function logSettle(record: { rivals: number; ok: boolean }): void {
  console.log(JSON.stringify({ event: "setup_settled", ...record }));
}
