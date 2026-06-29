/**
 * Keyword-gap funnel (test harness): the SEO counterpart to the backlink funnel.
 *
 * URL → category → closest competitors → the keywords competitors RANK for (top 30)
 * that the subject doesn't (or ranks worse) → cross-referenced across competitors
 * (how many rivals rank = consensus the keyword matters) → with the ranking-page
 * URL per competitor (WHERE they map higher) so the user can see what content wins.
 *
 * Heavy-ish (1 Labs ranked_keywords call per domain). Test-only.
 */
import { normalizeHost } from "@/lib/scan/referral/classify";
import { cohortFor } from "@/lib/scan/cache/cached-adapters";
import { cachedRankedKeywords } from "@/lib/scan/cache/cached-adapters";

const WINNING_POSITION = 30; // only count a rival ranking in the top 30 as "winning"

/** Brand tokens for the cohort — a founder can't realistically rank for a rival's
 *  brand ("read", "read ai", "cirrusinsight"), so those keywords are not opportunities. */
function brandTokens(domains: string[]): Set<string> {
  const t = new Set<string>();
  for (const d of domains) {
    const label = d.replace(/^www\./, "").split(".")[0]?.toLowerCase();
    if (label && label.length >= 3) {
      t.add(label);
      t.add(label.replace(/[^a-z0-9]/g, ""));
    }
  }
  return t;
}

function isBrandKeyword(keyword: string, brands: Set<string>): boolean {
  const kw = keyword.toLowerCase();
  const words = kw.split(/\s+/);
  const joined = kw.replace(/[\s.\-_]/g, "");
  for (const b of brands) {
    if (words.includes(b)) return true; // exact word, e.g. "read ai"
    if (b.length >= 5 && joined.includes(b)) return true; // substring for distinctive brands
  }
  return false;
}

export interface CompetitorRank {
  domain: string;
  position: number;
  /** The ranking page — where the competitor maps higher for this keyword. */
  url: string;
}

export interface KeywordGap {
  keyword: string;
  volume: number;
  subjectPosition: number | null; // null = subject doesn't rank at all
  bestPosition: number;
  competitorsRanking: number; // cross-reference: how many rivals win this
  competitors: CompetitorRank[];
  opportunity: number; // ranking score (volume × consensus × position quality)
}

export interface SharedKeyword {
  keyword: string;
  volume: number;
  subjectPosition: number;
  bestCompetitor: string;
  bestPosition: number; // a rival outranks the subject here
}

export interface DomainKwSummary {
  domain: string;
  rankedFor: number; // # keywords sampled in the top results
  topVolume: number;
}

export interface KeywordGapResult {
  category: string;
  subject: { domain: string; rankedFor: number };
  competitors: DomainKwSummary[];
  /** Keywords rivals win that the subject misses entirely — ranked by opportunity. */
  gaps: KeywordGap[];
  /** Keywords the subject ranks for but a rival ranks higher. */
  shared: SharedKeyword[];
}

export async function gatherKeywordGap(rawSelf: string, opts: { topN?: number; competitorDomains?: string[] } = {}): Promise<KeywordGapResult> {
  const self = normalizeHost(rawSelf);
  const closest = await cohortFor(self, opts.competitorDomains);
  const cohort = closest.ranked.slice(0, opts.topN ?? 4).map((r) => r.domain);

  const [subjectKw, ...compKwLists] = await Promise.all([
    cachedRankedKeywords(self, 100),
    ...cohort.map((d) => cachedRankedKeywords(d, 100)),
  ]);

  // Subject's best position per keyword.
  const subjectPos = new Map<string, number>();
  for (const k of subjectKw) {
    if (k.position <= 0) continue;
    const cur = subjectPos.get(k.keyword);
    if (cur == null || k.position < cur) subjectPos.set(k.keyword, k.position);
  }

  const brands = brandTokens([self, ...cohort]);

  // Aggregate competitor rankings per keyword (best position per competitor).
  const agg = new Map<string, { volume: number; comps: Map<string, { position: number; url: string }> }>();
  cohort.forEach((domain, i) => {
    for (const k of compKwLists[i]) {
      if (k.position <= 0 || k.position > WINNING_POSITION) continue;
      if (isBrandKeyword(k.keyword, brands)) continue; // drop rival/own brand terms
      let e = agg.get(k.keyword);
      if (!e) {
        e = { volume: k.volume, comps: new Map() };
        agg.set(k.keyword, e);
      }
      e.volume = Math.max(e.volume, k.volume);
      const prev = e.comps.get(domain);
      if (!prev || k.position < prev.position) e.comps.set(domain, { position: k.position, url: k.url });
    }
  });

  const gaps: KeywordGap[] = [];
  const shared: SharedKeyword[] = [];
  for (const [keyword, e] of agg) {
    const competitors = [...e.comps.entries()]
      .map(([domain, v]) => ({ domain, position: v.position, url: v.url }))
      .sort((a, b) => a.position - b.position);
    const bestPosition = competitors[0].position;
    const subjPos = subjectPos.get(keyword) ?? null;

    if (subjPos == null) {
      const opportunity = Math.log1p(e.volume) * competitors.length * ((WINNING_POSITION + 1 - bestPosition) / WINNING_POSITION);
      gaps.push({ keyword, volume: e.volume, subjectPosition: null, bestPosition, competitorsRanking: competitors.length, competitors: competitors.slice(0, 5), opportunity });
    } else if (subjPos > bestPosition) {
      shared.push({ keyword, volume: e.volume, subjectPosition: subjPos, bestCompetitor: competitors[0].domain, bestPosition });
    }
  }
  // Lead with cross-referenced consensus: keywords MULTIPLE rivals rank for are
  // genuine category opportunities (single-rival ones are often brand/navigational).
  gaps.sort((a, b) => b.competitorsRanking - a.competitorsRanking || b.opportunity - a.opportunity);
  shared.sort((a, b) => b.volume - a.volume);

  const competitors: DomainKwSummary[] = cohort.map((domain, i) => ({
    domain,
    rankedFor: compKwLists[i].length,
    topVolume: Math.max(0, ...compKwLists[i].map((k) => k.volume)),
  }));

  return {
    category: closest.category,
    subject: { domain: self, rankedFor: subjectKw.length },
    competitors,
    gaps: gaps.slice(0, 40),
    shared: shared.slice(0, 20),
  };
}
