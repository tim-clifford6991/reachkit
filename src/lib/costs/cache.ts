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
}): Promise<{ payload: unknown; storedAt: Date } | null> {
  const cutoff = new Date(
    Date.now() - params.freshnessDays * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data, error } = await untypedFetches(dbAdmin())
    .from<Pick<FetchesRow, "payload" | "created_at">>("fetches")
    .select("payload, created_at")
    .eq("source", params.source)
    .eq("cache_key", params.cacheKey)
    .eq("policy_version", params.policyVersion)
    .gt("created_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(CACHE_READ_SCAN_LIMIT);

  if (error) {
    throw new Error(`cache.ts: read from fetches failed: ${error.message}`);
  }

  for (const row of data ?? []) {
    if (isEmptyPayload(row.payload)) continue;
    // An unreadable `created_at` is still a hit; its date falls back to the cutoff, the oldest a row in the window can be.
    const storedAt = new Date(row.created_at ?? cutoff);
    return { payload: row.payload, storedAt: Number.isNaN(storedAt.getTime()) ? new Date(cutoff) : storedAt };
  }
  return null;
}
