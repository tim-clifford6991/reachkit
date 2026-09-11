// BUILD §6.5 — the cache read — a fetch already paid for is never bought twice.
// src/lib/costs/cache.ts — BP-007's cache read (WO-022, folded into WO-276)
//
// Keyed `source + cacheKey + policyVersion` (BP-007 `## Error & edge
// behavior`). A cache read is the newest row on that key inserted within
// `freshnessDays`, **excluding a row whose payload is the vendor's own
// zero-result shape** (BP-007 decision 3 — "the exclusion is at the read,
// not the write"): an empty payload is always a miss, retried and
// ledgered again on the next scan, and never served back as a hit. Bumping
// `policyVersion` is how a changed derivation invalidates its cache;
// nothing is ever deleted here or anywhere else in this seam.
//
// **Genericity (rule 1.1 — parameter, recorded here since BP-007 states
// the *shape* — "an empty array or an explicit no-match marker the parser
// already produces" — but not a closed rule this seam can encode without
// learning a vendor's payload format, which WO-276's own dispatch forbids
// ("this seam learns nothing about AI Overviews or any vendor").** The
// only shape every vendor's parser can be expected to agree on without
// this seam knowing anything vendor-specific is: `null`/`undefined`, or an
// empty array. A vendor whose own "no match" marker is some other shape
// (an object, a sentinel string) normalises it to one of these two before
// the payload reaches `recordFetch` — that normalisation is the call
// site's (BP-008's, BP-009's), the same way `settleCents`'s vendor rule
// stays at the call site (BP-007 decision 4). Reversal cost: change one
// function (`isEmptyPayload`, below); no schema or interface change.
import { dbAdmin } from "@/lib/db";
import { untypedFetches, type FetchesRow } from "./ledger";
import { isFetchRefusal, isVendorFailure } from "./refusal";

/** How many of the newest rows on one key, inside the freshness window,
 *  this read is willing to scan past before giving up and calling it a
 *  miss (rule 1.1 — parameter). Chosen generously: a key would need this
 *  many *consecutive* empty-payload re-buys inside one freshness window
 *  before a perfectly good, older, non-empty row stopped being found —
 *  a pathological case, not an ordinary one. Reversal cost: change one
 *  constant; the read stays correct either way, only slower or faster to
 *  give up. */
const CACHE_READ_SCAN_LIMIT = 50;

/** BP-007 decision 3's "zero-result shape" — see this module's header for
 *  why the definition stops at `null`/`undefined`/`[]` rather than
 *  learning any vendor's own marker. */
export function isEmptyPayload(payload: unknown): boolean {
  if (payload === null || payload === undefined) return true;
  if (Array.isArray(payload) && payload.length === 0) return true;
  // A refused fetch is ledgered as a row (issue #479) and is never served
  // back: "no negative cache" (BUILD §6.4).
  if (isFetchRefusal(payload)) return true;
  // So is a failed vendor call (issue #504): a 5xx today is re-bought on
  // the next scan, never served back for the rest of the window.
  if (isVendorFailure(payload)) return true;
  return false;
}

/** The newest non-empty payload on `(source, cacheKey, policyVersion)`
 *  inserted within `freshnessDays` — `null` on a miss (no row at all, or
 *  every row in the window is the zero-result shape). Never writes to
 *  `fetches`; a hit costs nothing to ledger (BP-007 `## Public
 *  interface`: "Cache-first, ledger-always ... `fresh` false means the
 *  payload came from cache and cost nothing"). */
export async function readCache(params: {
  source: string;
  cacheKey: string;
  policyVersion: number;
  freshnessDays: number;
}): Promise<{ payload: unknown } | null> {
  const cutoff = new Date(
    Date.now() - params.freshnessDays * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data, error } = await untypedFetches(dbAdmin())
    .from<Pick<FetchesRow, "payload">>("fetches")
    .select("payload")
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
    if (!isEmptyPayload(row.payload)) return { payload: row.payload };
  }
  return null;
}
