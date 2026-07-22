/**
 * The `FactSheetKind` type, factored out of `fact-sheets.ts` into its own
 * zero-dependency module.
 *
 * Why: `fact-sheets.ts` needs to import `GROUNDING_POLICY_VERSION` from
 * `lib/scan/adapters/web-reviews.ts` (Task 2b, the cache-poisoning class fix),
 * and `lib/scan/fixture-seam.ts` needs this type — but `web-reviews.ts` already
 * imports `fixture-seam.ts` for the fixtures seam. Importing `FactSheetKind`
 * from `fact-sheets.ts` directly would close that into a cycle
 * (fixture-seam.ts → fact-sheets.ts → web-reviews.ts → fixture-seam.ts).
 * Sourcing it from this dependency-free file instead breaks the cycle.
 * `fact-sheets.ts` re-exports it so no other consumer needs to change.
 */
export type FactSheetKind =
  | "review_themes"
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
 * inside its TTL (invariant #3 / Task 2b — the same policy-suffix mechanism
 * `GROUNDING_POLICY_VERSION` gives `review_themes`). It lives HERE, in this
 * zero-dep leaf, rather than in the judge module because `fact-sheets.ts` reads
 * it for the read-back check and the judge imports `fact-sheets.ts` — putting
 * the constant in the judge module would close that into a cycle. Mirrors how
 * `web-reviews.ts` owns `GROUNDING_POLICY_VERSION` while `fact-sheets.ts`
 * consumes it.
 */
export const RELEVANCE_JUDGE_VERSION = 1;
