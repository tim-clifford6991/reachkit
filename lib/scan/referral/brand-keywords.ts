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
 *  `brandTokensFor`'s name-folding can use it too without re-declaring it.
 *
 *  Task-G (2026-07-20, the savvycal "time in hi" class): the closed set of
 *  short (2-char) English grammatical particles — articles/prepositions/
 *  pronouns/conjunctions that are NEVER content ("in", "is", "at", "to"…).
 *  Needed once `tokens()` (below) stops dropping every 2-char word: without
 *  this, a phrase like "time in hi" would require "in" itself to carry
 *  vocabulary support, which no real category vocabulary ever provides for a
 *  pure function word — regressing legitimate category phrases that happen
 *  to contain one. Deliberately excludes any 2-char word that plausibly
 *  functions as CONTENT in a search query — an abbreviation, initial, or
 *  a geo/state code: "hi" (Hawaii), "ca" (California), "ny" (New York) etc.
 *  are NOT listed here on purpose, even though a couple of these double as
 *  (rare, informal) English words too — that ambiguity is inherent to
 *  2-letter English, not something a stopword list can fully resolve, and the
 *  KNOWN residual is that a legitimate category phrase using one of THESE
 *  remaining tokens as a function word (rarer in commercial search queries
 *  than "in"/"or"/"ok") could still be foreclosed by it.
 *
 *  Review fix (2026-07-20, Critical finding on this same class): the set
 *  above was still missing three everyday closed-class function words — "in"
 *  (preposition: "opt IN form builder", "log IN", "built IN"), "or"
 *  (coordinating conjunction: "sign up OR log in"), and "ok" (discourse
 *  particle/interjection: "is this OK to use"). Their absence meant those
 *  extremely common filler words now had to be individually vocab-supported
 *  by the classify() macro rule (added by the SAME change that lowered the
 *  token floor to 2 chars) — which no real subject vocabulary ever provides
 *  for a bare function word — foreclosing otherwise fully-supported category
 *  phrases to off-topic (reproduced live: an email-capture SaaS's own "opt in
 *  form builder" went off-topic). Audited against the closed set of common
 *  2-char English function words/particles (of/to/at/an/is/it/be/by/as/on/up/
 *  we/he/so/no/if/do/my/me/us/am + in/or/ok) — every member of that list is
 *  now present. "or" and "ok" ALSO double as US state codes (Oregon,
 *  Oklahoma) — same inherent 2-letter-English ambiguity as "hi"/"ca"/"ny"
 *  above, and the same KNOWN residual applies to them now that they've moved
 *  into this list: a state-code use of "or"/"ok" as a phrase's only content
 *  token will incorrectly be treated as filler. That trade favors the far
 *  more common function-word reading. */
const SHORT_STOPWORDS = new Set([
  "am", "an", "as", "at", "be", "by", "do", "go", "he", "if", "in", "is", "it",
  "me", "my", "no", "of", "ok", "on", "or", "so", "to", "up", "us", "we",
]);

export const STOPWORDS = new Set([
  "the", "and", "for", "with", "your", "you", "our", "are", "was", "how", "why",
  "what", "who", "best", "top", "app", "apps", "tool", "tools", "software", "online",
  "free", "new", "get", "com", "www", "http", "https", "vs", "review", "reviews",
  ...SHORT_STOPWORDS,
]);

/** Break a phrase into meaningful lowercase tokens (len ≥ 2, non-stopword).
 *  Shared with `search-visibility.ts`, which imports this instead of keeping
 *  its own copy — one tokenizer, so a name folds into brand tokens (or into
 *  category vocab) identically everywhere.
 *
 *  Task-G (2026-07-20, the savvycal "time in hi" class, root-caused against
 *  savvycal's REAL captured footprint): the floor used to be 3 chars, so
 *  "time in hi" tokenized to JUST ["time"] — "in" was filler-length anyway,
 *  but "hi" (a real, meaningful Hawaii-timezone signal) was silently dropped
 *  for being 2 chars, same as "in". The classifier's macro rule ("every
 *  non-generic token of the phrase must be supported") was then satisfied
 *  VACUOUSLY by the single surviving token "time" — a generic word legitimized
 *  only via the LLM's own category-seed corroboration — because the ONE word
 *  that actually disambiguated the phrase never reached the check. Lowering
 *  the floor to 2 and filtering the closed class of short grammatical
 *  particles (`SHORT_STOPWORDS`, not a place-name list) instead of a raw
 *  length cutoff keeps real 2-char content — geo/state codes, initials,
 *  abbreviations ("hi", "ca", "ny", "ai", "js") — in every token-vocabulary
 *  computation that routes through this ONE function: brand tokens, category
 *  vocab, the classifier's support check, AND the tier-grounding overlap
 *  check (`groundedCategoryTokens`/`isTierPhraseGrounded` in
 *  `search-visibility.ts`) — one shared tokenizer, not a fork local to the
 *  classifier (RC1). */
export function tokens(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

/** Light, symmetric singular/plural + gerund fold so "rockets" (a seed's own
 *  prose) and "rocket" (a real query token) — or "sending" and "send" — read as
 *  the SAME token when checking vocabulary support. Deliberately tiny (no real
 *  stemmer): it exists only to stop ordinary inflection from masquerading as an
 *  "unsupported token" under the classifier's stricter rule, or as an
 *  unrelated shared token under the tier-grounding overlap check. Domain-agnostic
 *  — it has no knowledge of any subject, so it cannot be a per-domain special
 *  case. Moved here (from `search-visibility.ts`, PR-9 2026-07-20, the
 *  "platform"/"platforms" tier-grounding class) so there is exactly ONE
 *  stemmer — the classifier's `isVocabSupported` and the tier-grounding
 *  overlap check (`groundedCategoryTokens`/`isTierPhraseGrounded`) both route
 *  through THIS function instead of each hand-listing singular/plural pairs
 *  into `GENERIC_TOKENS`, which only ever fixes the ONE plural reported and
 *  leaves every other unlisted plural (or gerund) able to false-ground the
 *  same way. `search-visibility.ts` re-exports this for backward-compatible
 *  import paths. */
export function stem(t: string): string {
  let s = t;
  if (s.length > 5 && s.endsWith("ing")) s = s.slice(0, -3);
  else if (s.length > 4 && /(ches|shes|xes|zes|ses)$/.test(s)) s = s.slice(0, -2);
  else if (s.length > 4 && s.endsWith("ies")) s = `${s.slice(0, -3)}y`;
  else if (s.length > 3 && s.endsWith("s") && !s.endsWith("ss")) s = s.slice(0, -1);
  // Guard: a stem that collapses into a STOPWORD or below the meaningful-token
  // length floor (3, matching `tokens()`) is not a real stem — it's an
  // over-aggressive strip that happens to be harmless today only because
  // STOPWORDS filters it before it can corrupt vocab matching ("news" → "new").
  // Keep the ORIGINAL token rather than ship a silently-wrong stem.
  if (s !== t && (STOPWORDS.has(s) || s.length < 3)) return t;
  return s;
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
