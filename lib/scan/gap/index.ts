/**
 * Gap analysis (M4) — public surface.
 *
 * analyzeGap(self, competitors, demandPockets) → the you-vs-rivals gaps.
 * buildPlan(gap) → the ranked, grounded distribution plan.
 */

export { analyzeGap, shareOfVoice } from "./analyze";
export { buildPlan, type PlanItem, type DistributionPlan } from "./plan";
export { runMarketAnalysis, type MarketAnalysis } from "./run";
export type {
  GapAnalysis,
  ChannelMatrixRow,
  ChannelGap,
  CommunityGap,
  SeoGap,
  ShareOfVoice,
  GapState,
} from "./types";
