/**
 * The `FactSheetKind` type, factored out of `fact-sheets.ts` into its own
 * zero-dependency module so `lib/scan/fixture-seam.ts` (a prod-importable test
 * seam) can reference it without pulling in `fact-sheets.ts`'s DB-backed
 * implementation. `fact-sheets.ts` re-exports it so no other consumer needs to
 * change.
 *
 * History: originally factored out specifically to break a cycle through
 * `GROUNDING_POLICY_VERSION` (web-reviews.ts → fixture-seam.ts →
 * fact-sheets.ts → web-reviews.ts) — that import was removed when the
 * `review_themes` producer (and its policy-versioned cache) was retired
 * (M3b, 2026-07-23). The module stays split for the DB-free-leaf reason above.
 */
export type FactSheetKind =
  | "positioning"
  | "competitor_gap"
  | "keyword_data"
  | "relevance_verdicts";

/**
 * Cache-policy version for the `relevance_verdicts` kind (Phase B, 2026-07-22).
 *
 * OWNED by the LLM relevance judge (`lib/scan/relevance-judge.ts`) — bump it
 * whenever the judge's prompt or verdict semantics change, so every verdict
 * sheet cached under the old policy is treated as a MISS on read-back even
 * inside its TTL (invariant #3 / Task 2b — the same policy-suffix cache-
 * invalidation mechanism the now-retired `review_themes` kind used to share).
 * It lives HERE, in this zero-dep leaf, rather than in the judge module
 * because `fact-sheets.ts` reads it for the read-back check and the judge
 * imports `fact-sheets.ts` — putting the constant in the judge module would
 * close that into a cycle.
 */
export const RELEVANCE_JUDGE_VERSION = 1;
