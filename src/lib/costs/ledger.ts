// BUILD §6.5 — the ledger write — every vendor call recorded before it is answered.
// src/lib/costs/ledger.ts — BP-007's write half (WO-022, folded into WO-276)
//
// `recordFetch`'s write half (`index.ts`): a row is written for every call
// that reached the vendor, including one that succeeded at the vendor and
// failed on parse (BP-007 `## Error & edge behavior`) — this module's job
// ends the moment it has written the row; what the caller does with the
// payload afterwards is not its concern. Every row carries both figures —
// `reserved_cents` (what the cap was checked against) and `cost_cents`
// (the settled figure where one settled, the reservation otherwise,
// ADR-094 decision 3a) — this module writes exactly the two numbers it is
// given; the reservation/settlement/clamp arithmetic is `index.ts`'s
// (BP-007's own file-plan split).
//
// **Schema-typing gap, flagged once here (constitution rule 4.2), same
// class `src/lib/scan/admission.ts` already names and works around:**
// `fetches` is this node's own table (BP-007 `code:
// supabase/migrations/*_fetches*.sql`), created by this WO's own
// migration, but `src/lib/db/types.generated.ts` is BP-002's generated
// artifact — outside this work order's file plan (`supabase/migrations/`,
// `src/lib/costs/`, `tests/costs/` only) and stale even against the
// applied baseline+RLS schema by that file's own header note.
// Regenerating it is a later, cross-boundary pass, not this WO's. This
// module therefore declares `FetchesRow` locally and reaches the table
// through a narrow, explicitly cast query-builder subset
// (`untypedFetches`) — the same `untyped()` escape hatch shape
// `src/lib/scan/admission.ts` uses for its own two schema gaps — rather
// than widening the generated `Database` type or losing typing on every
// other table `dbAdmin()` reaches.
import { dbAdmin } from "@/lib/db";
import type { FetchOutcome } from "@/lib/egress/types";

/** Why a fetch toward a customer URL came back without a document — the
 *  egress seam's own closed list (`FetchOutcome`'s `ok: false` arm). */
export type FetchRefusalReason = Extract<FetchOutcome, { ok: false }>["reason"];

/** **A refused fetch is a row, never a null** (issue #479). `fetches.payload`
 *  is `not null`; a refusal handed over as `null` made the insert throw, and
 *  the throw — not the refusal — became the stage's `undeterminable` reason
 *  (cal.com, a 2.16 MB home document over the 2 MB cap: every factor
 *  `not_attempted`, the pass "complete" in 0.6 s). So a refusal is written
 *  as what it is: the reason, the status where the server answered one, the
 *  bytes stored (none — a refused body is never kept, and never truncated),
 *  and the host. It is ledgered at 0 cents, and the cache never serves it
 *  (`cache.ts`'s `isEmptyPayload` — BUILD §6.4, "no negative cache"), so a
 *  refusal today is never a refusal for the rest of the window. */
export interface FetchRefusal {
  refusal: FetchRefusalReason;
  status: number | null;
  bytes: 0;
  host: string;
}

const REFUSAL_REASONS: ReadonlySet<string> = new Set<FetchRefusalReason>([
  "dns",
  "refused",
  "timeout",
  "too_large",
  "blocked_by_policy",
  "robots_disallowed",
  "status",
]);

/** The one projection of a failed outcome into the row's payload. */
export function refusalOf(outcome: Extract<FetchOutcome, { ok: false }>): FetchRefusal {
  let host = "";
  try {
    host = new URL(outcome.url).hostname;
  } catch {
    // A URL the fetcher could not parse still gets a row; its host is unknown.
  }
  return { refusal: outcome.reason, status: outcome.status ?? null, bytes: 0, host };
}

/** Structural check over an `unknown` payload read back from `fetches`. */
export function isFetchRefusal(payload: unknown): payload is FetchRefusal {
  if (payload === null || typeof payload !== "object") return false;
  const p = payload as Record<string, unknown>;
  return (
    typeof p.refusal === "string" &&
    REFUSAL_REASONS.has(p.refusal) &&
    (p.status === null || typeof p.status === "number") &&
    p.bytes === 0 &&
    typeof p.host === "string"
  );
}

/** The row shape `fetches` carries — BP-007 `## Data model delta`,
 *  verbatim column order. `payload` is read back as `unknown`; the caller
 *  on either side of this seam knows its own shape by convention (`P` on
 *  `recordFetch`), the same way `Json` already carries no shape opinion in
 *  the generated client.
 *
 *  **The money unit is cents, to four decimal places.** Both figures are
 *  `numeric(12,4)` in the schema (issue #449,
 *  `supabase/migrations/20260910090000_fetches_money.sql`) — the same unit
 *  `CAPS` and the price book are written in, so what this module writes is
 *  what the cap authorised, unrounded. They were `integer`, which rejected
 *  every sub-cent price in the book (`SERP_STD_C` 0.06¢) with `invalid
 *  input syntax for type integer`, took the whole stage down as
 *  undeterminable, and is why no production scan ever measured a score.
 *  A figure passes through here as a plain `number`; the column rounds it
 *  at the fourth decimal and nothing in this process rounds it before. */
export interface FetchesRow {
  id: string;
  scan_id: string;
  source: string;
  cache_key: string;
  policy_version: number;
  cost_cents: number;
  reserved_cents: number;
  payload: unknown;
  created_at: string;
}

interface QueryResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}

interface MinimalQueryBuilder<T> extends PromiseLike<QueryResult<T>> {
  select(columns: string): MinimalQueryBuilder<T>;
  eq(column: string, value: string | number): MinimalQueryBuilder<T>;
  gt(column: string, value: string): MinimalQueryBuilder<T>;
  order(column: string, opts: { ascending: boolean }): MinimalQueryBuilder<T>;
  limit(count: number): MinimalQueryBuilder<T>;
  insert<R extends object>(row: R): MinimalQueryBuilder<T>;
}

interface MinimalClient {
  from<T>(table: string): MinimalQueryBuilder<T>;
}

/** Cast boundary for the one schema gap this module (and `cache.ts`, which
 *  imports this) works around — nothing else in either file bypasses the
 *  generated `Database` type. */
export function untypedFetches(client: ReturnType<typeof dbAdmin>): MinimalClient {
  return client as unknown as MinimalClient;
}

/** Writes one `fetches` row — the ledger, cache and raw store in one (BP-007
 *  `## Module / boundary`). Called once per call that reached the vendor;
 *  never called for a cache hit, which costs nothing to ledger. */
export async function writeFetchRow(row: {
  scanId: string;
  source: string;
  cacheKey: string;
  policyVersion: number;
  reservedCents: number;
  costCents: number;
  payload: unknown;
}): Promise<void> {
  const { error } = await untypedFetches(dbAdmin())
    .from<FetchesRow>("fetches")
    .insert({
      scan_id: row.scanId,
      source: row.source,
      cache_key: row.cacheKey,
      policy_version: row.policyVersion,
      reserved_cents: row.reservedCents,
      cost_cents: row.costCents,
      payload: row.payload,
    });
  if (error) {
    throw new Error(`ledger.ts: insert into fetches failed: ${error.message}`);
  }
}
