/**
 * Competitive framing helpers (pure).
 *
 * `buildLossFrame` turns the per-competitor community-mention gap
 * (`whereTheyAre.competitorGap`) into a single named, loss-framed hook for the
 * score block and upgrade CTA — "you're behind {leader} where your buyers talk".
 *
 * Loss aversion converts ~2× a neutral number, but ONLY when the claim is
 * credible: it returns `null` whenever no competitor actually out-mentions the
 * subject (cold-start scans with all-zero gaps), so the caller falls back to the
 * neutral score and never cries wolf.
 */

import type { ReportPayload } from "@/lib/scan/report";

type CompetitorGap = ReportPayload["whereTheyAre"]["competitorGap"];

export interface LossFrame {
  /** The rival you trail by the widest community-mention margin. */
  leaderName: string;
  /** That rival's mention count. */
  leaderThem: number;
  /** Your mention count vs that rival. */
  you: number;
  /** How many tracked competitors out-mention you. */
  behindCount: number;
  /** Total tracked competitors. */
  totalCount: number;
  /** leaderThem - you (always > 0). */
  deficit: number;
}

/**
 * Derive the loss-framed hook from the competitor-gap rows.
 *
 * Leader = the competitor with the largest positive `them - you` deficit.
 * Returns `null` when no competitor out-mentions the subject (no credible loss).
 */
export function buildLossFrame(competitorGap: CompetitorGap | undefined): LossFrame | null {
  if (!competitorGap || competitorGap.length === 0) return null;

  let leader: { name: string; them: number; you: number; deficit: number } | null = null;
  let behindCount = 0;

  for (const g of competitorGap) {
    const deficit = g.them - g.you;
    if (deficit <= 0) continue;
    behindCount += 1;
    if (!leader || deficit > leader.deficit) {
      leader = { name: g.competitor, them: g.them, you: g.you, deficit };
    }
  }

  if (!leader) return null;

  return {
    leaderName: leader.name,
    leaderThem: leader.them,
    you: leader.you,
    behindCount,
    totalCount: competitorGap.length,
    deficit: leader.deficit,
  };
}

/**
 * One-line loss headline derived from a {@link LossFrame}. Pure/presentation-free
 * so it can be unit-tested and reused by the score block and the upgrade CTA.
 */
export function lossHeadline(frame: LossFrame): string {
  const others = frame.behindCount - 1;
  if (others <= 0) {
    return `You're behind ${frame.leaderName} where your buyers actually talk.`;
  }
  return `You're behind ${frame.leaderName} and ${others} other rival${
    others === 1 ? "" : "s"
  } where your buyers actually talk.`;
}
