/**
 * Gap analysis (M4) — shared types.
 *
 * Turns the cohort (the user's DistributionProfile + their prominent rivals')
 * and the demand sweep into the founder's answer: where your competitors show
 * up that you don't, where they post more, and where the demand is — the input
 * to the distribution plan.
 */

import type { ChannelKind, DistributionProfile } from "@/lib/scan/profile/types";
import type { DemandPocket } from "@/lib/scan/demand/types";

/** One channel row of the you-vs-rivals presence matrix. */
export interface ChannelMatrixRow {
  kind: ChannelKind;
  self: { present: boolean; active: boolean; postsPerMonth: number | null };
  /** How many competitors have this channel at all. */
  competitorsPresent: number;
  /** How many competitors are ACTIVELY using it. */
  competitorsActive: number;
  total: number;
}

export type GapState = "absent" | "dormant" | "behind";

/** A channel where rivals are present/active and you are not (or are behind). */
export interface ChannelGap {
  kind: ChannelKind;
  competitorsActive: number;
  total: number;
  state: GapState;
  /** competitorsActive / total — share of rivals on this channel. */
  prevalence: number;
}

export interface CommunityGap {
  source: "hacker_news" | "reddit";
  competitorsActive: number;
  total: number;
  selfActive: boolean;
}

export interface SeoGap {
  selfKeywords: number;
  medianCompetitorKeywords: number;
  /** self / median (0 when no competitor data). */
  ratio: number;
}

export interface GapAnalysis {
  channelMatrix: ChannelMatrixRow[];
  /** Ranked: the channels to enter/revive first. */
  channelGaps: ChannelGap[];
  communityGaps: CommunityGap[];
  seo: SeoGap | null;
  /** Top demand pockets (where buyers are already asking), if a sweep ran. */
  demandPockets: DemandPocket[];
}

export type { DistributionProfile };
