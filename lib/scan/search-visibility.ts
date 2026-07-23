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
import type { CategoryNicheSeeds } from "@/lib/llm/types";
import { judgeRelevance, type RelevanceVerdicts } from "@/lib/scan/relevance-judge";
import { normalizeHost } from "@/lib/scan/referral/classify";
import { brandTokensFor, isBrandKeyword, tokens, GENERIC_TOKENS, STOPWORDS, stem } from "@/lib/scan/referral/brand-keywords";
import { isAggregatorHost } from "@/lib/scan/competitor-filter";

// Re-exported for existing import sites (`import { stem } from "./search-visibility"`,
// e.g. this file's own test suite) — the canonical definition now lives in
// `referral/brand-keywords.ts` alongside `tokens()`/`GENERIC_TOKENS`, so the
// classifier's vocab-support check AND the tier-grounding overlap check route
// through the SAME stemmer (see that file's doc comment, PR-9 2026-07-20).
export { stem };
import { cachedRankedKeywords, cachedKeywordVolumes, cachedDomainOverview } from "@/lib/scan/cache/cached-adapters";

// D3 (2026-07-20, data board P1): AGGREGATED joins the split as a first-class
// footprint dimension — a distinct THIRD-PARTY ENTITY (company/product/person)
// name the domain ranks for, the directory/aggregator tell (trustmrr ranks for
// the startups it lists; getapp for the software it lists). It is peeled OUT
// of the old `offtopic` bucket (which stays the enum name for the RESIDUAL
// "noise" — genuinely unrelated keywords — to avoid a repo-wide rename churn;
// see the doc comment on `entityListingTemplates` for the naming call). A
// normal SaaS's `aggregated` share is ≈0; a directory's is the bulk of its
// footprint. Detected by a BATCH pass over all rows' URLs in
// `computeSearchVisibility` (see `entityListingTemplates`) — never inside the
// per-keyword `classify()`, which only sees one keyword string at a time and
// cannot see the repeated URL shape that is the actual evidence. P1 review
// fix (2026-07-20): the URL template alone is NOT sufficient — a blog/docs
// section (`/blog/<slug>`, distinct slugs, N_TEMPLATE+ rows) has the same
// structural shape as a directory listing. A row also needs to be
// ENTITY-shaped (see `isEntityShapedKeyword`) — a short name, not a
// topic/question/comparison headline — before it moves out of `offtopic`.
export type KeywordClass = "brand" | "category" | "aggregated" | "offtopic";

export interface ClassifiedKeyword {
  keyword: string;
  position: number;
  volume: number;
  etv: number;
  klass: KeywordClass;
  /** The ranking page URL for this keyword (RankedKeyword.url) — carried
   *  through so the D3 batch pass can detect a repeated per-entity URL
   *  template (`/startup/<slug>`) across ALL rows. "" when unknown (a
   *  classification-corpus fixture that predates this field, or a
   *  synthetic/test row) — `pathContainer` treats "" as "no template",
   *  never a false match. */
  url: string;
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
  /** D3 (2026-07-20, data board P1): share of estimated traffic on THIRD-PARTY
   *  ENTITY pages — directory/aggregator listings (other companies'/products'/
   *  people's names), detected by a repeated per-entity URL template (e.g.
   *  `/startup/<slug>`, `/<category>/a/<slug>`). A normal SaaS ≈ 0%; a
   *  directory ≈ 90%. Peeled OUT of the `offtopic` bucket below (which is now
   *  the genuine-noise RESIDUAL, not "everything that isn't brand/category")
   *  so a directory's real footprint reads as "your aggregation engine", not
   *  a scolding "off-topic leakage" — the mis-framing D3 fixes. Never moves
   *  brand/category rows, so `categoryPct` (and therefore `sv.score`, computed
   *  from category rows only) is unaffected by this split (invariant #1).
   *  Data-only this phase — the render strip lands in P3. */
  aggregatedPct: number;
  offTopicPct: number;
  /** Category terms you rank for but aren't winning (pos > 3), by volume — the
   *  honest keyword-gap teaser (no other-brand noise). */
  categoryGap: CategoryGapRow[];
  /** A few high-volume terms in the RESIDUAL "noise" bucket — genuinely
   *  unrelated keywords, now that D3 (2026-07-20) peels directory-listing
   *  entity names out into `aggregatedExamples` below (they used to be the
   *  "spanglish translator"/"cometly" examples here — those are directory
   *  listings, not off-topic noise). */
  offTopicExamples: string[];
  /** D3: a few named THIRD-PARTY ENTITY examples (the things your directory/
   *  aggregator lists, e.g. ["cometly", "trimrx", "spanglish translator"]) —
   *  sampled from the `aggregated` bucket, the evidence for P3's aggregation
   *  strip. Data-only this phase; not rendered yet. */
  aggregatedExamples: string[];
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
  /** P2 (2026-07-20, data board): the CATEGORY card — the broad industry
   *  umbrella, LADDERED UP to a large, grounded number when the LLM's own
   *  head phrases price too small (D2, Tim's rule: a small category is a
   *  too-narrow definition, not an honest result — never fabricated, see
   *  `computeCategoryLadder`). Data-only this phase (P3 renders it); optional
   *  — absent when the synth gave no `categoryNiche` seed (legacy payload or
   *  a synth that degraded before producing labels). */
  categoryCard?: CategoryLadderCard;
  /** P2: the NICHE card — the specific sub-space, NICHE ⊆ CATEGORY by
   *  construction (every phrase shares a non-generic token with the
   *  category's own vocabulary). May be, and often is, small — never
   *  laddered. Data-only this phase; optional, same absence rule as
   *  `categoryCard`. */
  nicheCard?: CategoryLadderCard;
  /** Phase A (2026-07-21, market model): the leader domain the CATEGORY market
   *  was sized from, when `categoryCard` came from a category leader's footprint
   *  rather than the subject's own ladder. Rendered as provenance ("market sized
   *  from ahrefs.com's rankings"). Absent when no leader resolved (the card fell
   *  back to the subject-grounded ladder — R-3.15 degrade path). */
  categoryLeader?: string;
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
/** Shared example-list cap for BOTH `offTopicExamples` (residual noise) and
 *  `aggregatedExamples` (D3) — one constant, one meaning ("how many named
 *  examples to print per bucket"), no drift between the two buckets. */
const OFFTOPIC_EXAMPLES = 3;

/**
 * D3 (2026-07-20, data board P1): an "entity-listing template" — a repeated
 * per-entity URL shape — needs at least this many rankings sharing it, AND at
 * least this many of them on DISTINCT entity slugs, before it counts as a
 * directory tell. Below this bar it's just a couple of pages that happen to
 * share a URL segment, not a listing. One threshold reused for BOTH
 * conditions (row count AND distinct-slug count) — see
 * `entityListingTemplates` for the two real false-positive shapes this
 * rejects (savvycal's repeated single timezone page; SpaceX's own two
 * products under `/vehicles/<slug>`).
 */
export const N_TEMPLATE = 4;

/**
 * D3: the per-entity URL "container" segment — the directory tell. A listing
 * URL is shaped `.../<container>/<entity-slug>` where `<container>` repeats
 * across many rankings and `<entity-slug>` is different each time: trustmrr
 * `/startup/cometly`, `/startup/trimrx`; getapp
 * `/government-social-services-software/a/amcs/`,
 * `/recreation-wellness-software/a/sports-connect/`. The container is the
 * SECOND-TO-LAST path segment, not the first — getapp's category segment
 * (ahead of the constant "a") varies per row, so a first-segment rule would
 * miss its shape entirely; second-to-last generalizes cleanly to both real
 * shapes (verified against live-captured trustmrr.com / getapp.com
 * `ranked_keywords`, task-P1). `null` when the URL has fewer than 2 path
 * segments (a homepage, or a single-segment page like a Twitter/X profile
 * `x.com/FoxNews`) or isn't a parseable absolute URL — there is no container
 * to detect, never a false match.
 */
function pathContainer(url: string): { container: string; slug: string } | null {
  if (!url) return null;
  let pathname: string;
  try {
    pathname = new URL(url).pathname;
  } catch {
    return null;
  }
  const segs = pathname.split("/").filter(Boolean);
  if (segs.length < 2) return null;
  const container = segs[segs.length - 2]!.toLowerCase();
  const slug = segs[segs.length - 1]!.toLowerCase();
  return { container, slug };
}

/**
 * P1 review fix (2026-07-20, the blog/docs false-positive class): topic/
 * question/comparison/listicle markers. A phrase carrying ANY of these is a
 * TOPIC headline ("how to make sourdough bread", "best hiking boots 2026"),
 * never a directory-listing ENTITY name — checked against the RAW tokens
 * (before `tokens()`'s stopword filter), because several of these words
 * ("how", "why", "what", "who", "best", "top", "vs", "review", "to") are
 * THEMSELVES stopwords/generic and would otherwise vanish before this check
 * ever saw them.
 */
const TOPIC_MARKER_TOKENS = new Set([
  "how", "what", "why", "when", "where", "who", "best", "top", "vs", "versus",
  "guide", "tutorial", "review", "reviews", "ideas", "tips", "to",
]);

/**
 * P1 review fix (2026-07-20): live-verified false positive — a normal SaaS
 * with ≥4 off-topic `/blog/<slug>` posts (distinct slugs) cleared the OLD
 * purely-structural `entityListingTemplates` bar and got reclassified
 * `aggregated`, so a blog post title ("how to make sourdough bread") rendered
 * as a "directory listing". The URL-template signal alone can't tell "a
 * directory of THIRD-PARTY ENTITIES" from "our own /blog section ranking for
 * TOPICS" — both are N_TEMPLATE+ rows on a repeated 2-segment container with
 * distinct slugs. This is the SECOND, REQUIRED signal: the ranked keyword
 * itself must be ENTITY-shaped (a company/product/person NAME), not a
 * natural-language TOPIC phrase. A row is `aggregated` only when BOTH the URL
 * template AND this keyword shape agree (see the D3 batch pass below) — this
 * ALSO re-protects x.com belt-and-braces (its mega-brand hits aren't on a
 * listing template at all, so signal (a) already fails there; the AND makes
 * the guarantee robust rather than accidental).
 *
 * ENTITY: short (≤3 meaningful tokens), carries no `TOPIC_MARKER_TOKENS`
 * word, and is not majority generic vocabulary (`GENERIC_TOKENS`) — "cometly",
 * "spanglish translator", "notion", "career hound", "sign up genius".
 * TOPIC (stays noise, never aggregated): "how to make sourdough bread",
 * "best hiking boots 2026", "remote work burnout signs" (4 meaningful
 * tokens — too long to be a name), "calendar scheduling guide" (carries the
 * "guide" marker). Pure, deterministic — reuses the ONE shared tokenizer +
 * generic-word list (RC1), no forked vocabulary logic.
 */
function isEntityShapedKeyword(keyword: string): boolean {
  const rawTokens = keyword.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  if (rawTokens.length === 0) return false;
  if (rawTokens.some((t) => TOPIC_MARKER_TOKENS.has(t))) return false; // topic/question/comparison/listicle marker
  const meaningful = tokens(keyword); // the shared stopword-filtered tokenizer
  if (meaningful.length === 0 || meaningful.length > 3) return false; // too long to be a name
  const genericCount = meaningful.filter((t) => GENERIC_TOKENS.has(t)).length;
  if (genericCount * 2 > meaningful.length) return false; // majority generic vocabulary, not a distinctive name
  return true;
}

/**
 * D3 batch pass (needs ALL rows' URLs at once, so it runs in
 * `computeSearchVisibility` AFTER per-keyword `classify()`, never inside it):
 * which URL containers are genuine entity-listing templates. This is the
 * PREFERRED, robust signal — a structural fact about the URL space, not a
 * guess about keyword shape. (A keyword-shape-only signal — "this looks like
 * a company name" — was evaluated and REJECTED for this phase: x.com's
 * incidental mega-brand hits, "google"/"foxnews"/"espn", are exactly
 * proper-name-shaped keywords, but x.com is not a directory of them — it's a
 * giant platform that ranks for them incidentally. A keyword-shape rule alone
 * cannot tell "directory of entities" apart from "big platform, noisy
 * footprint"; the URL structure can, because x.com's real ranking pages are
 * single-segment profile URLs (`x.com/FoxNews`) with no repeated 2+-segment
 * container at all — verified against x.com's live-captured `ranked_keywords`.
 * See task-P1-report.md for the corpus evidence.)
 *
 * A container qualifies only when BOTH hold: ≥N_TEMPLATE rows share it, AND
 * ≥N_TEMPLATE of those rows land on DISTINCT slugs. The distinct-slugs half
 * rejects two real false-positive shapes with a HIGH row count but NOT
 * genuine entity variety:
 *   - savvycal `/worldclock/Hawaii/Honolulu` — repeated under many keyword
 *     PHRASINGS of the SAME lookup ("hawaii time", "what time in hawaii", …).
 *     Same container ("hawaii"), same slug ("honolulu") every time — a
 *     monotonous single page, not a directory.
 *   - spacex `/vehicles/dragon` + `/vehicles/starship` — same container
 *     ("vehicles"), but only 2 distinct slugs (SpaceX's OWN two products, not
 *     third-party entities) — well under N_TEMPLATE.
 */
function entityListingTemplates(rows: Array<{ url: string }>): Set<string> {
  const bySeg = new Map<string, { rows: number; slugs: Set<string> }>();
  for (const r of rows) {
    const parsed = pathContainer(r.url);
    if (!parsed) continue;
    const cur = bySeg.get(parsed.container) ?? { rows: 0, slugs: new Set<string>() };
    cur.rows += 1;
    cur.slugs.add(parsed.slug);
    bySeg.set(parsed.container, cur);
  }
  const out = new Set<string>();
  for (const [container, stat] of bySeg) {
    if (stat.rows >= N_TEMPLATE && stat.slugs.size >= N_TEMPLATE) out.add(container);
  }
  return out;
}
/** How many of the subject's real category rankings to carry into the demand
 *  merge (won + not-won, highest-volume first). Bounded so the payload stays lean
 *  and a huge footprint can't sum into an incoherent "demand". */
const CATEGORY_RANKED_ROWS = 15;
/** Rough "full marks" target for category strength (≈ this many solid, sizable
 *  category rankings = a healthy category footprint). Tunable. Exported so
 *  WS-C's opportunity actions (fallback-actions.ts) can recompute the same
 *  one-category-win score-model step the search-visibility strength uses. */
export const CATEGORY_TARGET = 6;
/** Cap on the single `cachedKeywordVolumes` batch (request-billed — every
 *  phrase in the array is one price lookup, but the request itself is free
 *  regardless of count, so this bounds request SIZE, not cost).
 *
 *  Sized to a documented WORST CASE that the essential (never-truncatable)
 *  phrase set can never exceed (P2 review fix, 2026-07-20 — the prior cap of
 *  40 silently dropped up to 30 of ~70 unique phrases at realistic counts,
 *  including the single-token umbrella terms that clear CATEGORY_FLOOR):
 *    - category phrases:            ≤6  (LadderSeeds.phrases cap, synth.ts)
 *    - niche phrases:                ≤6  (LadderSeeds.phrases cap, synth.ts)
 *    - ladder candidates:            ≤6 category phrases × 7 each
 *                                     (`essentialLadderCandidates` bounds one
 *                                     phrase to token-count + 1; the prompt
 *                                     asks for "usually 2-3 words" so 6
 *                                     tokens/phrase is a generous ceiling)
 *                                     = 42 worst case (no shared tokens)
 *  essential worst case = 6 + 6 + 42 = 54. MAX_VOLUME_SEEDS=60 covers that
 *  with headroom to still fit a handful of the lower-priority legacy
 *  category-demand seeds / market-tier phrases (never guaranteed — only the
 *  essential set is guaranteed to survive truncation; see the priority order
 *  in `gatherFreeSearchVisibility`). */
const MAX_VOLUME_SEEDS = 60;

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
    brandPct: 0, categoryPct: 0, aggregatedPct: 0, offTopicPct: 0,
    categoryGap: [], offTopicExamples: [], aggregatedExamples: [], categoryWins: 0,
    categoryDemand: 0, categoryOpportunities: [], categoryPhrases: [], categoryRanked: [], categoryWonKeywords: [],
  };
  if (kw.length === 0) return empty;

  // Best position + max volume + summed etv per keyword (a domain ranks several
  // pages for one term). `url` is carried through UNCHANGED from the first
  // occurrence — it feeds the D3 batch pass below, not the score.
  const byKw = new Map<string, ClassifiedKeyword>();
  for (const k of kw) {
    if (k.volume <= 0 || k.position <= 0) continue;
    const cur = byKw.get(k.keyword);
    if (!cur) {
      byKw.set(k.keyword, {
        keyword: k.keyword, position: k.position, volume: k.volume, etv: k.etv,
        klass: classify(k.keyword, vocab.brandTokens, vocab.categoryVocab),
        url: k.url ?? "",
      });
    } else {
      cur.volume = Math.max(cur.volume, k.volume);
      if (k.position < cur.position) cur.position = k.position;
      cur.etv += k.etv;
    }
  }
  const rows = [...byKw.values()];
  if (rows.length === 0) return empty;

  // D3 (2026-07-20) batch pass: peel genuine THIRD-PARTY ENTITY listings out of
  // `offtopic` into `aggregated`. Runs AFTER per-keyword classify() (needs ALL
  // rows' URLs at once) and ONLY ever moves rows OUT of `offtopic` — brand and
  // category rows are never touched by this pass, so `categoryPct` (and
  // therefore `score`, computed below from category rows only) is UNCHANGED
  // by it (invariant #1; see search-visibility.test.ts's explicit
  // score-is-unaffected-by-the-aggregated-split proof).
  const templates = entityListingTemplates(rows);
  if (templates.size > 0) {
    for (const r of rows) {
      if (r.klass !== "offtopic") continue;
      // P1 review fix: BOTH signals required — the structural URL template
      // AND the keyword itself must be entity-shaped, not a topic headline
      // (see `isEntityShapedKeyword`'s doc comment for the blog/docs class
      // this closes). A row stays in the residual `offtopic` noise bucket
      // when either signal is missing.
      if (!isEntityShapedKeyword(r.keyword)) continue;
      const parsed = pathContainer(r.url);
      if (parsed && templates.has(parsed.container)) r.klass = "aggregated";
    }
  }

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

  // offTopicExamples now samples the RESIDUAL noise bucket only (aggregated
  // rows moved klass above, so this filter naturally excludes them — e.g.
  // "cometly"/"spanglish translator" no longer print here as "off-topic").
  const offTopicExamples = rows
    .filter((r) => r.klass === "offtopic" && !isNsfwExample(r.keyword))
    .sort((a, b) => b.volume - a.volume)
    .slice(0, OFFTOPIC_EXAMPLES)
    .map((r) => r.keyword);

  // D3: a few named entity examples for P3's aggregation strip.
  const aggregatedExamples = rows
    .filter((r) => r.klass === "aggregated" && !isNsfwExample(r.keyword))
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
    aggregatedPct: pct(etvOf("aggregated")),
    offTopicPct: pct(etvOf("offtopic")),
    categoryGap,
    offTopicExamples,
    aggregatedExamples,
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
  brandPct: 0, categoryPct: 0, aggregatedPct: 0, offTopicPct: 0,
  categoryGap: [], offTopicExamples: [], aggregatedExamples: [], categoryWins: 0,
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
 *
 * Grounding (task-G, 2026-07-20, completing PR-8): `categoryRanked` rows are
 * ALWAYS included (real by definition), but a `seedVolumes` row counts only
 * when GROUNDED against those real rankings — ranks for it exactly, or shares
 * ≥1 non-generic token with `categoryRanked` (the same `isTierPhraseGrounded`/
 * `groundedCategoryTokens` PR-8 added for the tier ladder — reused unforked).
 * An ungrounded seed ("business intelligence platform" priced to a real
 * 165,000/mo for trustmrr.com, which is neither ranks for it nor is a BI
 * platform) is dropped — real number, fabricated relevance. When
 * `categoryRanked` is EMPTY, there is no ranking evidence to ground against at
 * all, so the seeds are kept UNFILTERED (today's fallback) — a 0-ranking new
 * site's only signal, degrade to best-effort rather than to nothing.
 */
export function computeCategoryDemand(
  seedVolumes: Array<{ keyword: string; volume: number }>,
  rankByKeyword: Map<string, number>,
  categoryRanked: DemandRow[] = [],
  /** Phase B (optional): the LLM relevance judge's rulings. Where a seed was
   *  judged, its verdict decides inclusion (keep unless explicitly "irrelevant")
   *  instead of token-grounding — the precision fix for a seed that shares a real
   *  category token but names a different market (a "startup incubator" seed for
   *  an MRR tracker). An unjudged seed falls back to token-grounding (unchanged).
   *  Real rankings (`categoryRanked`) stay always-included, real by definition —
   *  the judge only refines the SEED fill, never vetoes a real ranking. */
  verdicts?: RelevanceVerdicts,
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
  // Reality first (carries position) — real rankings are ALWAYS included, they're
  // real by definition. The LLM seeds fill in / cover zero-rank sites, but (task-G,
  // 2026-07-20) only when GROUNDED against those real rankings — the same
  // corroboration rule PR-8 applied to the tier ladder (`isTierPhraseGrounded` /
  // `groundedCategoryTokens`, reused here unforked): a seed counts only if the
  // subject ranks for it exactly, or shares ≥1 non-generic (stemmed) token with
  // `categoryRanked`. Fixes the trustmrr class: "business intelligence platform"
  // priced to a REAL 165,000/mo (a real DataForSEO number) but trustmrr neither
  // ranks for it nor shares a token with its real category (mrr/startup/app/
  // revenue) — real number, fabricated relevance, same bug as the tier ladder had.
  // When `categoryRanked` is EMPTY (a 0-ranking/young site — no real-ranking
  // evidence to ground against at all), keep TODAY's unfiltered seed fallback:
  // it's the only signal a brand-new site has, so grounding would zero out the
  // one insight a young site can get (degrade to best-effort, not to nothing).
  for (const r of categoryRanked) add(r.keyword, r.volume, r.yourPosition);
  if (categoryRanked.length === 0) {
    for (const r of seedVolumes) add(r.keyword, r.volume);
  } else {
    const groundedTokens = groundedCategoryTokens(categoryRanked);
    for (const r of seedVolumes) {
      const v = verdicts?.get(r.keyword.toLowerCase());
      // Judge-authoritative when it ruled: keep unless explicitly "irrelevant"
      // (category AND niche are both the subject's market). Unjudged → the
      // pre-judge token-grounding decides (degrade, never worse than today).
      const relevant = v !== undefined ? v !== "irrelevant" : isTierPhraseGrounded(r.keyword, groundedTokens, rankByKeyword);
      if (!relevant) continue;
      add(r.keyword, r.volume);
    }
  }

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

// ---------------------------------------------------------------------------
// P2 (2026-07-20, data board): the CATEGORY/NICHE ladder. CATEGORY is the
// broad industry umbrella and must be LARGE (Tim's rule, D2 in
// docs/plans/2026-07-20-free-scan-databoard.md) — a grounded category number
// below the floor is a symptom of a too-narrow LLM phrase, not an honest
// result, so it is laddered UP (broader forms of the SAME phrase, never a
// different phrase) until a grounded broader form clears the floor or the
// ladder is exhausted. NICHE stays specific and may be small, and is
// contained in CATEGORY by construction (shares a real vocabulary token).
// Reuses the SAME grounding helpers (`isTierPhraseGrounded`,
// `groundedCategoryTokens`) the existing broad/niche market-tier ladder
// already uses (RC1 — no forked grounding logic for a third mechanism).
// ---------------------------------------------------------------------------

/** The minimum "this reads as a real, large industry" monthly-search total a
 *  CATEGORY card may report. Calibrated against the classification corpus
 *  (reachkit → "seo" ~40.5k, savvycal → "scheduling" ~33.1k, x.com →
 *  "social" ~673k, trustmrr → "startup" ~40.5k all clear it comfortably;
 *  see `search-visibility.test.ts`'s `computeCategoryLadder` suite and
 *  task-P2-report.md for the calibration record). Starting value per the
 *  approved plan (docs/plans/2026-07-20-free-scan-databoard.md §"CATEGORY_FLOOR");
 *  raise it only after re-running the corpus to confirm every real-industry
 *  fixture still clears it — the floor exists to catch a too-narrow LLM
 *  phrase, not to force a genuine micro-niche to lie (an exhausted ladder
 *  keeps the small, honest number rather than fabricate a bigger one). */
export const CATEGORY_FLOOR = 10_000;

/** P3fix (2026-07-20, LIVE DEFECT): trustmrr.com's category laddered to the
 *  BARE word "marketplace" (2,240,000/mo — Amazon/Facebook Marketplace
 *  territory) instead of its real niche. Root cause: the ladder's ONLY guard
 *  was "grounded" (shares a real ranking/niche token) — and "marketplace" IS
 *  grounded (trustmrr genuinely ranks for "startup acquisition marketplace"),
 *  so it passed while being a meaningless generic. These words describe a
 *  BUSINESS-MODEL SHAPE (a marketplace, a platform, a tool) — not an
 *  INDUSTRY. "marketplace" alone says nothing about what is traded, the same
 *  way "software" alone says nothing about what the software does. A
 *  category head must retain ≥1 token OUTSIDE this set (`isMeaningfulCategoryHead`)
 *  — a real qualifier ("seo", "scheduling", "startup", "social") — or it is
 *  rejected even when grounded and even when it clears `CATEGORY_FLOOR`.
 *  Several of these already ride OTHER lists incidentally (STOPWORDS drops
 *  "app"/"apps"/"tool"/"tools"/"software"/"online" from `tokens()` entirely;
 *  GENERIC_TOKENS already carries "platform"/"service"/"system"/"site") —
 *  this set is named and complete on its own so the rule is explicit and
 *  does not silently depend on those other lists' contents changing under it. */
export const CATEGORY_SUFFIX_TOKENS = new Set([
  "marketplace", "software", "tools", "tool", "platform", "platforms", "app", "apps",
  "service", "services", "system", "systems", "solution", "solutions", "company",
  "companies", "website", "site", "online", "business", "product", "products",
]);

/** A category head phrase is MEANINGFUL only if it retains ≥1 token, after
 *  stemming, that is neither a `CATEGORY_SUFFIX_TOKENS` bare-noun nor
 *  `GENERIC_TOKENS` — a real qualifier that names what the umbrella actually
 *  IS ("seo", "scheduling", "startup"), not merely what shape it takes
 *  ("marketplace", "platform", "tool"). Gates BOTH the base grounded category
 *  list and the laddered candidate selection in `computeCategoryLadder` — a
 *  bare-generic head must never win even when it is grounded and clears
 *  `CATEGORY_FLOOR` (the trustmrr "marketplace" 2.24M class, P3fix). */
export function isMeaningfulCategoryHead(phrase: string): boolean {
  for (const t of tokens(phrase)) {
    const st = stem(t);
    if (CATEGORY_SUFFIX_TOKENS.has(st) || CATEGORY_SUFFIX_TOKENS.has(t) || GENERIC_TOKENS.has(st)) continue;
    return true;
  }
  return false;
}

export interface CategoryLadderCard {
  /** The LLM's cosmetic label for this altitude (e.g. "SEO tooling") — never
   *  itself a priced search phrase. */
  label: string;
  /** Σ volume of `phrases` — reconciles exactly to them (the G4 idiom). For
   *  CATEGORY, this is the LARGE, laddered number when laddering fired. */
  demand: number;
  /** The priced, grounded phrases that sum to `demand`. For a laddered
   *  CATEGORY, this is the single accepted broader term (summing multiple
   *  different-altitude phrases would double-count overlapping volume). */
  phrases: DemandRow[];
  /** `phrases` the subject already ranks top-3 for — usually small/zero. */
  rankedTop3: DemandRow[];
  /** `phrases` the subject does NOT rank top-3 for, highest-volume first. */
  gaps: DemandRow[];
}

/** Enumerate every contiguous window of `phrase`'s tokens shorter than the
 *  original — "dropping leading/trailing qualifier tokens" (never a middle
 *  token, so a candidate is always a real, readable sub-phrase). Ordered
 *  longest-first (closest to the original = least broadened), so within one
 *  phrase's candidate list the ladder naturally tries the narrowest
 *  broadening before the widest. "seo analytics tools" (3 tokens) →
 *  ["seo analytics", "analytics tools", "seo", "analytics", "tools"]. A
 *  single-token phrase has no broader form (`[]`). Pure, deterministic —
 *  splits on whitespace only (grounding/generic-token filtering happens
 *  separately, via the shared `tokens()`/`GENERIC_TOKENS`, when a candidate
 *  is evaluated — see `computeCategoryLadder`). */
export function ladderCandidates(phrase: string): string[] {
  const toks = phrase.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (toks.length <= 1) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (let len = toks.length - 1; len >= 1; len--) {
    for (let start = 0; start + len <= toks.length; start++) {
      const cand = toks.slice(start, start + len).join(" ");
      if (!seen.has(cand)) {
        seen.add(cand);
        out.push(cand);
      }
    }
  }
  return out;
}

/** P2 review fix (2026-07-20): the candidates `computeCategoryLadder`'s ladder
 *  can actually SELECT, reduced from `ladderCandidates`'s full O(n²)
 *  combinatorial window enumeration (every contiguous sub-phrase of every
 *  length) to what the algorithm needs — every SINGLE-TOKEN form of the
 *  phrase (the ladder sorts fewest-tokens-first, so ANY one-word form might
 *  be the accepted broadest candidate; which one clears grounding+the floor
 *  is only known once priced, so all must ride the batch) plus AT MOST ONE
 *  intermediate broadening (the phrase with its trailing token dropped — the
 *  least-broadened non-trivial step, tried before falling back to a single
 *  token). Bounds one phrase's candidate count to (token count) + 1 instead
 *  of O(n²), so a 6-phrase category card can never explode the shared,
 *  cap-limited `cachedKeywordVolumes` batch (the class of bug this closes —
 *  see MAX_VOLUME_SEEDS's comment). Used by BOTH `computeCategoryLadder`
 *  (which candidates to evaluate) and `gatherFreeSearchVisibility` (which
 *  candidates to PRICE) — the same set, so nothing the ladder might select
 *  is ever left unpriced by a forked enumeration. */
export function essentialLadderCandidates(phrase: string): string[] {
  const toks = phrase.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (toks.length <= 1) return [];
  const singleTokens = [...new Set(toks)];
  const intermediate = toks.length > 2 ? [toks.slice(0, toks.length - 1).join(" ")] : [];
  return [...new Set([...intermediate, ...singleTokens])];
}

/** Split a priced phrase list into "already winning" (top-3) vs "the gap"
 *  (everything else, highest-volume first) — shared by CATEGORY and NICHE
 *  cards so the two never drift on what counts as "ranked". */
function splitRankedGaps(phrases: DemandRow[]): { rankedTop3: DemandRow[]; gaps: DemandRow[] } {
  const isTop3 = (p: DemandRow) => typeof p.yourPosition === "number" && p.yourPosition <= WINNING_POSITION;
  const rankedTop3 = phrases.filter(isTop3);
  const gaps = phrases.filter((p) => !isTop3(p)).slice().sort((a, b) => b.volume - a.volume);
  return { rankedTop3, gaps };
}

/** Price + attach position for one keyword, or `null` when it has no priced
 *  volume (never fabricate a phantom row for an unpriced/zero-volume term). */
function priceCardPhrase(
  keyword: string,
  volumesByKeyword: Map<string, number>,
  rankByKeyword: Map<string, number>,
): DemandRow | null {
  const kw = keyword.toLowerCase().trim();
  if (!kw) return null;
  const volume = volumesByKeyword.get(kw) ?? 0;
  if (volume <= 0) return null;
  return { keyword: kw, volume, yourPosition: rankByKeyword.get(kw) };
}

/**
 * Build the CATEGORY (broad, laddered-to-large) and NICHE (specific, small-
 * is-honest) cards from the LLM's two label+phrase seeds. Pure — every
 * candidate phrase is assumed already priced by the caller (the ONE
 * `cachedKeywordVolumes` batch — request-billed, so pricing every ladder
 * candidate up front costs nothing extra) and passed in via
 * `volumesByKeyword`; this function only grounds, ladders, and splits by
 * real rank.
 *
 * Grounding: a category/ladder candidate is accepted when it shares a
 * stemmed non-generic token with EITHER the subject's real category
 * rankings (`categoryRanked`) OR the LLM's own niche phrases — the SAME
 * `isTierPhraseGrounded` helper the existing broad/niche market-tier ladder
 * uses (RC1). This is ONE of two ladder guards: since the check is "shares a
 * token with real rankings or niche vocabulary", a candidate that has
 * broadened past every one of those tokens (a real but unrelated word like
 * "widgets" tokenizes but shares nothing) is structurally rejected, never a
 * separate bolt-on check. Grounding is NECESSARY but NOT SUFFICIENT, though
 * — a bare category-SUFFIX noun like "marketplace" can legitimately be
 * grounded (the subject genuinely ranks for "startup acquisition
 * marketplace") while still being a meaningless umbrella, because it names a
 * business-model SHAPE, not an industry. The SECOND guard,
 * `isMeaningfulCategoryHead`, closes that gap (P3fix, 2026-07-20 — the
 * trustmrr "marketplace" 2.24M live defect): several suffix nouns
 * ("software"/"tools"/"tool"/"app"/"apps"/"online") happen to be STOPWORDS
 * and tokenize to nothing, so they were ALREADY structurally rejected by
 * grounding alone — but "marketplace" is an ordinary word, not a stopword,
 * so it sailed through with real grounding and a real (huge) volume.
 * `CATEGORY_SUFFIX_TOKENS` names the full class explicitly rather than
 * relying on that incidental stopword overlap. NICHE phrases are grounded
 * ONLY against `categoryRanked` (not against niche's own vocabulary — that
 * would be self-referential, since niche vocabulary is built FROM the niche
 * phrases being checked) and separately required to be CONTAINED in
 * category (share a token with the category's own pre-ladder vocabulary) —
 * the ⊆ guarantee.
 *
 * When `categoryRanked` is EMPTY (a 0-ranking/brand-new site — no ranking
 * evidence to ground against at all), every check degrades to accept-all —
 * the same "degrade to best-effort, not to nothing" rule
 * `computeCategoryDemand`/`computeMarketTiers` already apply. The
 * meaningful-head guard still applies even then — a bare-generic must never
 * win the ladder regardless of grounding evidence.
 */
export function computeCategoryLadder(
  categoryNiche: CategoryNicheSeeds,
  volumesByKeyword: Map<string, number>,
  rankByKeyword: Map<string, number>,
  categoryRanked: DemandRow[] = [],
): { categoryCard: CategoryLadderCard; nicheCard: CategoryLadderCard } {
  const priced = (keyword: string) => priceCardPhrase(keyword, volumesByKeyword, rankByKeyword);

  const hasEvidence = categoryRanked.length > 0;
  const realTokens = hasEvidence ? groundedCategoryTokens(categoryRanked) : new Set<string>();
  // Niche's OWN vocabulary, used ONLY as corroboration for CATEGORY/ladder
  // candidates (an external signal there) — never to ground niche's own
  // phrases against themselves (that would be circular: every phrase
  // trivially "shares a token" with a set built from itself).
  const nicheVocabTokens = groundedCategoryTokens(categoryNiche.niche.phrases.map((p) => ({ keyword: p, volume: 0 })));
  const categoryGuardTokens = new Set<string>([...realTokens, ...nicheVocabTokens]);

  const groundedForCategory = (p: string): boolean => !hasEvidence || isTierPhraseGrounded(p, categoryGuardTokens, rankByKeyword);
  const groundedForNiche = (p: string): boolean => !hasEvidence || isTierPhraseGrounded(p, realTokens, rankByKeyword);

  // ── CATEGORY ──────────────────────────────────────────────────────────
  const dedupCategory = [...new Set(categoryNiche.category.phrases.map((p) => p.toLowerCase().trim()).filter(Boolean))];
  // P3fix: a category head must be grounded AND meaningful (retain a real
  // qualifier token, never JUST a bare CATEGORY_SUFFIX_TOKENS noun) — applied
  // here to the base LLM-proposed phrases too, not only the ladder candidates
  // below, so a bare-generic can never win via either path.
  const groundedCategoryPhrases = dedupCategory.filter((p) => groundedForCategory(p) && isMeaningfulCategoryHead(p));
  const categoryRows = groundedCategoryPhrases.map(priced).filter((r): r is DemandRow => r !== null);
  const baseDemand = categoryRows.reduce((s, r) => s + r.volume, 0);

  let finalPhrases = categoryRows;
  let finalDemand = baseDemand;

  if (finalDemand < CATEGORY_FLOOR) {
    // Ladder up: enumerate broader forms of EVERY grounded category phrase,
    // then accept the BROADEST (fewest tokens) grounded+floor-clearing
    // candidate — "broadest" because D2 wants MAXIMUM honest breadth, not
    // the minimum broadening that merely clears the bar. Ties (same token
    // count) break on higher volume, then lexical order — deterministic.
    // `essentialLadderCandidates` (not the full `ladderCandidates`) — the
    // SAME reduced set the gather batch prices, so nothing evaluated here is
    // ever unpriced by a forked enumeration (P2 review fix).
    const candidates = [...new Set(groundedCategoryPhrases.flatMap((p) => essentialLadderCandidates(p)))];
    const qualifying = candidates
      .filter(groundedForCategory)
      // P3fix (the trustmrr "marketplace" 2.24M class): grounded is
      // necessary but not sufficient — a candidate that is JUST a bare
      // category-suffix noun (no real qualifier token survives) must never
      // win the ladder, even though it may be grounded and clear the floor.
      .filter(isMeaningfulCategoryHead)
      .map((c) => priced(c))
      .filter((r): r is DemandRow => r !== null && r.volume >= CATEGORY_FLOOR)
      .sort((a, b) => {
        const byLen = a.keyword.split(/\s+/).length - b.keyword.split(/\s+/).length;
        if (byLen !== 0) return byLen;
        if (b.volume !== a.volume) return b.volume - a.volume;
        return a.keyword.localeCompare(b.keyword);
      });
    if (qualifying.length > 0) {
      finalPhrases = [qualifying[0]!];
      finalDemand = qualifying[0]!.volume;
    }
    // else: exhausted — keep the original (small, honest) category demand
    // rather than force a lie (D2, "genuine micro-niches aren't forced to lie").
  }

  const categorySplit = splitRankedGaps(finalPhrases);
  const categoryCard: CategoryLadderCard = {
    label: categoryNiche.category.label,
    demand: finalDemand,
    phrases: finalPhrases,
    rankedTop3: categorySplit.rankedTop3,
    gaps: categorySplit.gaps,
  };

  // ── NICHE ─────────────────────────────────────────────────────────────
  // Contained in CATEGORY: shares a non-generic stemmed token with the
  // category's OWN (pre-ladder) grounded vocabulary — checked against the
  // pre-ladder phrase set so a category that laddered down to one broad term
  // can't accidentally starve niche containment of the vocabulary that
  // justified the ladder in the first place.
  const categoryVocabSource = groundedCategoryPhrases.length > 0 ? groundedCategoryPhrases : dedupCategory;
  const categoryVocabTokens = groundedCategoryTokens(categoryVocabSource.map((p) => ({ keyword: p, volume: 0 })));
  const containedInCategory = (p: string): boolean => {
    if (categoryVocabTokens.size === 0) return true; // no category vocab evidence at all — degrade to accept
    for (const t of tokens(p)) {
      const st = stem(t);
      if (GENERIC_TOKENS.has(st)) continue;
      if (categoryVocabTokens.has(st)) return true;
    }
    return false;
  };

  const dedupNiche = [...new Set(categoryNiche.niche.phrases.map((p) => p.toLowerCase().trim()).filter(Boolean))];
  const nicheRows = dedupNiche
    .filter((p) => groundedForNiche(p) && containedInCategory(p))
    .map(priced)
    .filter((r): r is DemandRow => r !== null);
  const nicheSplit = splitRankedGaps(nicheRows);
  const nicheCard: CategoryLadderCard = {
    label: categoryNiche.niche.label,
    demand: nicheRows.reduce((s, r) => s + r.volume, 0),
    phrases: nicheRows,
    rankedTop3: nicheSplit.rankedTop3,
    gaps: nicheSplit.gaps,
  };

  return { categoryCard, nicheCard };
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

/** Phase A: how many category-market phrases the CATEGORY card renders. */
const MARKET_PHRASES = 8;
/** A leader footprint thinner than this is untrustworthy — degrade to seeds. */
const MIN_LEADER_ROWS = 10;
/** Phase B: how many of the leader's highest-volume keywords the judge rules on.
 *  Bounds the one Haiku call to ≤1 batch; the highest-volume terms (the ones that
 *  would dominate the market card) are exactly the ones that must be judged. */
const JUDGE_CANDIDATES = 30;
/** 2026-07-22 fine-tune: how many of the SUBJECT's own highest-volume non-brand
 *  ranked keywords feed the market pool + the judge. The niche's real footprint
 *  (usefathom's "google analytics cost"/"cross site tracking" buyer intent) lives
 *  here, below the score-side category classification — so the niche can be sized
 *  from how buyers ACTUALLY search, not just the LLM's exact-match phrases. */
const SUBJECT_FOOTPRINT_ROWS = 25;

/**
 * Pick the ONE category-leader domain to size the market from: normalized, a
 * real domain, NOT the subject, NOT an aggregator/directory (competitor-filter),
 * NOT a mega-brand platform. Returns the first survivor, or null → the gather
 * degrades to the subject-grounded ladder (R-3.15). Deterministic, no I/O.
 */
export function pickCategoryLeader(leaders: string[], subjectHost: string): string | null {
  const subject = normalizeHost(subjectHost);
  for (const raw of leaders) {
    const host = normalizeHost(raw);
    if (!host || host === subject) continue;
    if (isAggregatorHost(host)) continue;
    const label = host.split(".")[0] ?? host;
    if (MEGA_BRAND_TOKENS.has(label)) continue;
    return host;
  }
  return null;
}

/**
 * Cluster same-INTENT keyword paraphrases and keep the highest-volume member per
 * cluster (2026-07-22, the market-sizing fine-tune). DataForSEO/Keyword Planner
 * merge close variants (plurals, spelling) into ONE volume, but return distinct
 * PHRASINGS of one intent SEPARATELY — usefathom ranks for 12 phrasings of "how
 * to delete google analytics account" (140–210 each) and "google analytics cost"
 * + "cost of google analytics" (480 each). Summing those raw DOUBLE-COUNTS one
 * buyer. The intent key is the ORDER-INDEPENDENT set of non-stopword stems, so
 * "google analytics cost" and "cost of google analytics" collapse to one, and the
 * 12 delete-account phrasings collapse to one. This is the "de-dup before you
 * sum" the SEO-standard total-addressable-search method requires. PURE.
 */
/** Question words / prepositions / articles stripped from the intent key so
 *  filler-only paraphrases collapse ("how to delete a X account" ≡ "delete
 *  account from X") while CONTENT-word differences are preserved ("analytics" ≠
 *  "web analytics" — "web" is content, not filler, so they never merge). Stemmed. */
const INTENT_FILLERS: ReadonlySet<string> = new Set(
  ["how", "to", "a", "an", "the", "in", "on", "at", "of", "for", "from", "with", "is", "are", "do", "does", "what", "why", "when", "your", "you"].map(stem),
);

export function dedupeByIntent(rows: DemandRow[]): DemandRow[] {
  const byIntent = new Map<string, DemandRow>();
  for (const r of rows) {
    const key = [
      ...new Set(
        tokens(r.keyword)
          .map(stem)
          .filter((t) => !STOPWORDS.has(t) && !INTENT_FILLERS.has(t)),
      ),
    ]
      .sort()
      .join("|");
    if (!key) continue;
    const cur = byIntent.get(key);
    if (!cur || r.volume > cur.volume) byIntent.set(key, r);
  }
  return [...byIntent.values()];
}

/**
 * A market phrase is MEANINGFUL only if it's a real multi-token search query with
 * ≥1 content token — never a BARE mega-generic single word. This is the guard for
 * the "category = 'google' 68,000,000 / 'rocket' 1,000,000 / 'buy' 110,000" class:
 * the subject incidentally ranks for a huge one-word head (simpleanalytics ranks
 * for "google"), or a "google analytics alternative" seed drags "google" into the
 * category vocabulary, and that bare mega-word then dominates the basket. A real
 * market is "web analytics"/"rocket launch"/"google analytics alternative", not
 * "google"/"rocket"/"analytics" alone. PURE.
 */
export function isMeaningfulMarketPhrase(keyword: string): boolean {
  // A bare single word is too broad/ambiguous to size a market ("google" 68M,
  // "rocket" 1M, "buy" 110k, "analytics" 60.5k). A real market query is ≥2 RAW
  // words (counted raw, NOT via `tokens()` — that strips suffix-words like
  // "tools"/"software", which would wrongly collapse "seo tools" to one token)
  // with at least one non-mega-brand content token ("web analytics", "rocket
  // launch", "google analytics alternative"). This is the ONLY structural filter
  // — topic relevance is the judge's job, not this.
  const rawWords = keyword.trim().split(/\s+/).filter(Boolean).length;
  if (rawWords < 2) return false;
  const toks = tokens(keyword);
  return toks.length === 0 || toks.some((t) => !MEGA_BRAND_TOKENS.has(stem(t)));
}

/**
 * The shared tail of every market card (leader / category / niche): drop
 * non-meaningful bare phrases, DEDUP by intent, take the top `MARKET_PHRASES` by
 * volume, sum to `demand`, and split the subject's won vs gap phrases. One place
 * so the anti-inflation dedup + the bare-mega-word guard + the G4 "demand === Σ
 * phrases" reconciliation can't drift between the three cards. PURE.
 */
function finalizeMarketCard(label: string, rows: DemandRow[]): CategoryLadderCard | null {
  const top = dedupeByIntent(rows.filter((r) => isMeaningfulMarketPhrase(r.keyword)))
    .sort((a, b) => b.volume - a.volume)
    .slice(0, MARKET_PHRASES);
  if (top.length === 0) return null;
  const isWon = (p: DemandRow): boolean => p.yourPosition !== undefined && p.yourPosition <= WINNING_POSITION;
  return {
    label,
    demand: top.reduce((s, p) => s + p.volume, 0),
    phrases: top,
    rankedTop3: top.filter(isWon),
    gaps: top.filter((p) => !isWon(p)),
  };
}

/**
 * Is a keyword in the subject's CATEGORY? Phase B (2026-07-22): the LLM relevance
 * judge is authoritative WHEN it ruled on this keyword — `verdicts.get(kw)`
 * present ⇒ include iff it's "category", so a broad/adjacent term the judge
 * rejects (mixpanel's "data analytics tools" for web-analytics fathom) is dropped
 * even though it shares a token. A keyword the judge did NOT rule on (omitted, or
 * no judge at all) falls back to the pre-judge token-overlap heuristic — so a
 * partial/absent judge only REFINES, never renders worse than today (degrade,
 * never invent). PURE.
 */
function isCategoryKeyword(
  keyword: string,
  catVocab: ReadonlySet<string>,
  verdicts?: RelevanceVerdicts,
): boolean {
  const v = verdicts?.get(keyword.toLowerCase());
  if (v !== undefined) return v === "category";
  return tokens(keyword).some((t) => catVocab.has(stem(t)));
}

/**
 * Size the CATEGORY market from a leader's real ranked keywords (site-
 * independent), annotated with the SUBJECT's own position per phrase — "market
 * size + your share" (R-3.14). Produces a `CategoryLadderCard` so it drops
 * straight into the existing render. Every volume is DataForSEO's (the leader's
 * real rankings); the LLM only named the leader. Never touches `sv.score`
 * (invariant #1 — this feeds the card only). Returns null when no leader
 * keyword is category-relevant (→ degrade to the subject ladder).
 *
 * `verdicts` (Phase B, optional): the LLM relevance judge's rulings — where a
 * leader keyword was judged, its verdict decides category membership instead of
 * token-overlap (the mixpanel-for-fathom precision fix). Absent/unjudged
 * keywords fall back to token-overlap (unchanged behavior).
 */
export function computeMarketFromLeader(
  leaderDomain: string,
  leaderRows: RankedKeyword[],
  seeds: CategoryNicheSeeds,
  subjectRankByKeyword: Map<string, number>,
  subjectCategoryRanked: DemandRow[],
  verdicts?: RelevanceVerdicts,
): CategoryLadderCard | null {
  // Category vocabulary = non-generic stemmed tokens of the category label +
  // phrases. A leader keyword must share one to count as "the category".
  const catVocab = new Set<string>();
  for (const text of [seeds.category.label, ...seeds.category.phrases]) {
    for (const t of tokens(text)) {
      const st = stem(t);
      if (!GENERIC_TOKENS.has(st) && !MEGA_BRAND_TOKENS.has(st)) catVocab.add(st);
    }
  }
  if (catVocab.size === 0) return null;

  const leaderBrand = brandTokensFor([leaderDomain]);
  const subjPos = new Map<string, number>();
  for (const r of subjectCategoryRanked) {
    if (r.yourPosition && r.yourPosition > 0) subjPos.set(r.keyword.toLowerCase(), r.yourPosition);
  }

  // Category-relevant leader keywords: real volume, not the leader's own brand,
  // shares a non-generic token with the category vocabulary. Annotate the
  // subject's own position, then finalize (dedup intent + top-N + sum).
  const rows: DemandRow[] = [];
  for (const r of leaderRows) {
    if (r.volume <= 0) continue;
    if (isBrandKeyword(r.keyword, leaderBrand)) continue;
    if (!isCategoryKeyword(r.keyword, catVocab, verdicts)) continue;
    const key = r.keyword.toLowerCase();
    const yp = subjectRankByKeyword.get(key) ?? subjPos.get(key);
    rows.push({ keyword: r.keyword, volume: r.volume, ...(yp ? { yourPosition: yp } : {}) });
  }
  return finalizeMarketCard(seeds.category.label, rows);
}

/**
 * Size the CATEGORY market from a BASKET of real category keywords when no leader
 * resolves (2026-07-22 fine-tune — the "category collapsed to one keyword"
 * defect: usefathom's ladder priced the bare word "analytics" 60,500, a single
 * head term disconnected from what it competes for). The pool is the subject's
 * category seed phrases (+ their broader ladder forms) priced + its real category
 * rankings; a keyword counts as the category when the judge ruled it "category"
 * (else a category-vocab token), deduped by intent and summed. This is the
 * SEO-correct "total addressable search" method — Σ a distinct-query basket, not
 * a lone head keyword. Feeds the card only (invariant #1). PURE. Returns null →
 * degrade to the ladder card.
 */
export function computeCategoryMarket(
  label: string,
  pool: DemandRow[],
  categoryVocab: ReadonlySet<string>,
  verdicts?: RelevanceVerdicts,
): CategoryLadderCard | null {
  const rows: DemandRow[] = [];
  for (const r of pool) {
    if (!r || r.volume <= 0) continue;
    const key = r.keyword.toLowerCase();
    const v = verdicts?.get(key);
    const isCat = v !== undefined ? v === "category" : tokens(r.keyword).some((t) => categoryVocab.has(stem(t)));
    if (!isCat) continue;
    rows.push(r);
  }
  return finalizeMarketCard(label, rows);
}

/**
 * The niche's DISTINGUISHING vocabulary: the non-generic stemmed tokens of the
 * niche label + phrases that are NOT already category tokens — the differentiator
 * (usefathom category "Web Analytics", niche "Privacy-First Analytics" → the
 * distinguishing token is "privacy", not the shared "analytics"). Used as the
 * DEGRADE gate when the judge is absent. PURE.
 */
function nicheVocabFrom(seeds: CategoryNicheSeeds): Set<string> {
  const cat = new Set<string>();
  for (const text of [seeds.category.label, ...seeds.category.phrases]) {
    for (const t of tokens(text)) cat.add(stem(t));
  }
  const out = new Set<string>();
  for (const text of [seeds.niche.label, ...seeds.niche.phrases]) {
    for (const t of tokens(text)) {
      const st = stem(t);
      if (GENERIC_TOKENS.has(st) || MEGA_BRAND_TOKENS.has(st) || cat.has(st)) continue;
      out.add(st);
    }
  }
  return out;
}

/**
 * Size the NICHE market the same way the CATEGORY market is sized (Phase B-niche,
 * 2026-07-22 — the "niche is the least-built piece" fix): from MULTIPLE real
 * keywords, not the single exact-match LLM phrase the old `nicheCard` priced
 * (usefathom's "privacy-first analytics" = 20/mo). A niche keyword is one the
 * relevance judge ruled "niche" WHEN it ruled; absent a verdict it must carry a
 * niche-DISTINGUISHING token (`nicheVocab`) — a keyword the judge called
 * "category" or "irrelevant" is never the niche, and a keyword that only shares
 * the CATEGORY vocabulary (bare "analytics") is not niche-specific.
 *
 * `pool` is the subject's REAL niche-source rows — its own category rankings, the
 * leader's market keywords, and the priced LLM niche phrases — each with a real
 * DataForSEO volume + the subject's real position. Every number stays real; the
 * niche is honestly small when its real footprint is small, and credible when it
 * isn't (never fabricated, invariant #11). Feeds the card only — never `sv.score`
 * (invariant #1). Returns null when no niche keyword survives (→ degrade to the
 * thin single-phrase card). PURE.
 */
export function computeNicheMarket(
  nicheLabel: string,
  pool: DemandRow[],
  categoryVocab: ReadonlySet<string>,
  nicheVocab: ReadonlySet<string>,
  verdicts?: RelevanceVerdicts,
): CategoryLadderCard | null {
  const rows: DemandRow[] = [];
  for (const r of pool) {
    if (!r || r.volume <= 0) continue;
    const key = r.keyword.toLowerCase();
    const stems = tokens(r.keyword).map(stem);
    // CONTAINMENT (the ladder's `containedInCategory` rule, reinstated after a
    // live defect): a niche is a SLICE OF THE CATEGORY, so a niche keyword must
    // share a category token. This kills the judge's over-classification of a
    // differentiation-adjacent but off-CATEGORY term — usefathom (privacy
    // ANALYTICS) had generic "privacy tools"/"online privacy software" ruled
    // "niche" by the judge (privacy-adjacent, but not analytics), inflating the
    // niche to a wrong 4,380. No category token ("analytics") → not the niche.
    if (!stems.some((t) => categoryVocab.has(t))) continue;
    const v = verdicts?.get(key);
    // Judge-authoritative when it ruled; else the niche-distinguishing token gate.
    const isNiche = v !== undefined ? v === "niche" : stems.some((t) => nicheVocab.has(t));
    if (!isNiche) continue;
    rows.push(r);
  }
  return finalizeMarketCard(nicheLabel, rows);
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
  /** P2 (2026-07-20, data board): the lite synth's two-label category/niche
   *  seed (`SynthResult.categoryNiche`) — builds `categoryCard`/`nicheCard`
   *  via `computeCategoryLadder`. Optional/absent on a legacy synth payload;
   *  when absent, no cards are computed (no behaviour change). Zero new data
   *  call — its phrases + ladder candidates ride the SAME `cachedKeywordVolumes`
   *  batch as `seeds`/`tierPhrases` below. */
  categoryNicheSeeds?: CategoryNicheSeeds,
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
    // 2026-07-22 fine-tune: the subject's OWN highest-volume NON-brand ranked
    // keywords — the real buyer footprint (usefathom's GA-alternative + privacy
    // buyer intent) that the score-side classifier may bucket as brand/off-topic
    // and thus keep out of `categoryRanked`. Feeds the market pool + the judge so
    // the category and niche can be sized from how buyers ACTUALLY search. Brand
    // terms dropped (the subject's own name isn't market demand).
    const subjectBrand = brandTokensFor([self, ...brandNames]);
    const subjectFootprint: DemandRow[] = [
      ...new Map(
        kw
          .filter((k) => k.volume > 0 && !isBrandKeyword(k.keyword, subjectBrand))
          .map((k) => [k.keyword.toLowerCase(), k] as const),
      ).values(),
    ]
      .sort((a, b) => b.volume - a.volume)
      .slice(0, SUBJECT_FOOTPRINT_ROWS)
      .map((k) => ({ keyword: k.keyword, volume: k.volume, ...(k.position > 0 ? { yourPosition: k.position } : {}) }));
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
    // P2: the category/niche card seeds + their LADDER candidates (broader
    // forms of each category phrase — see `essentialLadderCandidates`) join
    // the SAME batch. Enumerated up front from the RAW (not-yet-grounded)
    // category phrases — grounding happens after pricing, in
    // `computeCategoryLadder` — because this is the one request-billed batch
    // where an extra priced phrase costs nothing (never a second call).
    // `essentialLadderCandidates` (not the full `ladderCandidates`) — bounds
    // the candidate count per phrase so this list can't itself blow the cap.
    const cardSeeds = categoryNicheSeeds
      ? [
          ...categoryNicheSeeds.category.phrases,
          ...categoryNicheSeeds.category.phrases.flatMap((p) => essentialLadderCandidates(p)),
          ...categoryNicheSeeds.niche.phrases,
        ]
      : [];
    // P2 review fix (2026-07-20): PRIORITY order, not append order. `cardSeeds`
    // (category phrases + their ladder candidates + niche phrases) is the
    // data-board essential set — the CATEGORY-must-be-LARGE guarantee (D2)
    // depends on the umbrella term surviving pricing, so it goes FIRST. The
    // legacy `seeds`/`tierPhrases` (category-demand hero + market-tier cards)
    // go SECOND — real features, but lower priority: if the combined unique
    // set exceeds MAX_VOLUME_SEEDS, only these may be truncated, never a
    // card-seed phrase or its ladder candidate (see MAX_VOLUME_SEEDS's
    // worst-case bound above). Dedup via Set happens AFTER priority ordering
    // so the FIRST (highest-priority) occurrence of a shared phrase is what
    // survives to the slice.
    const allSeeds = [
      ...new Set(
        [...cardSeeds, ...seeds, ...tierPhrases].map((s) => s.toLowerCase().trim()).filter(Boolean),
      ),
    ].slice(0, MAX_VOLUME_SEEDS);
    // Phase A/B: pick the category leader now and start its ranked_keywords fetch
    // in PARALLEL with the seed-volume batch (both are DataForSEO round-trips, no
    // reason to serialize them). Its rows size the market card AND are the judge's
    // candidates below.
    const leader = categoryNicheSeeds ? pickCategoryLeader(categoryNicheSeeds.leaders ?? [], self) : null;
    const leaderRowsP: Promise<RankedKeyword[]> = leader
      ? cachedRankedKeywords(leader, 50).catch(() => [] as RankedKeyword[])
      : Promise.resolve([] as RankedKeyword[]);
    const seedVolumes = allSeeds.length > 0 ? await cachedKeywordVolumes(allSeeds).catch(() => []) : [];
    const leaderRows = await leaderRowsP;
    const volumesByKeyword = new Map(seedVolumes.map((r) => [r.keyword.toLowerCase(), r.volume]));
    // Phase B (relevance judge, D3): rule each candidate keyword's relevance to
    // THIS business, so a term that merely SHARES a category token but names a
    // different/broader market is dropped from BOTH the category-demand hero AND
    // the leader market card — precision the token-overlap filter structurally
    // cannot give (the trustmrr "business intelligence" mislabel + the mixpanel-
    // for-fathom market pollution). Candidates = the subject's category seed
    // phrases (feed `computeCategoryDemand`) + the leader's highest-volume
    // keywords (feed `computeMarketFromLeader`). ONE Haiku call, cached + version-
    // stamped per subject, riding the ambient free-report/full-scan cost context
    // (invariant #2); degrades to token heuristics on any miss (unjudged keyword
    // → each function falls back). Feeds the card/demand side only — `sv.score`
    // is already fixed above (invariant #1).
    let verdicts: RelevanceVerdicts | undefined;
    if (categoryNicheSeeds) {
      const leaderCandidates = [...new Map(leaderRows.map((r) => [r.keyword.toLowerCase(), r])).values()]
        .sort((a, b) => b.volume - a.volume)
        .slice(0, JUDGE_CANDIDATES)
        .map((r) => r.keyword);
      // Phase B-niche (2026-07-22): ALSO judge the subject's OWN real category
      // rankings + the LLM niche phrases, so the judge can rule which of them are
      // the NICHE (feeds `computeNicheMarket`). The niche's real footprint lives
      // in the subject's own rankings (usefathom's cookieless/GA-alternative
      // terms), not the single exact-match phrase the old nicheCard priced.
      const candidates = [
        ...new Set([
          ...seeds,
          ...leaderCandidates,
          ...sv.categoryRanked.map((r) => r.keyword),
          ...subjectFootprint.map((r) => r.keyword.toLowerCase()),
          ...categoryNicheSeeds.niche.phrases.map((p) => p.toLowerCase().trim()).filter(Boolean),
        ]),
      ];
      if (candidates.length > 0) {
        const judged = await judgeRelevance(
          {
            host: self,
            name: brandNames[0],
            categoryLabel: categoryNicheSeeds.category.label,
            nicheLabel: categoryNicheSeeds.niche.label,
            rankedTerms: sv.categoryRanked.map((r) => r.keyword),
          },
          candidates,
        );
        if (judged.size > 0) verdicts = judged;
      }
    }
    // Demand hero (category rung): UNCHANGED — only the ORIGINAL category seeds
    // feed it, so the persisted demand story doesn't move under the ladder.
    const catVolumes = seedVolumes.filter((r) => seeds.includes(r.keyword.toLowerCase()));
    // Merge the site's REAL category rankings (sv.categoryRanked — from the SAME
    // ranked_keywords call, no extra spend) with the seed volumes, so demand +
    // opportunities reflect the actual market for big AND small sites alike.
    const demand = computeCategoryDemand(catVolumes, rankByKeyword, sv.categoryRanked, verdicts);
    // computeMarketTiers runs AFTER computeCategoryDemand — the dedup + inversion
    // guard need the category phrase set + demand total it just produced. Pass
    // the ALREADY-GROUNDED seeds (pre-filtered above, pre-fetch) plus
    // sv.categoryRanked so the pure function's own grounding check is a no-op
    // here (defense-in-depth) rather than a second live filter.
    const marketTiers = groundedTierSeeds
      ? computeMarketTiers(groundedTierSeeds, volumesByKeyword, rankByKeyword, demand.categoryPhrases, demand.categoryDemand, sv.categoryRanked)
      : undefined;
    // P2: the laddered CATEGORY card (large, grounded) + the specific NICHE
    // card. Presentation-only — built from `volumesByKeyword`/`rankByKeyword`/
    // `sv.categoryRanked`, never fed back into `sv.score` (invariant #1; the
    // spread order below never assigns a `score` key from this object).
    const cards = categoryNicheSeeds
      ? computeCategoryLadder(categoryNicheSeeds, volumesByKeyword, rankByKeyword, sv.categoryRanked)
      : null;
    // Phase A (market model, R-3.14/R-3.15): size the CATEGORY market from a
    // category LEADER's real footprint — site-independent, so a weak/new subject
    // still shows the real market it competes in, with "your share" (the
    // subject's position per phrase) beside it. ONE extra ranked_keywords call
    // (~1.8¢, per-domain cached), a validated leader, and it only REPLACES the
    // subject-grounded categoryCard when it resolves AND is larger (never shrinks
    // the honest number). Degrades to `cards` on any miss. Feeds the card only —
    // `sv.score` is already fixed above (invariant #1).
    let categoryCard = cards?.categoryCard;
    let nicheCard = cards?.nicheCard;
    let categoryLeader: string | undefined;
    if (categoryNicheSeeds) {
      // The ONE shared market pool (2026-07-22 fine-tune): every real keyword we
      // have a volume for — the subject's real category rankings + its full non-
      // brand footprint + the priced category/niche seed phrases (+ their broader
      // ladder forms) — each with the subject's real position. The judge's per-
      // keyword verdict SPLITS this ONE pool into the CATEGORY card (verdict
      // "category") and the NICHE card (verdict "niche", contained in category);
      // both `finalizeMarketCard` (dedup intent → top-N → Σ). This is the SEO-
      // correct "sum a de-duplicated basket of distinct queries", replacing the
      // ladder's single head keyword (usefathom's bare "analytics" 60,500).
      const priced = (phrase: string): DemandRow | null => {
        const k = phrase.toLowerCase().trim();
        const v = volumesByKeyword.get(k);
        if (!v || v <= 0) return null;
        const yp = rankByKeyword.get(k);
        return { keyword: phrase, volume: v, ...(yp ? { yourPosition: yp } : {}) };
      };
      // The basket is the LLM's DISTINCT category + niche phrases only — NOT their
      // broader ladder forms (those over-broaden: "website analytics" → bare
      // "website" 450,000, which is not the subject's market and inflated the
      // category). The ladder's broadenings stay for the rare ladder degrade path,
      // never the basket sum.
      const seedPhrases = [
        ...categoryNicheSeeds.category.phrases,
        ...categoryNicheSeeds.niche.phrases,
      ];
      const marketPool: DemandRow[] = [
        ...sv.categoryRanked,
        ...subjectFootprint,
        ...seedPhrases.map(priced).filter((r): r is DemandRow => r !== null),
      ];
      const categoryVocab = new Set<string>();
      for (const text of [categoryNicheSeeds.category.label, ...categoryNicheSeeds.category.phrases]) {
        for (const t of tokens(text)) {
          const st = stem(t);
          if (!GENERIC_TOKENS.has(st) && !MEGA_BRAND_TOKENS.has(st)) categoryVocab.add(st);
        }
      }
      const nicheVocab = nicheVocabFrom(categoryNicheSeeds);

      // CATEGORY: the guarded market BASKET is PRIMARY — it OUTRIGHT replaces the
      // ladder whenever it resolves (never "only if bigger": the ladder produced
      // bare single umbrella terms like "google" 68,000,000 / "job" 1,220,000 that
      // won purely by size, which the ≥2-word basket can never out-total). The
      // ladder survives only as a last-resort when the basket is null. A validated
      // leader's footprint (brand dropped + "sized from" provenance) beats the
      // basket when larger.
      const categoryBasket = computeCategoryMarket(categoryNicheSeeds.category.label, marketPool, categoryVocab, verdicts);
      if (categoryBasket) categoryCard = categoryBasket;
      if (leader && leaderRows.length >= MIN_LEADER_ROWS) {
        const leaderMarket = computeMarketFromLeader(leader, leaderRows, categoryNicheSeeds, rankByKeyword, sv.categoryRanked, verdicts);
        if (leaderMarket && leaderMarket.demand > (categoryCard?.demand ?? 0)) {
          categoryCard = leaderMarket;
          categoryLeader = leader;
        }
      }

      // NICHE: the same pool, the "niche" verdicts, contained in the category. Also
      // PRIMARY over the thin ladder niche when it resolves.
      const nicheMarket = computeNicheMarket(categoryNicheSeeds.niche.label, marketPool, categoryVocab, nicheVocab, verdicts);
      if (nicheMarket) nicheCard = nicheMarket;
    }
    return {
      ...sv,
      ...demand,
      ...(marketTiers && marketTiers.length > 0 ? { marketTiers } : {}),
      ...(categoryCard ? { categoryCard } : {}),
      ...(nicheCard ? { nicheCard } : {}),
      ...(categoryLeader ? { categoryLeader } : {}),
    };
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
