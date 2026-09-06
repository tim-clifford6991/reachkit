// BUILD §9 — the one cast boundary this subsystem holds, and why.
//
// Every column this issue adds — `publications.delivery_state`,
// `attempt_no`, `claimed_at`, `failure_reason`, `remote_id`,
// `made_live_by_us`, `unpublish_outcome`, `verify_due_at`;
// `drafts.transitions`, `publishable_since`, `hard_rules_passed`;
// `sites.publishing_enabled` — lands in its own migration and is **absent
// from `src/lib/db/types.generated.ts`**, which is regenerated on its own
// schedule and was not regenerated for any migration in this repository.
// `src/lib/scan/admission.ts` documents the same gap for
// `scans.network_hash` and works around it the same way.
//
// So the module declares the row shapes it reads, and reaches Postgres
// through one narrow, explicitly cast builder — declared here, once, rather
// than at each of the six call sites. Regenerating the `Database` type
// deletes this file and nothing else changes: the query text is already the
// query text.
//
// `@/lib/db` is the only import: the two clients are the only way any code
// reaches Postgres, and this file holds no query of its own.
import { dbAdmin } from "@/lib/db";

export interface QueryResult<T> {
  data: T[] | null;
  error: { message: string; code?: string } | null;
}

export interface SingleResult<T> {
  data: T | null;
  error: { message: string; code?: string } | null;
}

export interface RpcResult<T> {
  data: T | null;
  error: { message: string; code?: string } | null;
}

/** The subset of the PostgREST filter-builder chain this subsystem calls,
 *  typed against locally declared row shapes. Thenable, matching the real
 *  client's own builder. */
export interface PublishQuery<T> extends PromiseLike<QueryResult<T>> {
  select(columns: string): PublishQuery<T>;
  eq(column: string, value: string | number | boolean): PublishQuery<T>;
  neq(column: string, value: string | number | boolean): PublishQuery<T>;
  in(column: string, values: readonly (string | number)[]): PublishQuery<T>;
  gte(column: string, value: string): PublishQuery<T>;
  not(column: string, operator: string, value: unknown): PublishQuery<T>;
  order(column: string, opts: { ascending: boolean }): PublishQuery<T>;
  limit(count: number): PublishQuery<T>;
  insert<R extends object>(row: R): PublishQuery<T>;
  update<R extends object>(values: R): PublishQuery<T>;
  single(): PromiseLike<SingleResult<T>>;
}

export interface PublishClient {
  from<T>(table: string): PublishQuery<T>;
  rpc<T>(fn: string, args: Record<string, unknown>): PromiseLike<RpcResult<T>>;
}

/** The cast boundary. Nothing else under `src/lib/publish/` bypasses the
 *  generated `Database` type, and nothing here constructs a client. */
export function publishDb(): PublishClient {
  return dbAdmin() as unknown as PublishClient;
}
