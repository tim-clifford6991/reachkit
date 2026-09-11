// BUILD §5
// src/lib/measure/own-fetch.ts — the one shape an own-document read takes
// in the `fetches` ledger (BUILD §6.5: "one `fetches` table is ledger +
// cache + raw store"). `measureDomain` (`index.ts`) writes it through
// `recordFetch`; `readMeasuredText` (`text.ts`) reads it back. Declared
// in its own small module so neither of those two files imports the other.
//
// A stored document is the JSON-safe projection of `FetchOutcome`'s `ok`
// arm — `readAt` as an ISO string, because `jsonb` has no Date. A failed
// read is never stored under this shape: `index.ts` returns the ledger's
// own `FetchRefusal` row from the `run` closure on `ok: false` — never a
// `null`, which `fetches.payload`'s `not null` refused (issue #479) — and
// BP-007's cache treats a refusal as a miss ("an empty payload is always a
// miss; no negative cache", BUILD §6.4), so a timeout today never becomes
// "timeout" for the rest of the cache window.
import { OWN_DOCUMENT_MAX_BYTES } from "@/lib/config/constants";
import type { SafeFetchOpts } from "@/lib/egress/safe-fetch";
import type { FetchOutcome } from "@/lib/egress/types";

/** The `source` column value of every own-document row. One string, read
 *  by the writer and the reader; nothing else in the product ledgers under
 *  it. */
export const OWN_FETCH_SOURCE = "egress.safeFetch";

/** The options every own-document read passes to `safeFetch`: the
 *  measurement token, and the customer's own documents' size cap
 *  (`OWN_DOCUMENT_MAX_BYTES`, master ruling 2026-09-10, #479). Vendor and
 *  rival reads never pass it — they keep the fetcher's 2 MB default. */
export const OWN_FETCH_OPTS = Object.freeze({
  userAgent: "reachkit-measure",
  maxBytes: OWN_DOCUMENT_MAX_BYTES,
} as const satisfies SafeFetchOpts);

export interface StoredDocument {
  url: string;
  status: number;
  html: string;
  bytes: number;
  /** ISO-8601, the `readAt` of the outcome this was projected from. */
  readAt: string;
}

export function toStoredDocument(outcome: Extract<FetchOutcome, { ok: true }>): StoredDocument {
  return {
    url: outcome.url,
    status: outcome.status,
    html: outcome.html,
    bytes: outcome.bytes,
    readAt: outcome.readAt.toISOString(),
  };
}

/** Structural check over an `unknown` payload read back from `fetches` —
 *  a row written under `OWN_FETCH_SOURCE` by a different shape (none
 *  exists today) is skipped, never thrown on. */
export function isStoredDocument(payload: unknown): payload is StoredDocument {
  if (payload === null || typeof payload !== "object") return false;
  const p = payload as Record<string, unknown>;
  return (
    typeof p.url === "string" &&
    typeof p.status === "number" &&
    typeof p.html === "string" &&
    typeof p.bytes === "number" &&
    typeof p.readAt === "string" &&
    !Number.isNaN(new Date(p.readAt).getTime())
  );
}
