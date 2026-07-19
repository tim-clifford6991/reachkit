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
export type FactSheetKind = "review_themes" | "positioning" | "competitor_gap" | "keyword_data";
