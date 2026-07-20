/**
 * Free-tier "Search Visibility" — the honest, cheap conversion metric (iteration
 * 2 of the free report). Computed entirely from the ONE subject-only DataForSEO
 * `ranked_keywords` call the free scan already pays for (~$0.018), so it adds no
 * cost over the keyword teaser it supersedes.
 *
 * The problem it solves: the on-site headline score rewards clean HTML, so a tidy
 * page reads as "98 — you're winning" even when the site is commercially invisible
 * in search. Search Visibility looks at what the domain ACTUALLY ranks for and
 * splits it three ways:
 *   - brand      — the domain's own name ("trustmrr"): visibility you already own.
 *   - category   — real topic searches your buyers make ("startup mrr", "saas revenue").
 *   - off-topic  — everything else you rank for incidentally (other companies'
 *                  brand names on a directory/review/listicle page). For an
 *                  aggregator this is ~90% of the footprint — impressive-looking
 *                  traffic that converts no buyers.
 *
 * The score is deliberately LOW when almost none of your visibility is category
 * search you win at volume — which is the true, honest gap the paid plan closes.
 * Heuristic + tunable (like the on-site score); PURE + unit-tested.
 */

import type { RankedKeyword } from "@/lib/scan/adapters/dataforseo-ranked-keywords";
import { normalizeHost } from "@/lib/scan/referral/classify";
import { brandTokensFor, isBrandKeyword, tokens, GENERIC_TOKENS, STOPWORDS, stem } from "@/lib/scan/referral/brand-keywords";

// Re-exported for existing import sites (`import { stem } from "./search-visibility"`,
// e.g. this file's own test suite) — the canonical definition now lives in
// `referral/brand-keywords.ts` alongside `tokens()`/`GENERIC_TOKENS`, so the
// classifier's vocab-support check AND the tier-grounding overlap check route
// through the SAME stemmer (see that file's doc comment, PR-9 2026-07-20).
export { stem };
import { cachedRankedKeywords, cachedKeywordVolumes, cachedDomainOverview } from "@/lib/scan/cache/cached-adapters";

export type KeywordClass = "brand" | "category" | "offtopic";

export interface ClassifiedKeyword {
  keyword: string;
  position: number;
  volume: number;
  etv: number;
  klass: KeywordClass;
}

export interface CategoryGapRow {
  keyword: string;
  volume: number;
  /** Subject's best position for this category term (they rank, but not winning). */
  yourPosition: number;
}

export interface DemandRow {
  keyword: string;
  volume: number;
  /** The subject's best organic position for this term, when they rank for it at
   *  all (undefined = not ranking). Lets an opportunity show "you're #12 for X"
   *  instead of a bare "not winning" — the meaningful discovery. */
  yourPosition?: number;
}

export interface SearchVisibility {
  /** 0–100 heroable gap metric — how much real category search you actually win.
   *  This is the "search presence" driver of the unified Discoverability Score. */
  score: number;
  /** The "on-page readiness" driver (the 8-signal on-site score) — set by the
   *  caller so the free report can show both halves of the geomean beneath the gauge. */
  onPageReadiness?: number;
  /** TRUE total keywords the domain ranks for (domain_rank_overview) when
   *  `footprintComplete`; otherwise the top-sample count (`ranked_keywords` limit)
   *  as a labelled fallback. It must NEVER be silently the API cap rendered as a
   *  total — that was the shipped lie (resend showed 50, truly ranks for 2,100). */
  keywordsRanked: number;
  /** TRUE total estimated monthly organic visits (Σ etv over ALL keywords) when
   *  `footprintComplete`; otherwise the top-sample sum, labelled. */
  estMonthlyVisits: number;
  /** Whether keywordsRanked/estMonthlyVisits are the TRUE domain totals
   *  (`domain_rank_overview` succeeded) or the top-sample fallback. The renderer
   *  must disclose the sample basis when this is false. */
  footprintComplete: boolean;
  /** Share of estimated traffic by class (0–100, summing ~100). ALWAYS a SAMPLE —
   *  computed over the top ranked_keywords only — so the UI must label it as such. */
  brandPct: number;
  categoryPct: number;
  offTopicPct: number;
  /** Category terms you rank for but aren't winning (pos > 3), by volume — the
   *  honest keyword-gap teaser (no other-brand noise). */
  categoryGap: CategoryGapRow[];
  /** A few high-volume OFF-TOPIC terms, to make the "you rank for other companies'
   *  names" point concrete (e.g. ["spanglish translator", "cometly", "shipfast"]). */
  offTopicExamples: string[];
  /** Count of category terms you already WIN (top 3) — usually small/zero. */
  categoryWins: number;

  // ── Category demand (one extra keyword_ideas call, ~$0.02) — the size of the
  // market you're in and how much of it you actually capture. Works even at 0
  // rankings (seeded from your own vocabulary), so a brand-new site still gets a
  // real "your category gets X searches/mo, you capture 0%" insight.
  /** Total monthly searches across your category (Σ volume of the NAMED category
   *  seed phrases). 0 = unknown. The phrases themselves are `categoryOpportunities`
   *  + `categoryWonKeywords`, so the total is reconcilable by the reader. */
  categoryDemand: number;
  /** High-demand category searches you do NOT win — the real, sizeable opportunity
   *  (bigger than your own tiny rankings; drawn from category demand, not just what
   *  you already rank for). */
  categoryOpportunities: DemandRow[];
  /** EVERY named category seed phrase with its volume — so `categoryDemand` (their
   *  sum) is RECONCILABLE by the reader (guard G4). The old report itemised only the
   *  unwon subset, so "1,250 searches" could never be checked against its parts. */
  categoryPhrases: DemandRow[];
  /** The subject's REAL category rankings — every category term it ranks for
   *  (won + not-won), highest-volume first, with volume + position. Derived from
   *  the SAME `ranked_keywords` call the footprint uses (NO extra data call), so
   *  the category demand can reflect the actual market the site competes in
   *  (SpaceX ranks #12 for "space", 368k/mo) instead of only the LLM's seed
   *  phrases. This is the "reality" half of the scale-invariant demand merge —
   *  it dominates for established sites and is empty for a 0-ranking new site
   *  (which then falls back to the seed volumes). Feeds `categoryPhrases` /
   *  `categoryOpportunities` (both rendered), so it is never write-only. */
  categoryRanked: CategoryGapRow[];
  /** Internal: category terms you already rank top-3 for (dedup for opportunities). */
  categoryWonKeywords: string[];
  /** Task B (2026-07-19, ladder restructure): the market ladder — "this is a
   *  big industry" (BROAD) above the category-demand hero, and a cheap NICHE
   *  rung below it. The MEDIUM rung was dropped entirely: the category-demand
   *  hero (categorySeeds + real rankings, `computeCategoryDemand`) already IS
   *  the tool-category altitude, so a separate medium rung could only
   *  duplicate it (a live scan showed "seo tools" priced in BOTH the medium
   *  rung and the category hero — visibly double-counted). At most
   *  `[broad?, niche?]`: BROAD only renders when its priced demand EXCEEDS the
   *  category demand (an inverted ladder — broad sitting BELOW the category —
   *  is dropped rather than rendered dishonestly); phrases already counted in
   *  the category-demand set (or in NICHE) are excluded from BROAD so no
   *  phrase is ever double-counted across rungs. Additive + absent on legacy
   *  payloads. */
  marketTiers?: MarketTier[];
  // DELETED 2026-07-17 (free-scan honesty): `categoryCaptureRate` was
  // `= sv.score` — the search-presence score rendered a SECOND time under a
  // "you capture X%" label (identical in 10/10 prod scans). A metric may never be
  // an alias of another metric (guard G1). `categoryCapturedSearches` was its
  // internal, unit-incoherent numerator (category ETV vs seed volumes, off by up
  // to 1,308×) and fed nothing external — deleted with it.
}

// STOPWORDS, tokens(), and GENERIC_TOKENS now live in `./referral/brand-keywords`
// (the ONE shared brand/vocab-token module — RC1) and are imported above. They
// used to be defined here; moved so `brandTokensFor`'s subject-name folding
// (used by both this free classifier AND the paid keyword-gap filter) shares
// the exact same tokenizer + generic-word list instead of each engine keeping
// its own copy that can silently drift.

// Ubiquitous other-brands / entities. A mid-market subject ranks for these only
// INCIDENTALLY (x.com ranks #9 for "google"), so they are never its own category:
// a token here is dropped from category vocab unless the LLM seeds used it, and a
// keyword containing one is classified off-topic outright. The corpus guard
// (classification-corpus.test.ts) catches new ones — add them here.
const MEGA_BRAND_TOKENS = new Set([
  "google", "youtube", "youcine", "facebook", "instagram", "twitter", "tiktok", "reddit",
  "twitch", "snapchat", "pinterest", "linkedin", "whatsapp", "telegram", "discord", "tumblr",
  "yahoo", "bing", "amazon", "netflix", "spotify", "hulu", "disney", "paypal", "venmo", "ebay",
  "usps", "ups", "fedex", "irs", "walmart", "target", "costco", "starbucks", "mcdonalds",
  "subway", "dominos", "chipotle", "espn", "cnn", "foxnews", "bbc", "msnbc", "nypost",
  "nytimes", "reuters", "onlyfans", "pornhub", "chaturbate", "wikipedia", "gmail", "outlook",
  "att", "verizon", "chase", "aliexpress", "temu", "shein", "roblox", "minecraft",
]);

/** A token that may not define the subject's category unless the LLM seeds used it. */
function isCategoryPollutant(t: string): boolean {
  return GENERIC_TOKENS.has(t) || MEGA_BRAND_TOKENS.has(t);
}

/** A keyword that IS a ubiquitous other-brand/entity — off-topic outright.
 *  MEGA_BRAND_TOKENS stores multi-word names as ONE concatenated token
 *  ("foxnews", "nypost", "nytimes"), so a single-token check alone can never
 *  match the multi-word phrase real users search ("fox news" tokenizes to
 *  ["fox","news"] — neither token alone is "foxnews"), leaving every
 *  multi-word entry dead. Fix: also join ADJACENT tokens (bigram) and
 *  re-check the concatenation. No trigram join — every current
 *  MEGA_BRAND_TOKENS entry is a single word or a 2-word join, so a 3-word
 *  loop is dead code (YAGNI); add it back only alongside a real 3-word
 *  entity entry + a covering test. Pure, deterministic, self-contained —
 *  retokenizes the raw keyword fresh so it does not depend on the
 *  stopword-filtered `tokens()` used for vocab. */
function isMegaBrandKeyword(keyword: string): boolean {
  const toks = keyword.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  if (toks.some((t) => MEGA_BRAND_TOKENS.has(t))) return true;
  for (let i = 0; i < toks.length - 1; i++) {
    const a = toks[i], b = toks[i + 1];
    if (a && b && MEGA_BRAND_TOKENS.has(a + b)) return true;
  }
  return false;
}

/**
 * Build the brand tokens + category vocabulary that drive classification.
 * - brandTokens: the domain label + its split forms ("trustmrr", "trust", "mrr"…)
 *   so both "trustmrr" and "trust mrr" register as brand.
 * - categoryVocab: the subject's own topic words (from its themes + positioning
 *   prose), MINUS the brand label — so "startup mrr" is category but "cometly"
 *   (which shares nothing with the subject's vocabulary) is off-topic.
 */
export function buildVocab(
  domain: string,
  seedText: string[],
  llmCategorySeeds: string[] = [],
  brandNames: string[] = [],
): { brandTokens: Set<string>; categoryVocab: Set<string> } {
  // Brand tokens come from the ONE shared detector (also used by the paid keyword
  // gap), so a keyword is judged "brand" identically everywhere — no more forked
  // brand logic that can drift between the two engines (RC1). `brandTokensFor`
  // itself folds `brandNames` in (filtering generic words) — this call site does
  // NOT re-implement that loop, so the free classifier and the paid keyword-gap
  // filter (which calls the exact same function with ITS OWN brandNames) can
  // never disagree about what counts as the subject's brand.
  //
  // The subject's REAL name (`facts.listing.name` — the page's own extracted
  // title/product name) matters because the domain label alone is often
  // unusable ("x.com" -> "x", a single character) or simply wrong (a renamed/
  // rebranded product), so a subject whose page yields a real name
  // ("Twitter / X") gets "twitter" recognised as ITS brand, not lost. This ALSO
  // IS the mega-brand exemption (PR-5, Part C class): `classify()` checks brand
  // membership BEFORE the mega-brand check, so any MEGA_BRAND_TOKENS member
  // that is also a subject brand token (e.g. "twitter") is matched here first
  // and never reaches the off-topic mega-brand rule — no separate exemption
  // code path is needed, and none should be added (it would be unreachable
  // given this order — see the "guard honesty" rule in CLAUDE.md).
  const brandTokens = brandTokensFor([domain], brandNames);
  // Distinctive category tokens the LLM's OWN category identification used — the
  // corroboration set. A generic / mega-brand token is allowed to DEFINE the
  // category only if it appears here (so "time" defines a time-tracker but not
  // savvycal, "space" defines SpaceX, and "google" defines no one).
  const seedTokens = new Set<string>();
  for (const s of llmCategorySeeds) for (const t of tokens(s)) if (!brandTokens.has(t)) seedTokens.add(t);
  const categoryVocab = new Set<string>(seedTokens);
  for (const s of seedText) {
    for (const t of tokens(s)) {
      if (brandTokens.has(t)) continue;
      if (isCategoryPollutant(t) && !seedTokens.has(t)) continue; // drop generic / other-brand noise
      categoryVocab.add(t);
    }
  }
  return { brandTokens, categoryVocab };
}

/** A token counts as "vocab-supported" when it (or its stem) is literally in
 *  the subject's category vocabulary, or (or its stem) is the subject's own
 *  brand token. Scans `categoryVocab` for a stem match too, so a seed's plural
 *  ("rockets") corroborates a query's singular ("rocket") and vice versa —
 *  without mutating `categoryVocab` itself (kept exact for the existing
 *  `.has()` unit tests / debug surfaces). */
function isVocabSupported(t: string, brandTokens: Set<string>, categoryVocab: Set<string>): boolean {
  if (categoryVocab.has(t) || brandTokens.has(t)) return true;
  const st = stem(t);
  if (st !== t && (categoryVocab.has(st) || brandTokens.has(st))) return true;
  for (const v of categoryVocab) if (stem(v) === st) return true;
  return false;
}

/**
 * THE MACRO RULE (2026-07-19, Part A2): a keyword classifies CATEGORY only
 * when EVERY non-generic token of the phrase is supported — by the subject's
 * own vocabulary (incl. LLM-seed corroboration) or GENERIC_TOKENS. One
 * unsupported token anywhere forecloses category, structurally — no
 * blocklist entry is needed for the next unlisted entity ("fox news" via a
 * corroborated "news"; "what time is it in hawaii" via a corroborated
 * "time"): the OTHER content word ("fox"/"hawaii") was never actually
 * evidenced as this subject's category, and the old any-shared-token rule
 * let it ride along on one word that was. A keyword whose tokens are ALL
 * merely generic (zero real vocabulary evidence) is also not category — a
 * ubiquitous phrase must not universally match every subject that ranks for it.
 */
function classify(keyword: string, brandTokens: Set<string>, categoryVocab: Set<string>): KeywordClass {
  // Brand via the shared detector (exact-token or distinctive-substring match).
  if (isBrandKeyword(keyword, brandTokens)) return "brand";
  // A ubiquitous other-brand/entity is off-topic outright — a subject ranks for
  // these incidentally, never as its own category (x.com #9 for "google").
  if (isMegaBrandKeyword(keyword)) return "offtopic";
  // Category: EVERY non-generic token must be supported, and at least one must
  // be REAL vocabulary support (not merely generic) — see rule doc above.
  const toks = tokens(keyword); // the same stopword/length normalization buildVocab uses
  if (toks.length === 0) return "offtopic"; // nothing meaningful left to judge
  let anyVocabSupported = false;
  for (const t of toks) {
    const vocabSupported = isVocabSupported(t, brandTokens, categoryVocab);
    if (vocabSupported) { anyVocabSupported = true; continue; }
    const st = stem(t);
    if (GENERIC_TOKENS.has(t) || GENERIC_TOKENS.has(st)) continue; // allowed to ride, but doesn't count as evidence
    return "offtopic"; // an unsupported, non-generic token forecloses category
  }
  return anyVocabSupported ? "category" : "offtopic";
}

// Fix 3 (PR-5): a PRESENTATION rule, not a data rule. `offTopicExamples` picks
// which 3 of N real, honest off-topic keywords to PRINT on the conversion
// surface (a live scan can rank for adult-site terms via MEGA_BRAND_TOKENS
// entries like "pornhub"/"onlyfans"/"chaturbate" — real, true data). The
// underlying klass/percentages are UNCHANGED — this only chooses which
// candidates are fit to display verbatim as quoted examples. If every
// off-topic candidate is denylisted, render none; the warning still stands on
// its percentages alone (never a fabricated substitute example).
const NSFW_EXAMPLE_DENYLIST = new Set([
  "porn", "pornhub", "xxx", "sex", "nude", "naked", "nsfw", "onlyfans", "xvideos",
  "xnxx", "chaturbate", "hentai", "escort", "escorts", "camgirl", "camgirls",
]);

/** True when a keyword contains an NSFW/profane token — excluded from the
 *  PRINTED example list only (see NSFW_EXAMPLE_DENYLIST above). */
function isNsfwExample(keyword: string): boolean {
  const toks = keyword.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  return toks.some((t) => NSFW_EXAMPLE_DENYLIST.has(t));
}

const WINNING_POSITION = 3;
const CATEGORY_GAP_ROWS = 6;
const OFFTOPIC_EXAMPLES = 3;
/** How many of the subject's real category rankings to carry into the demand
 *  merge (won + not-won, highest-volume first). Bounded so the payload stays lean
 *  and a huge footprint can't sum into an incoherent "demand". */
const CATEGORY_RANKED_ROWS = 15;
/** Rough "full marks" target for category strength (≈ this many solid, sizable
 *  category rankings = a healthy category footprint). Tunable. Exported so
 *  WS-C's opportunity actions (fallback-actions.ts) can recompute the same
 *  one-category-win score-model step the search-visibility strength uses. */
export const CATEGORY_TARGET = 6;

/** SERP position → share of clicks captured (a #1 ranking captures ~all its volume,
 *  a #20 almost none). pos1→1, pos21+→0. */
function posQuality(pos: number): number {
  return Math.max(0, Math.min(1, (21 - pos) / 20));
}

/** Per-keyword category strength: volume-weighted (capped) × position quality. */
function categoryContribution(k: ClassifiedKeyword): number {
  return Math.min(1, k.volume / 1000) * posQuality(k.position); // a 1k+/mo term counts fully
}

/**
 * Compute Search Visibility from a domain's ranked keywords + its vocabulary.
 * PURE. Empty input → a zeroed result (caller hides the section).
 */
export function computeSearchVisibility(
  kw: RankedKeyword[],
  vocab: { brandTokens: Set<string>; categoryVocab: Set<string> },
): SearchVisibility {
  const empty: SearchVisibility = {
    score: 0, keywordsRanked: 0, estMonthlyVisits: 0, footprintComplete: false,
    brandPct: 0, categoryPct: 0, offTopicPct: 0,
    categoryGap: [], offTopicExamples: [], categoryWins: 0,
    categoryDemand: 0, categoryOpportunities: [], categoryPhrases: [], categoryRanked: [], categoryWonKeywords: [],
  };
  if (kw.length === 0) return empty;

  // Best position + max volume + summed etv per keyword (a domain ranks several
  // pages for one term).
  const byKw = new Map<string, ClassifiedKeyword>();
  for (const k of kw) {
    if (k.volume <= 0 || k.position <= 0) continue;
    const cur = byKw.get(k.keyword);
    if (!cur) {
      byKw.set(k.keyword, {
        keyword: k.keyword, position: k.position, volume: k.volume, etv: k.etv,
        klass: classify(k.keyword, vocab.brandTokens, vocab.categoryVocab),
      });
    } else {
      cur.volume = Math.max(cur.volume, k.volume);
      if (k.position < cur.position) cur.position = k.position;
      cur.etv += k.etv;
    }
  }
  const rows = [...byKw.values()];
  if (rows.length === 0) return empty;

  const totalEtv = rows.reduce((s, r) => s + r.etv, 0);
  const etvOf = (klass: KeywordClass) => rows.filter((r) => r.klass === klass).reduce((s, r) => s + r.etv, 0);
  const pct = (n: number) => (totalEtv > 0 ? Math.round((n / totalEtv) * 100) : 0);

  const category = rows.filter((r) => r.klass === "category");
  const strength = category.reduce((s, r) => s + categoryContribution(r), 0);
  const score = Math.round(100 * Math.min(1, strength / CATEGORY_TARGET));

  const categoryWonKeywords = category.filter((r) => r.position <= WINNING_POSITION).map((r) => r.keyword.toLowerCase());

  const categoryGap = category
    .filter((r) => r.position > WINNING_POSITION)
    .sort((a, b) => b.volume - a.volume)
    .slice(0, CATEGORY_GAP_ROWS)
    .map((r) => ({ keyword: r.keyword, volume: r.volume, yourPosition: r.position }));

  // The subject's REAL category rankings (won + not-won), highest-volume first —
  // the "reality" input to the scale-invariant demand merge (gather). Derived
  // from the same classified rows as the score; adding it does NOT touch `score`.
  const categoryRanked = category
    .slice()
    .sort((a, b) => b.volume - a.volume)
    .slice(0, CATEGORY_RANKED_ROWS)
    .map((r) => ({ keyword: r.keyword.toLowerCase(), volume: r.volume, yourPosition: r.position }));

  const offTopicExamples = rows
    .filter((r) => r.klass === "offtopic" && !isNsfwExample(r.keyword))
    .sort((a, b) => b.volume - a.volume)
    .slice(0, OFFTOPIC_EXAMPLES)
    .map((r) => r.keyword);

  return {
    score,
    // SAMPLE totals — computeSearchVisibility only sees the top ranked_keywords.
    // gatherFreeSearchVisibility overrides these with the TRUE domain totals when
    // domain_rank_overview succeeds (and sets footprintComplete). Standalone/tests
    // get the honest sample with footprintComplete:false.
    keywordsRanked: rows.length,
    estMonthlyVisits: Math.round(totalEtv),
    footprintComplete: false,
    brandPct: pct(etvOf("brand")),
    categoryPct: pct(etvOf("category")),
    offTopicPct: pct(etvOf("offtopic")),
    categoryGap,
    offTopicExamples,
    categoryWins: category.filter((r) => r.position <= WINNING_POSITION).length,
    categoryRanked,
    // Category-demand fields are filled by the gather (needs the keyword_ideas call);
    // defaults here keep computeSearchVisibility pure + usable stand-alone.
    categoryDemand: 0,
    categoryOpportunities: [],
    categoryPhrases: [],
    categoryWonKeywords,
  };
}

const EMPTY: SearchVisibility = {
  score: 0, keywordsRanked: 0, estMonthlyVisits: 0, footprintComplete: false,
  brandPct: 0, categoryPct: 0, offTopicPct: 0,
  categoryGap: [], offTopicExamples: [], categoryWins: 0,
  categoryDemand: 0, categoryOpportunities: [], categoryPhrases: [], categoryRanked: [], categoryWonKeywords: [],
};

const isSpecificSeed = (s: string) => s.includes(" ") || s.replace(/[^a-z0-9]/g, "").length >= 5;

/** Seeds for the keyword_ideas call. PREFER the LLM-authored category phrases (the
 *  site's REAL market, e.g. "buy saas business") — they're specific, multi-word, and
 *  work even at zero rankings. Fall back to the subject's own category-ranked phrases
 *  only when the LLM gave none. We never seed from single broad vocabulary tokens
 *  ("revenue", "saas"): keyword_ideas expands those into unrelated high-volume noise
 *  ("walmart revenue"), which would fabricate demand. */
export function buildCategorySeeds(sv: SearchVisibility, llmSeeds: string[]): string[] {
  const llm = llmSeeds.map((s) => s.trim().toLowerCase()).filter(isSpecificSeed);
  if (llm.length > 0) return [...new Set(llm)].slice(0, 8);
  const seeds = new Set<string>();
  for (const g of sv.categoryGap) seeds.add(g.keyword.toLowerCase());
  for (const w of sv.categoryWonKeywords) seeds.add(w);
  return [...seeds].filter(isSpecificSeed).slice(0, 10);
}

const OPPORTUNITY_ROWS = 6;
/** How many merged category terms define the demand total + itemised phrases.
 *  Bounded so an established site's huge footprint sums into a coherent headline
 *  (the top of the category), and so `categoryDemand === Σ categoryPhrases`
 *  reconciles against a readable list (G4). */
const CATEGORY_DEMAND_ROWS = 8;

/**
 * Category demand — the size of the market the subject competes in — built by
 * MERGING two sources we ALREADY have (no extra data call):
 *   1. `categoryRanked` — the subject's REAL category rankings (volume + position),
 *      classified from the one `ranked_keywords` call. This is the reality that
 *      dominates for an established site (SpaceX ranks #12 for "space", 368k/mo).
 *   2. `seedVolumes` — the EXACT volumes of the LLM's category seed phrases (via
 *      google_ads/search_volume, no keyword_ideas expansion → no off-topic noise).
 *      This is the framing that WORKS AT ZERO RANKINGS, so a brand-new site still
 *      gets a real "your category gets X searches/mo" insight.
 * ONE scale-invariant rule: dedup by keyword (max volume, best known position),
 * rank by volume, take the top N. A big site's real rankings dominate the merge;
 * a 0-ranking site falls back to the seeds — no big-vs-small special case. Fixes
 * the SpaceX class where the demand was Σ(2 narrow LLM seeds) = 8,170 while the
 * site actually ranks in a category worth hundreds of thousands of searches/mo.
 * `position` (from the ranked data or `rankByKeyword`) rides through so an
 * opportunity can render "you're #12 for X", the meaningful discovery.
 */
export function computeCategoryDemand(
  seedVolumes: Array<{ keyword: string; volume: number }>,
  rankByKeyword: Map<string, number>,
  categoryRanked: DemandRow[] = [],
): Pick<SearchVisibility, "categoryDemand" | "categoryOpportunities" | "categoryPhrases"> {
  const byKw = new Map<string, { keyword: string; volume: number; position?: number }>();
  const add = (rawKeyword: string, volume: number, position?: number) => {
    if (volume <= 0) return;
    const keyword = rawKeyword.toLowerCase();
    const pos = position ?? rankByKeyword.get(keyword);
    const cur = byKw.get(keyword);
    if (!cur) {
      byKw.set(keyword, { keyword, volume, position: pos });
    } else {
      cur.volume = Math.max(cur.volume, volume);
      if (pos !== undefined && (cur.position === undefined || pos < cur.position)) cur.position = pos;
    }
  };
  // Reality first (carries position), then the LLM seeds fill in / cover zero-rank sites.
  for (const r of categoryRanked) add(r.keyword, r.volume, r.yourPosition);
  for (const r of seedVolumes) add(r.keyword, r.volume);

  const rows = [...byKw.values()].sort((a, b) => b.volume - a.volume).slice(0, CATEGORY_DEMAND_ROWS);
  const categoryDemand = rows.reduce((s, r) => s + r.volume, 0);
  // Opportunities = the demand you are NOT already winning (not ranked top 3, or
  // not ranking at all), highest-volume first — now the site's genuine big
  // near-misses, not just the seed phrases. (No captureRate — it was the score
  // under a second label; deleted, guard G1.)
  const categoryOpportunities = rows
    .filter((r) => r.position === undefined || r.position > WINNING_POSITION)
    .slice(0, OPPORTUNITY_ROWS)
    .map((r) => ({ keyword: r.keyword, volume: r.volume, yourPosition: r.position }));
  // G4: itemise EXACTLY the rows summed into the total, so categoryDemand === Σ
  // categoryPhrases — the reader can reconcile the headline against its named parts.
  const categoryPhrases = rows.map((r) => ({ keyword: r.keyword, volume: r.volume, yourPosition: r.position }));
  return { categoryDemand, categoryOpportunities, categoryPhrases };
}

export interface MarketTier {
  tier: "broad" | "niche";
  phrases: DemandRow[];
  demand: number;
  bestPosition: number | null;
}

/**
 * PR-8 (2026-07-20, the trustmrr "business intelligence platforms" class): the
 * non-generic token vocabulary of the subject's REAL in-category rankings
 * (`categoryRanked` — classified from the SAME `ranked_keywords` call the
 * footprint uses, never the LLM's tier-seed guesses). This is the corroboration
 * set a tier phrase must share a token with to be treated as evidenced. Reuses
 * the ONE shared `tokens()` + `GENERIC_TOKENS` from `./referral/brand-keywords`
 * (RC1) — no forked tokenizer/generic-list for this third grounding site.
 *
 * PR-9 (2026-07-20, the "platform"/"platforms" class): tokens are STEMMED
 * before the generic-check AND before entering the set. Un-stemmed, a plural
 * generic word ("platforms") that isn't ALSO separately listed in
 * `GENERIC_TOKENS` (which only lists "platform") sailed through as if it were
 * real vocabulary evidence — the same bug as `isTierPhraseGrounded` below, and
 * the fix is the same one function shared with the classifier's
 * `isVocabSupported`, not a second wordlist entry that only fixes THIS plural
 * and leaves the next one (gerund, another plural) still exploitable.
 */
function groundedCategoryTokens(categoryRanked: DemandRow[]): Set<string> {
  const set = new Set<string>();
  for (const r of categoryRanked) {
    for (const t of tokens(r.keyword)) {
      const st = stem(t);
      if (GENERIC_TOKENS.has(st)) continue; // a generic word (or its stem) alone proves nothing
      set.add(st);
    }
  }
  return set;
}

/** A tier phrase is grounded iff the subject ranks for it EXACTLY, or it shares
 *  ≥1 non-generic (STEMMED — PR-9) token with the subject's real in-category
 *  rankings. Ungrounded = an LLM guess with no ranking evidence — dropped
 *  (degrade, never invent). Both sides of the overlap compare STEMMED tokens
 *  (see `groundedCategoryTokens`), so "platforms" (this phrase) and "platform"
 *  (a generic vocabulary word) collapse to the SAME generic stem and neither
 *  can pass the other off as real category evidence — structural, not a
 *  singular/plural pair someone has to remember to add to `GENERIC_TOKENS`. */
function isTierPhraseGrounded(
  phrase: string,
  groundedTokens: Set<string>,
  rankByKeyword: Map<string, number>,
): boolean {
  const keyword = phrase.toLowerCase().trim();
  if (rankByKeyword.has(keyword)) return true; // the subject ranks for this exact phrase
  for (const t of tokens(phrase)) {
    const st = stem(t);
    if (GENERIC_TOKENS.has(st)) continue;
    if (groundedTokens.has(st)) return true;
  }
  return false;
}

/** Exported so the gather can apply the SAME grounding rule BEFORE the volumes
 *  request — pricing (and therefore paying for) only phrases that already pass
 *  token-corroboration against `categoryRanked` ("never pay for data you don't
 *  render", per-field). `computeMarketTiers` re-applies the identical filter
 *  internally so it stays correct as a pure, standalone function (unit-tested
 *  directly with raw ungrounded seeds) — the two calls are redundant by design,
 *  not duplicated logic (both route through this one function). */
export function groundTierSeeds(
  seeds: string[],
  categoryRanked: DemandRow[],
  rankByKeyword: Map<string, number>,
): string[] {
  if (categoryRanked.length === 0) return []; // no ranking evidence of the subject's market at all
  const groundedTokens = groundedCategoryTokens(categoryRanked);
  return seeds.filter((s) => isTierPhraseGrounded(s, groundedTokens, rankByKeyword));
}

/**
 * Task B (2026-07-19, ladder restructure — data-grounded rungs, not synonym
 * labels): priced from the SAME single search_volume request as the category
 * seeds (the tier phrases are merged into that one call's keyword list;
 * request-billed, so phrase count is cost-free). The MEDIUM rung is dropped
 * entirely — the medium rung is no longer generated, parsed, or accepted
 * anywhere in the pipeline ("never pay for data you don't render", per-field).
 * At most `[broad?, niche?]`:
 *
 *   - **Grounding (PR-8, 2026-07-20)**: a phrase renders only when it is
 *     CORROBORATED by the subject's real rankings — it ranks for the exact
 *     phrase, or shares ≥1 non-generic token with a `categoryRanked` keyword
 *     (real classified-category rankings, NOT the LLM's tier-seed guess). This
 *     is the trustmrr class: "business intelligence platforms" priced to a
 *     REAL 880/mo but trustmrr neither ranks for it nor shares a token with its
 *     real category (mrr/startup/app/revenue) — real number, fabricated
 *     relevance. When `categoryRanked` is EMPTY (no real in-category rankings
 *     at all), the whole ladder is omitted — we have no ranking evidence of
 *     the subject's market, so we assert none (degrade, never invent).
 *   - **Cross-rung dedup**: a phrase already in the CATEGORY phrase set
 *     (`categoryPhrases`, lowercased) is excluded from BOTH broad and niche —
 *     it's already counted in the category-demand hero, so a rung must not
 *     re-render it (a live scan showed "seo tools" priced in a rung AND the
 *     hero, visibly double-counted). A phrase seeded in BOTH broad and niche
 *     keeps NICHE only (niche priced first; broad's price excludes niche's
 *     own keywords).
 *   - **Inversion guard**: BROAD only renders when its priced demand STRICTLY
 *     EXCEEDS `categoryDemand` — an inverted ladder (a "broad" rung sized
 *     below the category it's supposed to sit above — a live scan showed
 *     broad 5,200 ≤ category 112,420) is dropped rather than rendered
 *     dishonestly (degrade, never invent a false hierarchy).
 *   - **Niche rung**: renders whenever ≥1 phrase prices > 0 after dedup — no
 *     further gate (it's a cheap, additional rung, not claimed "biggest").
 *
 * Standing per rung comes only from the real rank map (the one
 * ranked_keywords call) — never invented. Feeds NOTHING into sv.score
 * (invariant #1).
 */
export function computeMarketTiers(
  tierSeeds: { broad: string[]; niche: string[] },
  volumesByKeyword: Map<string, number>,
  rankByKeyword: Map<string, number>,
  categoryPhrases: DemandRow[] = [],
  categoryDemand: number = 0,
  categoryRanked: DemandRow[] = [],
): MarketTier[] {
  // No real in-category rankings at all -> no evidence of the subject's market,
  // so no broad/niche ladder is asserted (degrade, never invent).
  if (categoryRanked.length === 0) return [];
  const groundedTokens = groundedCategoryTokens(categoryRanked);

  const price = (seeds: string[], exclude: Set<string>) => {
    const seen = new Set<string>();
    const phrases: DemandRow[] = [];
    for (const raw of seeds) {
      const keyword = raw.toLowerCase().trim();
      if (!keyword || seen.has(keyword) || exclude.has(keyword)) continue;
      seen.add(keyword);
      if (!isTierPhraseGrounded(keyword, groundedTokens, rankByKeyword)) continue; // ungrounded — an LLM guess with no ranking evidence
      const volume = volumesByKeyword.get(keyword) ?? 0;
      if (volume <= 0) continue;
      phrases.push({ keyword, volume, yourPosition: rankByKeyword.get(keyword) });
    }
    phrases.sort((a, b) => b.volume - a.volume);
    const positions = phrases.map((p) => p.yourPosition).filter((p): p is number => typeof p === "number");
    return {
      phrases,
      demand: phrases.reduce((s, p) => s + p.volume, 0), // G4-per-tier by construction
      bestPosition: positions.length ? Math.min(...positions) : null,
    };
  };

  const categorySet = new Set(categoryPhrases.map((p) => p.keyword.toLowerCase().trim()));
  // Niche priced FIRST (excluding only the category set) so a phrase seeded in
  // both broad and niche is resolved in niche's favour; broad then excludes
  // both the category set AND niche's own priced keywords.
  const nicheResult = price(tierSeeds.niche, categorySet);
  const broadExclude = new Set([...categorySet, ...nicheResult.phrases.map((p) => p.keyword)]);
  const broadResult = price(tierSeeds.broad, broadExclude);

  const tiers: MarketTier[] = [];
  if (broadResult.phrases.length > 0 && broadResult.demand > categoryDemand) {
    tiers.push({ tier: "broad", ...broadResult });
  }
  if (nicheResult.phrases.length > 0) {
    tiers.push({ tier: "niche", ...nicheResult });
  }
  return tiers;
}

/**
 * Free-scan gather: ONE `ranked_keywords` call (your footprint) + ONE `keyword_ideas`
 * call (your category's total demand) → Search Visibility. `seedText` is the subject's
 * own vocabulary (themes + positioning prose) — used both to tell category searches
 * from other-brand noise AND to seed the demand read. Crucially, it still fetches
 * category demand when the site ranks for NOTHING, so a brand-new site gets a real
 * "your category gets X searches/mo, you capture 0%" insight instead of a blank.
 * Fixtures-safe (adapters → [] → zeroed) and best-effort (never throws).
 */
/**
 * The ONE classification path: (identity + vocab sources + ranked keywords) →
 * the brand/category/off-topic split. Shared by the live gather AND the
 * calibration corpus guard (`classification-corpus.test.ts`) so what CI asserts
 * on real captured footprints is EXACTLY what production runs — no forked replica
 * (RC1 discipline). Pure. The gather layers the true-total override + demand merge
 * on top of this.
 */
export function classifyFootprint(
  rawSelf: string,
  seedText: string[],
  llmCategorySeeds: string[],
  kw: RankedKeyword[],
  brandNames: string[] = [],
): SearchVisibility {
  const self = normalizeHost(rawSelf);
  // buildVocab now takes the LLM seeds directly: it folds their tokens into the
  // category vocabulary AND uses them as the corroboration set that lets a generic
  // / mega-brand token define the category only when the LLM actually named it.
  // `brandNames` (facts.listing.name — the subject's REAL captured name) joins
  // the brand vocabulary too, so a rebranded/mismatched-domain subject (x.com's
  // real brand is "twitter", not the unusable domain label "x") is recognised.
  const vocab = buildVocab(self, seedText, llmCategorySeeds, brandNames);
  return computeSearchVisibility(kw, vocab);
}

export async function gatherFreeSearchVisibility(
  rawSelf: string,
  seedText: string[],
  llmCategorySeeds: string[] = [],
  tierSeeds?: { broad: string[]; niche: string[] },
  /** The subject's REAL name(s) — `facts.listing.name` — threaded through so the
   *  brand vocabulary is not limited to the domain label alone (PR-5, the
   *  brand≠domain class: "x.com" -> unusable "x", real brand "twitter" unrecognised
   *  and mistaken for "other companies' names"). Zero new calls — deterministic. */
  brandNames: string[] = [],
): Promise<SearchVisibility> {
  try {
    const self = normalizeHost(rawSelf);
    // The top ranked_keywords sample (for the brand/category/off-topic split) AND
    // the TRUE domain totals (domain_rank_overview, +~1.2¢) in parallel. The sample
    // powers classification; the overview gives the honest keywordsRanked/ETV that
    // replace the capped-50 lie.
    const [kw, overview] = await Promise.all([
      cachedRankedKeywords(self, 50).catch(() => [] as RankedKeyword[]),
      cachedDomainOverview(self).catch(() => null),
    ]);
    // Classify via the ONE shared path (also exercised by the corpus guard).
    const sv = classifyFootprint(rawSelf, seedText, llmCategorySeeds, kw, brandNames);
    // Override the SAMPLE totals with the TRUE domain totals when available.
    if (overview) {
      sv.keywordsRanked = overview.organicKeywords;
      sv.estMonthlyVisits = Math.round(overview.organicEtv);
      sv.footprintComplete = true;
    }
    // Best position the subject holds per keyword — used to tell which category seeds
    // it already wins vs which are open opportunities.
    const rankByKeyword = new Map<string, number>();
    for (const k of kw) {
      if (k.position <= 0) continue;
      const key = k.keyword.toLowerCase();
      const cur = rankByKeyword.get(key);
      if (cur === undefined || k.position < cur) rankByKeyword.set(key, k.position);
    }
    const seeds = buildCategorySeeds(sv, llmCategorySeeds);
    // PR-8 (2026-07-20): ground the tier phrases BEFORE they're priced — only a
    // phrase corroborated by the subject's REAL category rankings (`sv.categoryRanked`,
    // available here at zero extra cost) is worth a volume lookup at all. An
    // ungrounded LLM guess ("business intelligence platforms" for trustmrr) is
    // dropped here, not fetched then discarded — "never pay for data you don't
    // render", per-field. `computeMarketTiers` re-applies the identical rule so it
    // stays correct standalone; this pre-filter only saves the wasted fetch.
    const groundedTierSeeds = tierSeeds
      ? {
          broad: groundTierSeeds(tierSeeds.broad, sv.categoryRanked, rankByKeyword),
          niche: groundTierSeeds(tierSeeds.niche, sv.categoryRanked, rankByKeyword),
        }
      : undefined;
    // ONE volumes request prices the category seeds AND the ladder's BROAD +
    // NICHE tier phrases (request-billed — merging keywords adds no cost and no
    // latency). MEDIUM is dropped from the ladder entirely (never priced, never
    // sent here) — "never pay for data you don't render", per-field.
    const tierPhrases = groundedTierSeeds ? [...groundedTierSeeds.broad, ...groundedTierSeeds.niche] : [];
    const allSeeds = [...new Set([...seeds, ...tierPhrases.map((s) => s.toLowerCase().trim())].filter(Boolean))].slice(0, 16);
    const seedVolumes = allSeeds.length > 0 ? await cachedKeywordVolumes(allSeeds).catch(() => []) : [];
    const volumesByKeyword = new Map(seedVolumes.map((r) => [r.keyword.toLowerCase(), r.volume]));
    // Demand hero (category rung): UNCHANGED — only the ORIGINAL category seeds
    // feed it, so the persisted demand story doesn't move under the ladder.
    const catVolumes = seedVolumes.filter((r) => seeds.includes(r.keyword.toLowerCase()));
    // Merge the site's REAL category rankings (sv.categoryRanked — from the SAME
    // ranked_keywords call, no extra spend) with the seed volumes, so demand +
    // opportunities reflect the actual market for big AND small sites alike.
    const demand = computeCategoryDemand(catVolumes, rankByKeyword, sv.categoryRanked);
    // computeMarketTiers runs AFTER computeCategoryDemand — the dedup + inversion
    // guard need the category phrase set + demand total it just produced. Pass
    // the ALREADY-GROUNDED seeds (pre-filtered above, pre-fetch) plus
    // sv.categoryRanked so the pure function's own grounding check is a no-op
    // here (defense-in-depth) rather than a second live filter.
    const marketTiers = groundedTierSeeds
      ? computeMarketTiers(groundedTierSeeds, volumesByKeyword, rankByKeyword, demand.categoryPhrases, demand.categoryDemand, sv.categoryRanked)
      : undefined;
    return { ...sv, ...demand, ...(marketTiers && marketTiers.length > 0 ? { marketTiers } : {}) };
  } catch {
    return EMPTY;
  }
}

/**
 * L1 overlap: warm the DOMAIN-ONLY footprint cache (`ranked_keywords` +
 * `domain_overview`) so a LATER `gatherFreeSearchVisibility` (the free-report
 * step) — or the deep pass — reads a cache HIT instead of re-fetching. Called
 * CONCURRENTLY with the LLM findings stage, so the ~3–13s DataForSEO tail
 * overlaps synth instead of running serially after it. Uses the SAME keys as the
 * gather (`normalizeHost` + limit 50) so the later call actually hits.
 *
 * Cost-neutral: the calls happen once and are cached; nothing new is fetched
 * (the free-report / deep pass would have made these exact calls anyway).
 * Best-effort: NEVER throws — a warm failure just means the later call re-fetches
 * (no worse than today). `keyword_volumes` is NOT warmed here (it needs the
 * synth's `categorySeeds`, which don't exist yet at findings time).
 */
export async function warmFootprintCache(rawSelf: string): Promise<void> {
  try {
    const self = normalizeHost(rawSelf);
    await Promise.allSettled([cachedRankedKeywords(self, 50), cachedDomainOverview(self)]);
  } catch {
    // best-effort — the gather re-fetches on a miss
  }
}
