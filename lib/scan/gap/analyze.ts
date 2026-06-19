/**
 * Gap analysis (M4) — the engine (PURE).
 *
 * Compares the user's DistributionProfile against their prominent rivals' and
 * surfaces the actionable gaps: channels the rivals run that you don't, channels
 * you've let go dormant, communities you're absent from, and your SEO standing —
 * plus where the demand is. No I/O; fully unit-testable.
 */

import type { ChannelKind, ContentChannel, DistributionProfile } from "@/lib/scan/profile/types";
import type { DemandPocket } from "@/lib/scan/demand/types";
import type {
  ChannelMatrixRow,
  ChannelGap,
  CommunityGap,
  GapAnalysis,
  GapState,
  SeoGap,
  ShareOfVoice,
  KeywordGapRow,
} from "./types";

const ALL_CHANNELS: ChannelKind[] = [
  "blog",
  "youtube",
  "newsletter",
  "devto",
  "medium",
  "github",
  "podcast",
];

function findChannel(p: DistributionProfile, kind: ChannelKind): ContentChannel | undefined {
  return p.channels.find((c) => c.kind === kind);
}

/** A channel counts as "active" by its cadence; channels we don't measure
 *  cadence for (github, newsletter, …) count active simply by being present. */
function channelActive(c: ContentChannel | undefined): boolean {
  if (!c) return false;
  return c.cadence ? c.cadence.active : true;
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/** Sum of community mentions across a profile's surfaces. */
function totalMentions(p: DistributionProfile): number {
  return p.communities.reduce((sum, c) => sum + (c.mentions ?? 0), 0);
}

/**
 * Keyword gap: keywords rivals rank for that the subject doesn't. Aggregated
 * across the cohort (more rivals ranking + higher volume = higher up), capped.
 * Empty when no ranked-keyword data (the light/free pass omits it). PURE.
 */
export function keywordGap(
  self: DistributionProfile,
  competitors: DistributionProfile[],
  cap = 15,
): KeywordGapRow[] {
  const selfKeywords = new Set((self.seo?.rankedKeywords ?? []).map((k) => k.keyword.toLowerCase()));
  const agg = new Map<string, KeywordGapRow>();
  for (const c of competitors) {
    for (const k of c.seo?.rankedKeywords ?? []) {
      const key = k.keyword.toLowerCase();
      if (selfKeywords.has(key)) continue;
      const existing = agg.get(key);
      if (existing) {
        existing.rivalsRanking += 1;
        existing.volume = Math.max(existing.volume, k.volume);
        existing.bestRivalPosition = Math.min(existing.bestRivalPosition, k.position || Infinity);
      } else {
        agg.set(key, {
          keyword: k.keyword,
          volume: k.volume,
          rivalsRanking: 1,
          bestRivalPosition: k.position || Infinity,
        });
      }
    }
  }
  return [...agg.values()]
    .map((r) => ({ ...r, bestRivalPosition: Number.isFinite(r.bestRivalPosition) ? r.bestRivalPosition : 0 }))
    // Most-validated first (more rivals), then by volume.
    .sort((a, b) => b.rivalsRanking - a.rivalsRanking || b.volume - a.volume)
    .slice(0, cap);
}

/** Share-of-Voice: your community mentions vs each rival's, as a share of the
 *  cohort total. Returns null when nobody has any mentions (avoids 0/0). PURE. */
export function shareOfVoice(
  self: DistributionProfile,
  competitors: DistributionProfile[],
): ShareOfVoice | null {
  const selfMentions = totalMentions(self);
  const rivalCounts = competitors.map((c) => ({ domain: c.domain, mentions: totalMentions(c) }));
  const total = selfMentions + rivalCounts.reduce((s, r) => s + r.mentions, 0);
  if (total === 0) return null;
  return {
    selfPct: selfMentions / total,
    rivals: rivalCounts.map((r) => ({ domain: r.domain, mentions: r.mentions, pct: r.mentions / total })),
    selfMentions,
    totalMentions: total,
  };
}

/** Compute the full gap analysis. PURE. */
export function analyzeGap(
  self: DistributionProfile,
  competitors: DistributionProfile[],
  demandPockets: DemandPocket[] = [],
): GapAnalysis {
  const total = competitors.length;

  const channelMatrix: ChannelMatrixRow[] = ALL_CHANNELS.map((kind) => {
    const selfCh = findChannel(self, kind);
    const compChannels = competitors.map((c) => findChannel(c, kind));
    return {
      kind,
      self: {
        present: !!selfCh,
        active: channelActive(selfCh),
        postsPerMonth: selfCh?.cadence?.postsPerMonth ?? null,
      },
      competitorsPresent: compChannels.filter(Boolean).length,
      competitorsActive: compChannels.filter((c) => channelActive(c)).length,
      total,
    };
  });

  // Channel gaps: rivals are active here and you are absent / dormant / behind.
  const channelGaps: ChannelGap[] = [];
  for (const row of channelMatrix) {
    if (row.competitorsActive === 0) continue;
    let state: GapState | null = null;
    if (!row.self.present) state = "absent";
    else if (!row.self.active) state = "dormant";
    else {
      // present + active: behind only if rivals clearly out-publish you.
      const rivalMedian = median(
        competitors
          .map((c) => findChannel(c, row.kind)?.cadence?.postsPerMonth)
          .filter((n): n is number => typeof n === "number"),
      );
      const mine = row.self.postsPerMonth ?? 0;
      if (rivalMedian > 0 && mine < rivalMedian / 2) state = "behind";
    }
    if (!state) continue;
    channelGaps.push({
      kind: row.kind,
      competitorsActive: row.competitorsActive,
      total,
      state,
      prevalence: total > 0 ? row.competitorsActive / total : 0,
    });
  }
  // Rank: most rivals first (most-validated channels to enter), absent > dormant > behind.
  const stateRank: Record<GapState, number> = { absent: 0, dormant: 1, behind: 2 };
  channelGaps.sort(
    (a, b) => b.competitorsActive - a.competitorsActive || stateRank[a.state] - stateRank[b.state],
  );

  // Community gaps.
  const communityGaps: CommunityGap[] = (["hacker_news", "reddit"] as const).map((source) => {
    const selfActive = self.communities.some((c) => c.source === source && c.active);
    const competitorsActive = competitors.filter((c) =>
      c.communities.some((cp) => cp.source === source && cp.active),
    ).length;
    return { source, competitorsActive, total, selfActive };
  });

  // SEO standing vs the rival median.
  let seo: SeoGap | null = null;
  const selfKw = self.seo?.organicKeywords ?? null;
  const rivalKw = competitors.map((c) => c.seo?.organicKeywords).filter((n): n is number => typeof n === "number");
  if (selfKw !== null && rivalKw.length > 0) {
    const med = median(rivalKw);
    seo = { selfKeywords: selfKw, medianCompetitorKeywords: med, ratio: med > 0 ? selfKw / med : 0 };
  }

  return {
    channelMatrix,
    channelGaps,
    communityGaps,
    seo,
    shareOfVoice: shareOfVoice(self, competitors),
    keywordGap: keywordGap(self, competitors),
    demandPockets,
  };
}
