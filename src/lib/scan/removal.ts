// BUILD §4.1 — the one read of the removal table
//
// A report is taken down only by a written request received at the address
// REQ-002 c1 names, and one row records each. Three callers need to know
// the same fact — admission's first step, the correction offer, and the
// status a removed address serves (#104) — and this is the one place the
// table is read, so they cannot disagree about which domains are removed.
//
// **It lives apart from `admission.ts` for a reason the bundler decides.**
// The removal rewrite runs in `src/middleware.ts`, which Next builds for
// the Edge runtime under the `middleware` file convention. `admission.ts`
// imports `node:crypto` for `networkKeyOf`'s HMAC, which Edge does not
// have; importing this fact *through* that module would drag the whole
// admission order — and `node:crypto` with it — into the Edge bundle. This
// file imports the database client and nothing else.
//
// It reads and never writes. Throws on a read that could not be answered;
// each caller decides what an unanswerable read means for it (admission's
// order fails open, and so does the rewrite).
// ── The record for this file ─────────────────────────────────────────────
// Rulings of record for this module, moved out of `DECISIONS.md` on 2026-09-11
// (owner ruling: the record holds product rulings only; an implementation ruling
// belongs where the code is). Verbatim. The whole original record is
// `docs/archive/DECISIONS-full-2026-09-11.md`.
//
// DECISIONS 2026-09-05: Report removal (REQ-002): `domain_blocks` has no writer in the product
//   (owner inserts by hand); the blocked arm is a 410 with one written line naming the address
//   that restores it; `REPORT_REMOVED_STATUS = 410` pinned; the route wires
//   `removedResponse()` in #25. — #28

import { dbAdmin } from "@/lib/db";

interface DomainBlockRow {
  domain: string;
}

interface QueryResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}

interface MinimalQueryBuilder<T> extends PromiseLike<QueryResult<T>> {
  select(columns: string): MinimalQueryBuilder<T>;
  eq(column: string, value: string): MinimalQueryBuilder<T>;
  limit(n: number): MinimalQueryBuilder<T>;
}

interface MinimalClient {
  from<T>(table: string): MinimalQueryBuilder<T>;
}

/** `domain_blocks` is not in the generated `Database` type — the same
 *  worked-around schema gap `admission.ts` documents. This is the cast
 *  boundary and nothing else in this file bypasses the generated type. */
function untyped(client: { from: unknown }): MinimalClient {
  return client as unknown as MinimalClient;
}

/** Whether this domain's report was taken down on the site owner's written
 *  request. One indexed read, against a client the caller already holds. */
export async function isRemovedWith(client: { from: unknown }, domain: string): Promise<boolean> {
  const { data, error } = await untyped(client)
    .from<DomainBlockRow>("domain_blocks")
    .select("domain")
    .eq("domain", domain)
    .limit(1);
  if (error) throw new Error(error.message);
  return Array.isArray(data) && data.length > 0;
}

/** The same read, for a caller with no client of its own. */
export function isDomainRemoved(domain: string): Promise<boolean> {
  return isRemovedWith(dbAdmin(), domain);
}
