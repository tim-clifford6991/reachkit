// BUILD §6.5 — the cache read — a fetch already paid for is never bought twice.
// Keyed `source + cacheKey + policyVersion`; bumping `policyVersion` invalidates, and nothing is ever deleted.
// An empty payload is excluded at the read, not the write, so it is re-bought rather than served.
import { dbAdmin } from "@/lib/db";
import { untypedFetches, type FetchesRow } from "./ledger";
import { isFetchRefusal, isVendorFailure } from "./refusal";

/** How many of a key's newest rows in the window are scanned past before a
 *  miss; generous, since it takes that many consecutive empty re-buys to hide
 *  a good older row. */
const CACHE_READ_SCAN_LIMIT = 50;

/** The zero-result shape. It stops at `null`/`undefined`/`[]` so this seam
 *  learns no vendor's marker: a call site normalises its own "no match" to one
 *  of these before `recordFetch`. */
export function isEmptyPayload(payload: unknown): boolean {
  if (payload === null || payload === undefined) return true;
  if (Array.isArray(payload) && payload.length === 0) return true;
  // A refused fetch is never served back: "no negative cache" (BUILD §6.4).
  if (isFetchRefusal(payload)) return true;
  // Nor a failed vendor call: a 5xx today is re-bought on the next scan.
  if (isVendorFailure(payload)) return true;
  return false;
}

/** The newest non-empty payload on `(source, cacheKey, policyVersion)` within
 *  `freshnessDays`, or `null` on a miss. Never writes; a hit costs nothing.
 *  `storedAt` is the served row's `created_at`, so a report can say "reused
 *  from {date}" without guessing it from the reading's own date (SPEC §2). */
export async function readCache(params: {
  source: string;
  cacheKey: string;
  policyVersion: number;
  freshnessDays: number;
  /** The caller's own rule for a stored answer it must not be served; such a row stays and is read past. */
  unusable?: (payload: unknown) => boolean;
  /** Read this scan's own rows, whatever their age, in place of the window. */
  scanId?: string;
}): Promise<{ payload: unknown; storedAt: Date } | null> {
  const cutoff = new Date(
    Date.now() - params.freshnessDays * 24 * 60 * 60 * 1000
  ).toISOString();

  const keyed = untypedFetches(dbAdmin())
    .from<Pick<FetchesRow, "payload" | "created_at">>("fetches")
    .select("payload, created_at")
    .eq("source", params.source)
    .eq("cache_key", params.cacheKey)
    .eq("policy_version", params.policyVersion);
  const { data, error } = await (params.scanId === undefined ? keyed.gt("created_at", cutoff) : keyed.eq("scan_id", params.scanId))
    .order("created_at", { ascending: false })
    .limit(CACHE_READ_SCAN_LIMIT);

  if (error) {
    throw new Error(`cache.ts: read from fetches failed: ${error.message}`);
  }

  for (const row of data ?? []) {
    if (isEmptyPayload(row.payload) || params.unusable?.(row.payload) === true) continue;
    // An unreadable `created_at` is still a hit; its date falls back to the cutoff, the oldest a row in the window can be.
    const storedAt = new Date(row.created_at ?? cutoff);
    return { payload: row.payload, storedAt: Number.isNaN(storedAt.getTime()) ? new Date(cutoff) : storedAt };
  }
  return null;
}

/** Whether the read stored on a key before its newest row held rows, whatever its age: what an empty answer is held against. */
export async function heldRowsBefore(source: string, cacheKey: string): Promise<boolean> {
  const { data } = await untypedFetches(dbAdmin())
    .from<Pick<FetchesRow, "payload">>("fetches")
    .select("payload")
    .eq("source", source)
    .eq("cache_key", cacheKey)
    .order("created_at", { ascending: false })
    .limit(CACHE_READ_SCAN_LIMIT);
  const before = (data ?? []).slice(1).map((row) => row.payload).find((payload): payload is unknown[] => Array.isArray(payload));
  return before !== undefined && before.length > 0;
}

/** The key's newest row since `since` where it is a paid queued task still out, read by a later ask instead of a second post. */
export async function pendingTask(source: string, cacheKey: string, since: Date): Promise<{ id: string; taskId: string; storedAt: Date } | null> {
  const { data, error } = await untypedFetches(dbAdmin())
    .from<Pick<FetchesRow, "id" | "payload" | "created_at">>("fetches")
    .select("id, payload, created_at")
    .eq("source", source)
    .eq("cache_key", cacheKey)
    .gt("created_at", since.toISOString())
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw new Error(`cache.ts: read from fetches failed: ${error.message}`);
  const row = data?.[0];
  if (row === undefined || !isVendorFailure(row.payload) || row.payload.taskId === undefined) return null;
  return { id: row.id, taskId: row.payload.taskId, storedAt: new Date(row.created_at) };
}
