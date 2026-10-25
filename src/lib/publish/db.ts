// BUILD §9 — the one cast boundary this subsystem holds. Its columns (`publications.delivery_state`, `drafts.transitions`,
// `sites.publishing_enabled` and the rest) are absent from `src/lib/db/types.generated.ts`, so callers declare row shapes
// and reach Postgres through this one cast builder. Regenerating the `Database` type deletes this file and nothing else.
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
  lte(column: string, value: string): PublishQuery<T>;
  is(column: string, value: null): PublishQuery<T>;
  not(column: string, operator: string, value: unknown): PublishQuery<T>;
  order(column: string, opts: { ascending: boolean }): PublishQuery<T>;
  limit(count: number): PublishQuery<T>;
  insert<R extends object>(row: R): PublishQuery<T>;
  update<R extends object>(values: R): PublishQuery<T>;
  upsert<R extends object>(row: R, options: { onConflict: string; ignoreDuplicates?: boolean }): PublishQuery<T>;
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
