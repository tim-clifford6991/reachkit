// BUILD §6.5 — what a refused fetch, or a failed vendor call, writes to the
// ledger (issues #479, #504).
// src/lib/costs/refusal.ts
//
// Its own module, not `ledger.ts`: this is a pure shape and a classifier
// over it, read by the seam (`index.ts`, which settles a refusal at 0
// cents), the cache (`cache.ts`, which never serves one) and the own-site
// reader (`src/lib/measure/index.ts`, which writes one). Kept apart from
// the insert so a suite that doubles the ledger *write* never takes the
// classifier with it.
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

/** **A failed vendor call is a row, never a null** (issue #504) — the same
 *  defect as a refused fetch, on the vendor path: a DataForSEO 5xx, a
 *  timeout or a result the parser did not recognise was handed to the
 *  ledger as `null`, the insert threw, and the throw became the stage's
 *  reason. The row says what failed and where: `vendorFailure` is the call
 *  site's own closed kind (for DataForSEO, `src/lib/vendors/dataforseo/
 *  envelope.ts`'s `VendorFailureKind`), `endpoint` is the ledger `source`,
 *  and `billed` is the call site's statement of whether the vendor charges
 *  for a call that failed this way. This seam learns no vendor's rule: it
 *  settles an unbilled failure at 0 cents and a billed one like any other
 *  call, and the cache never serves either (BUILD §6.4, "no negative
 *  cache"). */
export interface VendorFailure {
  vendorFailure: string;
  endpoint: string;
  billed: boolean;
}

/** Structural check over an `unknown` payload read back from `fetches`. */
export function isVendorFailure(payload: unknown): payload is VendorFailure {
  if (payload === null || typeof payload !== "object") return false;
  const p = payload as Record<string, unknown>;
  return (
    typeof p.vendorFailure === "string" &&
    p.vendorFailure.length > 0 &&
    typeof p.endpoint === "string" &&
    typeof p.billed === "boolean"
  );
}
