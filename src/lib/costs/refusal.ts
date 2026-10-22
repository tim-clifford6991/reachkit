// BUILD §6.5 — what a refused fetch, or a failed vendor call, writes to the ledger.
// Apart from `ledger.ts` so a suite that doubles the ledger write keeps this classifier.
import type { FetchOutcome } from "@/lib/egress/types";

/** Why a fetch toward a customer URL came back without a document — the
 *  egress seam's own closed list (`FetchOutcome`'s `ok: false` arm). */
export type FetchRefusalReason = Extract<FetchOutcome, { ok: false }>["reason"];

/** A refused fetch is a row, never a null: `fetches.payload` is `not null`.
 *  A refused body is never kept; the row is ledgered at 0 cents and the
 *  cache never serves it (BUILD §6.4, "no negative cache"). */
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

/** A failed vendor call is a row, never a null. `vendorFailure` is the call
 *  site's closed kind, `endpoint` the ledger `source`, and `billed` the call
 *  site's word on whether the vendor charges for it: this seam learns no
 *  vendor's rule. The cache never serves one (BUILD §6.4). */
export interface VendorFailure {
  vendorFailure: string;
  endpoint: string;
  billed: boolean;
  /** A queued task that was paid for and can still be read. */
  taskId?: string;
  /** The vendor refused it for lack of credit, by the call site's word. */
  funds?: true;
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
