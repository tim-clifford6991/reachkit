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
import { brandTokensFor, isBrandKeyword } from "@/lib/scan/referral/brand-keywords";
import { cohortFor } from "@/lib/scan/cache/cached-adapters";
import { cachedRankedKeywords } from "@/lib/scan/cache/cached-adapters";
import { MAX_SELECTED } from "@/lib/scan/competitor-selection";
import type { OnStageCallback } from "@/lib/scan/types";

const WINNING_POSITION = 30; // only count a rival ranking in the top 30 as "winning"

// Brand detection (a founder can't realistically rank for a rival's brand
// "read ai"/"cirrusinsight", so those keywords are not opportunities) comes from
// the ONE shared detector in `./brand-keywords` — the same one the free footprint
// classifier uses, so the two engines can never disagree about what "brand" means
// (RC1). The local forks that used to live here (a different tokenizer + a ≥5
// substring threshold) are deleted.

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

export async function gatherKeywordGap(rawSelf: string, opts: { topN?: number; competitorDomains?: string[]; onStage?: OnStageCallback; brandNames?: string[] } = {}): Promise<KeywordGapResult> {
  const self = normalizeHost(rawSelf);
  const closest = await cohortFor(self, opts.competitorDomains);
  // Default to MAX_SELECTED (5) so the keyword-gap cohort matches the funnel /
  // synthesis cohort — otherwise the 5th selected rival gets referrer data but no
  // keyword-gap data ("No keyword-gap data surfaced" when the user selects it).
  const cohort = closest.ranked.slice(0, opts.topN ?? MAX_SELECTED).map((r) => r.domain);

  // Limit 50 (was 100) to share the rk:<domain>:50 cache the deep-scan profiler
  // now warms (cost dedup). Gaps only count rivals in the top 30 (WINNING_POSITION)
  // and order_by etv desc front-loads value, so rows 51-100 rarely survived anyway.
  const [subjectKw, ...compKwLists] = await Promise.all([
    cachedRankedKeywords(self, 50),
    ...cohort.map((d) => cachedRankedKeywords(d, 50)),
  ]);

  // Subject's best position per keyword.
  const subjectPos = new Map<string, number>();
  for (const k of subjectKw) {
    if (k.position <= 0) continue;
    const cur = subjectPos.get(k.keyword);
    if (cur == null || k.position < cur) subjectPos.set(k.keyword, k.position);
  }

  // `opts.brandNames` (facts.listing.name — the subject's REAL captured name)
  // joins the brand vocabulary too, via the ONE shared fold-in in `brandTokensFor`
  // itself — the exact call the free footprint classifier makes with ITS OWN
  // brandNames, so the two engines can never drift on what "brand" means (RC1).
  // Without this, a subject whose domain label is unusable/wrong (x.com's real
  // brand is "twitter", not "x") had its own brand queries counted as a RIVAL's
  // gap keyword here even after the free classifier was fixed.
  const brands = brandTokensFor([self, ...cohort], opts.brandNames ?? []);

  // Aggregate competitor rankings per keyword (best position per competitor).
  const agg = new Map<string, { volume: number; comps: Map<string, { position: number; url: string }> }>();
  cohort.forEach((domain, i) => {
    for (const k of (compKwLists[i] ?? [])) {
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
    if (competitors.length === 0) continue;
    const bestPosition = competitors[0]!.position;
    const subjPos = subjectPos.get(keyword) ?? null;

    if (subjPos == null) {
      const opportunity = Math.log1p(e.volume) * competitors.length * ((WINNING_POSITION + 1 - bestPosition) / WINNING_POSITION);
      gaps.push({ keyword, volume: e.volume, subjectPosition: null, bestPosition, competitorsRanking: competitors.length, competitors: competitors.slice(0, 5), opportunity });
    } else if (subjPos > bestPosition) {
      shared.push({ keyword, volume: e.volume, subjectPosition: subjPos, bestCompetitor: competitors[0]!.domain, bestPosition });
    }
  }
  // Lead with cross-referenced consensus: keywords MULTIPLE rivals rank for are
  // genuine category opportunities (single-rival ones are often brand/navigational).
  gaps.sort((a, b) => b.competitorsRanking - a.competitorsRanking || b.opportunity - a.opportunity);
  shared.sort((a, b) => b.volume - a.volume);

  const competitors: DomainKwSummary[] = cohort.map((domain, i) => {
    const kwList = compKwLists[i] ?? [];
    return {
      domain,
      rankedFor: kwList.length,
      topVolume: Math.max(0, ...kwList.map((k) => k.volume)),
    };
  });

  const result: KeywordGapResult = {
    category: closest.category,
    subject: { domain: self, rankedFor: subjectKw.length },
    competitors,
    gaps: gaps.slice(0, 40),
    shared: shared.slice(0, 20),
  };

  // Stage fired after computing gaps — carries real count as detail.
  opts.onStage?.({ key: "kw:gaps", label: "Finding keyword gaps", detail: `${result.gaps.length} gaps your rivals win` });

  return result;
}
