// BUILD §4.1: the one read of the removal table, so admission, the correction offer and a removed address's status cannot disagree.
// Apart from `admission.ts` because the middleware runs on the Edge runtime, which lacks the `node:crypto` admission imports; this imports only the database client.
// It never writes. It throws on an unanswerable read, and each caller decides what that means (admission and the rewrite fail open).
import { dbAdmin } from "@/lib/db";

// Named once, so every read of the takedown list is in this file.
const TABLE = "domain_blocks";

interface DomainBlockRow {
  domain: string;
}

interface QueryResult<T> {
  data: T[] | null;
  error: { message: string } | null;
  count?: number | null;
}

interface MinimalQueryBuilder<T> extends PromiseLike<QueryResult<T>> {
  select(columns: string, options?: { count: "exact" }): MinimalQueryBuilder<T>;
  eq(column: string, value: string): MinimalQueryBuilder<T>;
  order(column: string, options: { ascending: boolean }): MinimalQueryBuilder<T>;
  limit(n: number): MinimalQueryBuilder<T>;
}

interface MinimalClient {
  from<T>(table: string): MinimalQueryBuilder<T>;
}

/** `domain_blocks` is not in the generated `Database` type: this is the cast boundary, nothing else here bypasses it. */
function untyped(client: { from: unknown }): MinimalClient {
  return client as unknown as MinimalClient;
}

/** Whether this domain's report was taken down on the site owner's written
 *  request. One indexed read, against a client the caller already holds. */
export async function isRemovedWith(client: { from: unknown }, domain: string): Promise<boolean> {
  const { data, error } = await untyped(client)
    .from<DomainBlockRow>(TABLE)
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

/** The takedown list's size and newest row as one key: a removal changes it at once, so a listing cached on it never waits out a window. */
export async function removalsMark(): Promise<string> {
  const { data, error, count } = await untyped(dbAdmin())
    .from<{ blocked_at: string }>(TABLE)
    .select("blocked_at", { count: "exact" })
    .order("blocked_at", { ascending: false })
    .limit(1);
  if (error) throw new Error(`could not read the removals: ${error.message}`);
  return `${count ?? 0}|${data?.[0]?.blocked_at ?? ""}`;
}
