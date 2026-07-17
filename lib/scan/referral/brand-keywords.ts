/**
 * The ONE brand detector — shared by the free footprint classifier
 * (`lib/scan/search-visibility.ts`) and the paid keyword-gap filter
 * (`lib/scan/referral/keyword-gap.ts`).
 *
 * Before this module, each engine forked its own brand-token extraction and its
 * own "is this a brand keyword" test. They diverged: different tokenizers
 * (`match(/[a-z0-9]+/g)` vs `split(/\s+/)`), different substring thresholds
 * (≥6 vs ≥5), different compound-label handling (split into parts vs joined). The
 * same keyword could therefore classify as "brand" in one engine and "category"
 * in the other — the "two parallel keyword systems" root cause (RC1).
 *
 * The semantics here are FREE's, on purpose. Free's classification feeds
 * `computeSearchVisibility.score`, the search-presence driver of the v5 unified
 * Discoverability Score (invariant #1). Reproducing free's logic byte-for-byte
 * keeps every persisted free score stable; the paid keyword-gap filter (a render,
 * not a persisted score) adopts the same detector, so the two can never drift
 * again. Guard: `search-visibility.test.ts` (free score unchanged) +
 * `brand-keywords.test.ts` (the shared behavior) + the source tripwires pinning
 * that both engines call THIS module and neither re-forks a local copy.
 */

/**
 * Brand tokens for a set of domains: each domain's label plus its meaningful
 * sub-parts. For "cirrus-insight.com" → {"cirrus-insight", "cirrus", "insight"},
 * so "insight tool" registers as brand. Pass one domain (the subject) for the
 * free footprint; pass [subject, ...rivals] for the paid gap filter.
 */
export function brandTokensFor(domains: string[]): Set<string> {
  const brandTokens = new Set<string>();
  for (const d of domains) {
    const label = d.replace(/^www\./, "").split(".")[0]?.toLowerCase() ?? "";
    if (label.length >= 3) brandTokens.add(label);
    // Split a camel/compound brand ("cirrus-insight") into parts if they read as words.
    for (const part of label.split(/[^a-z0-9]+/)) if (part.length >= 3) brandTokens.add(part);
  }
  return brandTokens;
}

/**
 * True when `keyword` is a brand term for any token in `brands` — either an exact
 * word match, or (for a distinctive ≥6-char token) the phrase collapsed to a
 * string that contains it (so "trust mrr" → "trustmrr" reads as brand). Short
 * brand tokens (<6) match only as exact words, never as substrings, to avoid
 * "otter" firing inside "otterai".
 */
export function isBrandKeyword(keyword: string, brands: Set<string>): boolean {
  const toks: string[] = keyword.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  const joined = keyword.toLowerCase().replace(/[^a-z0-9]/g, "");
  for (const b of brands) {
    if (toks.includes(b)) return true;
    if (b.length >= 6 && joined.includes(b)) return true;
  }
  return false;
}
