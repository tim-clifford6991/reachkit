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

/** Common English/web filler words that carry no brand or category meaning
 *  ("the", "reviews", "com"…). Moved here (from `search-visibility.ts`, which
 *  now imports it) so the ONE tokenizer below is self-contained — the exact
 *  same stopword list `search-visibility.ts` always used, just relocated so
 *  `brandTokensFor`'s name-folding can use it too without re-declaring it. */
export const STOPWORDS = new Set([
  "the", "and", "for", "with", "your", "you", "our", "are", "was", "how", "why",
  "what", "who", "best", "top", "app", "apps", "tool", "tools", "software", "online",
  "free", "new", "get", "com", "www", "http", "https", "vs", "review", "reviews",
]);

/** Break a phrase into meaningful lowercase tokens (len ≥ 3, non-stopword).
 *  Shared with `search-visibility.ts`, which imports this instead of keeping
 *  its own copy — one tokenizer, so a name folds into brand tokens (or into
 *  category vocab) identically everywhere. */
export function tokens(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}

/** A single generic word ("Platform", "Time", "Guide"…) must never itself
 *  become a brand token — a listing name like "Twitter Platform" must not turn
 *  every ordinary "platform" query into a brand hit. Moved here (from
 *  `search-visibility.ts`, which now imports it for its own, separate
 *  category-vocab-pollutant rule) so there is exactly ONE list — no second,
 *  driftable copy for the two engines to disagree on. */
export const GENERIC_TOKENS = new Set([
  "time", "news", "search", "video", "videos", "image", "images", "photo", "photos",
  "web", "site", "sites", "home", "page", "pages", "live", "today", "tomorrow", "world",
  "similar", "account", "accounts", "features", "feature", "technology", "tech", "platform",
  "media", "digital", "mobile", "global", "local", "data", "info", "information", "guide",
  "help", "list", "service", "interface", "integration", "multiple", "assets", "content",
  "price", "pricing", "login", "sign", "register", "download", "update", "version", "meaning",
  // "system" joins the platform/interface/integration family of generic product
  // descriptors — added by the calibration corpus (spacex "space launch system":
  // "system" has no vocabulary evidence of its own, but is exactly the same class
  // of generic qualifier as the tokens already above it).
  "system",
]);

/**
 * Brand tokens for a set of domains: each domain's label plus its meaningful
 * sub-parts. For "cirrus-insight.com" → {"cirrus-insight", "cirrus", "insight"},
 * so "insight tool" registers as brand. Pass one domain (the subject) for the
 * free footprint; pass [subject, ...rivals] for the paid gap filter.
 *
 * `names` (optional) folds in the subject's REAL captured name(s) — e.g.
 * `facts.listing.name` — so a domain whose label alone is unusable ("x.com" ->
 * "x", 1 char) or simply wrong (a renamed/rebranded product) still gets its
 * true brand recognised ("Twitter / X" -> "twitter"). This is the ONE place
 * that union happens: both the free footprint classifier (`search-visibility.ts`
 * buildVocab) and the paid keyword-gap filter (`keyword-gap.ts`) call THIS
 * function with their own `names` — neither re-implements the fold-in/generic-
 * word-filter loop locally, so the two can never drift on what counts as a
 * subject's own brand (RC1).
 */
export function brandTokensFor(domains: string[], names: string[] = []): Set<string> {
  const brandTokens = new Set<string>();
  for (const d of domains) {
    const label = d.replace(/^www\./, "").split(".")[0]?.toLowerCase() ?? "";
    if (label.length >= 3) brandTokens.add(label);
    // Split a camel/compound brand ("cirrus-insight") into parts if they read as words.
    for (const part of label.split(/[^a-z0-9]+/)) if (part.length >= 3) brandTokens.add(part);
  }
  for (const name of names) {
    for (const t of tokens(name)) {
      if (GENERIC_TOKENS.has(t)) continue; // a generic word in a name is not itself a brand
      brandTokens.add(t);
    }
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
