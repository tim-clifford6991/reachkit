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
import { cachedRankedKeywords, cachedKeywordVolumes } from "@/lib/scan/cache/cached-adapters";

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
}

export interface SearchVisibility {
  /** 0–100 heroable gap metric — how much real category search you actually win. */
  score: number;
  /** Total keywords the domain ranks for (in the sampled set). */
  keywordsRanked: number;
  /** Estimated monthly organic visits (Σ etv), rounded. */
  estMonthlyVisits: number;
  /** Share of estimated traffic by class (0–100, summing ~100). */
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
  /** Total monthly searches across your category (Σ volume of category keyword ideas). 0 = unknown. */
  categoryDemand: number;
  /** 0–100: your share of that demand (est. category searches you capture ÷ demand). */
  categoryCaptureRate: number;
  /** High-demand category searches you do NOT win — the real, sizeable opportunity
   *  (bigger than your own tiny rankings; drawn from category demand, not just what
   *  you already rank for). */
  categoryOpportunities: DemandRow[];
  /** Internal: est. monthly category searches you currently capture (numerator). */
  categoryCapturedSearches: number;
  /** Internal: category terms you already rank top-3 for (dedup for opportunities). */
  categoryWonKeywords: string[];
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
  const label = domain.replace(/^www\./, "").split(".")[0]?.toLowerCase() ?? "";
  const brandTokens = new Set<string>();
  if (label.length >= 3) brandTokens.add(label);
  // Split a camel/compound brand ("trustmrr") into parts if they read as words.
  for (const part of label.split(/[^a-z0-9]+/)) if (part.length >= 3) brandTokens.add(part);

  const categoryVocab = new Set<string>();
  for (const s of seedText) for (const t of tokens(s)) if (!brandTokens.has(t)) categoryVocab.add(t);
  return { brandTokens, categoryVocab };
}

function classify(keyword: string, brandTokens: Set<string>, categoryVocab: Set<string>): KeywordClass {
  const toks: string[] = keyword.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  const joined = keyword.toLowerCase().replace(/[^a-z0-9]/g, "");
  // Brand: any token is a brand token, or the whole phrase collapses to the brand
  // label (handles "trust mrr" → "trustmrr").
  for (const b of brandTokens) {
    if (toks.includes(b)) return "brand";
    if (b.length >= 6 && joined.includes(b)) return "brand";
  }
  // Category: shares a meaningful topic token with the subject's own vocabulary.
  for (const t of toks) if (categoryVocab.has(t)) return "category";
  return "offtopic";
}

const WINNING_POSITION = 3;
const CATEGORY_GAP_ROWS = 6;
const OFFTOPIC_EXAMPLES = 3;
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
    score: 0, keywordsRanked: 0, estMonthlyVisits: 0,
    brandPct: 0, categoryPct: 0, offTopicPct: 0,
    categoryGap: [], offTopicExamples: [], categoryWins: 0,
    categoryDemand: 0, categoryCaptureRate: 0, categoryOpportunities: [],
    categoryCapturedSearches: 0, categoryWonKeywords: [],
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

  // Est. category searches you actually capture: volume × position quality.
  const categoryCapturedSearches = Math.round(category.reduce((s, r) => s + r.volume * posQuality(r.position), 0));
  const categoryWonKeywords = category.filter((r) => r.position <= WINNING_POSITION).map((r) => r.keyword.toLowerCase());

  const categoryGap = category
    .filter((r) => r.position > WINNING_POSITION)
    .sort((a, b) => b.volume - a.volume)
    .slice(0, CATEGORY_GAP_ROWS)
    .map((r) => ({ keyword: r.keyword, volume: r.volume, yourPosition: r.position }));

  const offTopicExamples = rows
    .filter((r) => r.klass === "offtopic")
    .sort((a, b) => b.volume - a.volume)
    .slice(0, OFFTOPIC_EXAMPLES)
    .map((r) => r.keyword);

  return {
    score,
    keywordsRanked: rows.length,
    estMonthlyVisits: Math.round(totalEtv),
    brandPct: pct(etvOf("brand")),
    categoryPct: pct(etvOf("category")),
    offTopicPct: pct(etvOf("offtopic")),
    categoryGap,
    offTopicExamples,
    categoryWins: category.filter((r) => r.position <= WINNING_POSITION).length,
    // Category-demand fields are filled by the gather (needs the keyword_ideas call);
    // defaults here keep computeSearchVisibility pure + usable stand-alone.
    categoryDemand: 0,
    categoryCaptureRate: 0,
    categoryOpportunities: [],
    categoryCapturedSearches,
    categoryWonKeywords,
  };
}

const EMPTY: SearchVisibility = {
  score: 0, keywordsRanked: 0, estMonthlyVisits: 0,
  brandPct: 0, categoryPct: 0, offTopicPct: 0,
  categoryGap: [], offTopicExamples: [], categoryWins: 0,
  categoryDemand: 0, categoryCaptureRate: 0, categoryOpportunities: [],
  categoryCapturedSearches: 0, categoryWonKeywords: [],
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

/**
 * Category demand from the EXACT volumes of the LLM's category seed phrases (via
 * google_ads/search_volume — no keyword_ideas expansion, so no off-topic noise like
 * "google calendar"/"walmart revenue"). demand = Σ seed volume; capture rate = your
 * captured category searches ÷ that demand; opportunities = the category searches
 * you don't already win. The LLM named the category; DataForSEO supplies the volume.
 */
export function computeCategoryDemand(
  seedVolumes: Array<{ keyword: string; volume: number }>,
  sv: SearchVisibility,
  rankByKeyword: Map<string, number>,
): Pick<SearchVisibility, "categoryDemand" | "categoryCaptureRate" | "categoryOpportunities"> {
  const byKw = new Map<string, number>();
  for (const r of seedVolumes) {
    if (r.volume <= 0) continue;
    const k = r.keyword.toLowerCase();
    byKw.set(k, Math.max(byKw.get(k) ?? 0, r.volume));
  }
  const rows = [...byKw.entries()].map(([keyword, volume]) => ({ keyword, volume })).sort((a, b) => b.volume - a.volume);
  const categoryDemand = rows.reduce((s, r) => s + r.volume, 0);
  // Capture = your Search Visibility score (how well you rank for your category) —
  // a real, differentiated 0–100 computed from your OWN category rankings. Avoids
  // the unit-mismatch of dividing broad category ETV by narrow seed volumes.
  const categoryCaptureRate = sv.score;
  // Opportunities = the category searches you are NOT already winning (not ranked
  // top 3 for the exact phrase), highest-volume first.
  const categoryOpportunities = rows
    .filter((r) => { const pos = rankByKeyword.get(r.keyword); return pos === undefined || pos > WINNING_POSITION; })
    .slice(0, OPPORTUNITY_ROWS)
    .map((r) => ({ keyword: r.keyword, volume: r.volume }));
  return { categoryDemand, categoryCaptureRate, categoryOpportunities };
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
    const kw = await cachedRankedKeywords(self, 50).catch(() => [] as RankedKeyword[]);
    const sv = computeSearchVisibility(kw, vocab);
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
    return { ...sv, ...computeCategoryDemand(seedVolumes, sv, rankByKeyword) };
  } catch {
    return EMPTY;
  }
}
