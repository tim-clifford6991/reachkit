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
import { cachedRankedKeywords } from "@/lib/scan/cache/cached-adapters";

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

/** Per-keyword category strength: volume-weighted (capped) × position quality. */
function categoryContribution(k: ClassifiedKeyword): number {
  const volWeight = Math.min(1, k.volume / 1000); // a 1k+/mo term counts fully
  const posQuality = Math.max(0, Math.min(1, (21 - k.position) / 20)); // pos1→1, pos21+→0
  return volWeight * posQuality;
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
  };
}

const EMPTY: SearchVisibility = {
  score: 0, keywordsRanked: 0, estMonthlyVisits: 0,
  brandPct: 0, categoryPct: 0, offTopicPct: 0,
  categoryGap: [], offTopicExamples: [], categoryWins: 0,
};

/**
 * Free-scan gather: ONE subject-only `ranked_keywords` call → Search Visibility.
 * `seedText` is the subject's own vocabulary (its themes + positioning prose) used
 * to tell category searches from other-brand noise. Fixtures-safe (adapter → [] →
 * zeroed) and best-effort (never throws; the free report ships regardless).
 */
export async function gatherFreeSearchVisibility(rawSelf: string, seedText: string[]): Promise<SearchVisibility> {
  try {
    const self = normalizeHost(rawSelf);
    const kw = await cachedRankedKeywords(self, 50);
    if (kw.length === 0) return EMPTY;
    return computeSearchVisibility(kw, buildVocab(self, seedText));
  } catch {
    return EMPTY;
  }
}
