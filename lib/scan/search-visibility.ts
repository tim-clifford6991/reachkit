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
import { brandTokensFor, isBrandKeyword } from "@/lib/scan/referral/brand-keywords";
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
  // DELETED 2026-07-17 (free-scan honesty): `categoryCaptureRate` was
  // `= sv.score` — the search-presence score rendered a SECOND time under a
  // "you capture X%" label (identical in 10/10 prod scans). A metric may never be
  // an alias of another metric (guard G1). `categoryCapturedSearches` was its
  // internal, unit-incoherent numerator (category ETV vs seed volumes, off by up
  // to 1,308×) and fed nothing external — deleted with it.
}

const STOPWORDS = new Set([
  "the", "and", "for", "with", "your", "you", "our", "are", "was", "how", "why",
  "what", "who", "best", "top", "app", "apps", "tool", "tools", "software", "online",
  "free", "new", "get", "com", "www", "http", "https", "vs", "review", "reviews",
]);

/** Break a phrase into meaningful lowercase tokens (len ≥ 3, non-stopword). */
function tokens(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}

/**
 * Build the brand tokens + category vocabulary that drive classification.
 * - brandTokens: the domain label + its split forms ("trustmrr", "trust", "mrr"…)
 *   so both "trustmrr" and "trust mrr" register as brand.
 * - categoryVocab: the subject's own topic words (from its themes + positioning
 *   prose), MINUS the brand label — so "startup mrr" is category but "cometly"
 *   (which shares nothing with the subject's vocabulary) is off-topic.
 */
export function buildVocab(domain: string, seedText: string[]): { brandTokens: Set<string>; categoryVocab: Set<string> } {
  // Brand tokens come from the ONE shared detector (also used by the paid keyword
  // gap), so a keyword is judged "brand" identically everywhere — no more forked
  // brand logic that can drift between the two engines (RC1).
  const brandTokens = brandTokensFor([domain]);
  const categoryVocab = new Set<string>();
  for (const s of seedText) for (const t of tokens(s)) if (!brandTokens.has(t)) categoryVocab.add(t);
  return { brandTokens, categoryVocab };
}

function classify(keyword: string, brandTokens: Set<string>, categoryVocab: Set<string>): KeywordClass {
  // Brand via the shared detector (exact-token or distinctive-substring match).
  if (isBrandKeyword(keyword, brandTokens)) return "brand";
  // Category: shares a meaningful topic token with the subject's own vocabulary.
  const toks: string[] = keyword.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  for (const t of toks) if (categoryVocab.has(t)) return "category";
  return "offtopic";
}

const WINNING_POSITION = 3;
const CATEGORY_GAP_ROWS = 6;
const OFFTOPIC_EXAMPLES = 3;
/** How many of the subject's real category rankings to carry into the demand
 *  merge (won + not-won, highest-volume first). Bounded so the payload stays lean
 *  and a huge footprint can't sum into an incoherent "demand". */
const CATEGORY_RANKED_ROWS = 15;
/** Rough "full marks" target for category strength (≈ this many solid, sizable
 *  category rankings = a healthy category footprint). Tunable. */
const CATEGORY_TARGET = 6;

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
    .filter((r) => r.klass === "offtopic")
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

/**
 * Free-scan gather: ONE `ranked_keywords` call (your footprint) + ONE `keyword_ideas`
 * call (your category's total demand) → Search Visibility. `seedText` is the subject's
 * own vocabulary (themes + positioning prose) — used both to tell category searches
 * from other-brand noise AND to seed the demand read. Crucially, it still fetches
 * category demand when the site ranks for NOTHING, so a brand-new site gets a real
 * "your category gets X searches/mo, you capture 0%" insight instead of a blank.
 * Fixtures-safe (adapters → [] → zeroed) and best-effort (never throws).
 */
export async function gatherFreeSearchVisibility(
  rawSelf: string,
  seedText: string[],
  llmCategorySeeds: string[] = [],
): Promise<SearchVisibility> {
  try {
    const self = normalizeHost(rawSelf);
    const vocab = buildVocab(self, seedText);
    // The LLM authoritatively identified the category, so fold its seed tokens into
    // the category vocabulary — ideas about the real market are then recognised as
    // category-relevant even if the on-page prose didn't use those exact words.
    for (const s of llmCategorySeeds) {
      for (const t of s.toLowerCase().match(/[a-z0-9]+/g) ?? []) {
        if (t.length >= 3 && !STOPWORDS.has(t) && !vocab.brandTokens.has(t)) vocab.categoryVocab.add(t);
      }
    }
    // The top ranked_keywords sample (for the brand/category/off-topic split) AND
    // the TRUE domain totals (domain_rank_overview, +~1.2¢) in parallel. The sample
    // powers classification; the overview gives the honest keywordsRanked/ETV that
    // replace the capped-50 lie.
    const [kw, overview] = await Promise.all([
      cachedRankedKeywords(self, 50).catch(() => [] as RankedKeyword[]),
      cachedDomainOverview(self).catch(() => null),
    ]);
    const sv = computeSearchVisibility(kw, vocab);
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
    // Measure the EXACT volume of the category seed phrases (no expansion noise).
    const seedVolumes = seeds.length > 0 ? await cachedKeywordVolumes(seeds).catch(() => []) : [];
    // Merge the site's REAL category rankings (sv.categoryRanked — from the SAME
    // ranked_keywords call, no extra spend) with the seed volumes, so demand +
    // opportunities reflect the actual market for big AND small sites alike.
    return { ...sv, ...computeCategoryDemand(seedVolumes, rankByKeyword, sv.categoryRanked) };
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
