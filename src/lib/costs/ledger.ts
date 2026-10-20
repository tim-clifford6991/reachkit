// BUILD §6.5 — the ledger write — every vendor call recorded before it is answered.
// One row for every call that reached the vendor, a parse failure included; this module writes the two figures it is given.
import { dbAdmin } from "@/lib/db";

/** One `fetches` row, declared here because the generated types do not hold
 *  the table. `payload` is `unknown`; each caller knows its own shape.
 *  Money is cents to four decimals (`numeric(12,4)`), the unit of `CAPS` and
 *  the price book: the column rounds it, and nothing here does. */
export interface FetchesRow {
  id: string;
  scan_id: string;
  source: string;
  cache_key: string;
  policy_version: number;
  cost_cents: number;
  reserved_cents: number;
  payload: unknown;
  /** How long the call took in ms, the time waited where it was abandoned.
   *  `null` is a row that was not timed, never one that took no time. */
  duration_ms: number | null;
  /** What the vendor says it charged for this call, in cents, read from its
   *  response. `null` where the response carried no charge —
   *  a model call, an own-page read, a row from before the column. Never an
   *  estimate: that is `cost_cents`. */
  billed_cents: number | null;
  /** Whose spend and why. The database fills `site_id`,
   *  `activity` and `outcome` on insert from the scan and the payload; the
   *  writer names `activity` only for a draft's calls, and `draft_id` once
   *  the draft has a row. */
  site_id: string | null;
  activity: string;
  draft_id: string | null;
  outcome: "ok" | "failed" | "timeout";
  created_at: string;
}

interface QueryResult<T> {
  data: T[] | null;
  error: { message: string; code?: string } | null;
}

interface MinimalQueryBuilder<T> extends PromiseLike<QueryResult<T>> {
  select(columns: string): MinimalQueryBuilder<T>;
  eq(column: string, value: string | number): MinimalQueryBuilder<T>;
  gt(column: string, value: string): MinimalQueryBuilder<T>;
  order(column: string, opts: { ascending: boolean }): MinimalQueryBuilder<T>;
  limit(count: number): MinimalQueryBuilder<T>;
  insert<R extends object>(row: R): MinimalQueryBuilder<T>;
  update<R extends object>(values: R): MinimalQueryBuilder<T>;
  in(column: string, values: readonly string[]): MinimalQueryBuilder<T>;
}

interface MinimalClient {
  from<T>(table: string): MinimalQueryBuilder<T>;
}

/** The one cast past the generated `Database` type, for a table it does not hold. */
export function untypedFetches(client: ReturnType<typeof dbAdmin>): MinimalClient {
  return client as unknown as MinimalClient;
}

/** Writes one `fetches` row: the ledger, cache and raw store in one. Never
 *  called for a cache hit, which costs nothing. */
export async function writeFetchRow(row: {
  /** The row's id, chosen by the writer so a draft's cost
   *  context can name its earlier rows once the draft has a row. */
  id?: string;
  scanId: string;
  source: string;
  cacheKey: string;
  policyVersion: number;
  reservedCents: number;
  costCents: number;
  payload: unknown;
  /** The elapsed milliseconds of the call this row records. */
  durationMs?: number;
  /** The vendor's own charge, where its response carried one. */
  billedCents?: number;
  /** `draft` for a draft's calls; absent, the database reads
   *  the activity off the scan. */
  activity?: "draft";
  draftId?: string;
}): Promise<void> {
  const base = {
    ...(row.id === undefined ? {} : { id: row.id }),
    scan_id: row.scanId,
    source: row.source,
    cache_key: row.cacheKey,
    policy_version: row.policyVersion,
    reserved_cents: row.reservedCents,
    cost_cents: row.costCents,
    payload: storable(row.payload),
    ...(row.durationMs === undefined ? {} : { duration_ms: Math.round(row.durationMs) }),
  };
  const added = {
    ...(row.billedCents === undefined ? {} : { billed_cents: row.billedCents }),
    ...(row.activity === undefined ? {} : { activity: row.activity }),
    ...(row.draftId === undefined ? {} : { draft_id: row.draftId }),
  };
  const insert = (values: object) => untypedFetches(dbAdmin()).from<FetchesRow>("fetches").insert(values);
  let { error } = await insert({ ...base, ...added });
  if (error && Object.keys(added).length > 0 && lacksAddedColumn(error)) {
    // A deploy ahead of its migration: the row is the ledger and the cache, so it is written without the newer columns rather than lost.
    console.warn(JSON.stringify({ event: "fetches_column_missing", source: row.source, columns: Object.keys(added), message: error.message }));
    ({ error } = await insert(base));
  }
  if (error) {
    throw new Error(`ledger.ts: insert into fetches failed: ${error.message}`);
  }
}

/** Names the draft a cost context's earlier rows were spent
 *  for, once that draft has a row. Never throws: the rows are the ledger
 *  and stand either way, and a page is not lost because its calls could
 *  not be named. A database the migration has not reached has no column to
 *  name them in; anything else is said on the log. */
export async function nameDraftOnRows(rowIds: readonly string[], draftId: string): Promise<void> {
  if (rowIds.length === 0) return;
  try {
    const { error } = await untypedFetches(dbAdmin())
      .from<FetchesRow>("fetches")
      .update({ activity: "draft", draft_id: draftId })
      .in("id", rowIds);
    if (error && !lacksAddedColumn(error)) {
      console.warn(JSON.stringify({ event: "draft_rows_unnamed", draftId, rows: rowIds.length, message: error.message }));
    }
  } catch (error) {
    console.warn(JSON.stringify({ event: "draft_rows_unnamed", draftId, rows: rowIds.length, message: error instanceof Error ? error.message : String(error) }));
  }
}

/** The payload as `jsonb` can hold it: Postgres refuses a
 *  string with a NUL in it ("unsupported Unicode escape sequence"), whoever
 *  sent it — a page, a vendor or a model — and the row is the ledger, so
 *  the character goes and the row is written. */
function storable(payload: unknown): unknown {
  const json = JSON.stringify(payload);
  if (json === undefined || !json.includes("\\u0000")) return payload;
  return JSON.parse(json, (_key, value: unknown) => (typeof value === "string" ? value.replaceAll("\u0000", "") : value));
}

/** PostgREST's answer for a column its schema cache does not hold
 *  (`PGRST204`), or Postgres's own (`42703`), naming one this module added
 *  after the table was first applied. */
const ADDED_COLUMNS = ["billed_cents", "activity", "draft_id"] as const;
function lacksAddedColumn(error: { message: string; code?: string }): boolean {
  return (
    (error.code === "PGRST204" || error.code === "42703" || error.code === undefined) &&
    ADDED_COLUMNS.some((column) => error.message.includes(column))
  );
}
