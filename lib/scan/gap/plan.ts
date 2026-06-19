/**
 * Distribution plan (M4) — turns the gap analysis into a ranked, grounded set of
 * "do this next" recommendations (PURE). Each item cites the evidence that drove
 * it (how many prominent rivals do it, where the demand is), so it never reads as
 * generic advice. The LLM content/draft layer for executing these is M5.
 */

import type { ChannelKind } from "@/lib/scan/profile/types";
import type { GapAnalysis, ChannelGap, GapState } from "./types";

export interface PlanItem {
  kind: "channel" | "community" | "seo" | "demand";
  title: string;
  why: string;
  /** Higher = do sooner. */
  priority: number;
  /** Effort inverse, 0..1 (1 = easiest to execute). */
  ease: number;
  /** Expected upside, 0..1 (1 = biggest needle-mover). */
  impact: number;
  /** How crowded/contested, 0..1 (1 = most saturated). */
  competition: number;
  /** Composite rank score = impact × ease × (1 − competition), 0..1. */
  score: number;
}

export interface DistributionPlan {
  items: PlanItem[];
}

// Per-channel ease (1 = easiest). Reddit/demand engagement is the easiest path;
// SEO + video are the slowest to show returns.
const CHANNEL_EASE: Record<ChannelKind, number> = {
  blog: 0.55,
  youtube: 0.3,
  newsletter: 0.5,
  devto: 0.7,
  medium: 0.7,
  github: 0.55,
  podcast: 0.4,
};

/** Combine the triad into the ChannelIntel composite (impact × ease × (1−comp)). */
function composite(impact: number, ease: number, competition: number): number {
  return impact * ease * (1 - competition);
}

const CHANNEL_ACTION: Record<ChannelKind, { absent: string; revive: string }> = {
  blog: { absent: "Start publishing a blog", revive: "Revive your blog" },
  youtube: { absent: "Start a YouTube channel", revive: "Get back to posting on YouTube" },
  newsletter: { absent: "Launch a newsletter", revive: "Restart your newsletter" },
  devto: { absent: "Cross-post articles to dev.to", revive: "Resume cross-posting to dev.to" },
  medium: { absent: "Cross-post articles to Medium", revive: "Resume cross-posting to Medium" },
  github: { absent: "Build in public on GitHub", revive: "Re-engage your GitHub presence" },
  podcast: { absent: "Get featured on podcasts", revive: "Get back on podcasts" },
};

function channelTitle(g: ChannelGap): string {
  const a = CHANNEL_ACTION[g.kind];
  return g.state === "absent" ? a.absent : a.revive;
}

function channelWhy(g: ChannelGap): string {
  const share = `${g.competitorsActive} of ${g.total} prominent rival${g.total === 1 ? "" : "s"}`;
  const states: Record<GapState, string> = {
    absent: `${share} actively use this channel — you have none.`,
    dormant: `Your channel is dormant while ${share} post there actively.`,
    behind: `${share} out-publish you here — increase your cadence.`,
  };
  return states[g.state];
}

// State weight — how much room you have to gain (absent = most upside).
const STATE_IMPACT: Record<GapState, number> = { absent: 1, dormant: 0.75, behind: 0.5 };

/** Build the ranked distribution plan from a gap analysis. PURE.
 *  Each item carries an Ease × Impact × Competition triad and is ranked by the
 *  composite score (impact × ease × (1 − competition)); `priority` is retained
 *  as the composite scaled to 0..100 for legacy consumers. */
export function buildPlan(gap: GapAnalysis): DistributionPlan {
  const items: PlanItem[] = [];

  const push = (
    base: Pick<PlanItem, "kind" | "title" | "why">,
    triad: { ease: number; impact: number; competition: number },
  ) => {
    const score = composite(triad.impact, triad.ease, triad.competition);
    items.push({ ...base, ...triad, score, priority: Math.round(score * 100) });
  };

  // Channel gaps — the core "where to show up".
  for (const g of gap.channelGaps) {
    push(
      { kind: "channel", title: channelTitle(g), why: channelWhy(g) },
      {
        // Impact: how much room you have (state) scaled by how validated it is (prevalence).
        impact: STATE_IMPACT[g.state] * (0.5 + 0.5 * g.prevalence),
        ease: CHANNEL_EASE[g.kind],
        // Competition: how crowded with rivals the channel already is.
        competition: g.prevalence * 0.7,
      },
    );
  }

  // Demand pockets — where buyers are already asking (open, low-competition, easy).
  for (const p of gap.demandPockets.slice(0, 5)) {
    push(
      {
        kind: "demand",
        title: `Show up in ${p.surface}`,
        why: `${p.count} live thread${p.count === 1 ? "" : "s"} where people describe your problem — engage with value, not a pitch.`,
      },
      { impact: Math.min(1, p.score / 20), ease: 0.8, competition: 0.2 },
    );
  }

  // Community gaps — rivals active where you're absent.
  for (const c of gap.communityGaps) {
    if (c.competitorsActive > 0 && !c.selfActive) {
      const where = c.source === "hacker_news" ? "Hacker News" : "Reddit";
      const prevalence = c.total > 0 ? c.competitorsActive / c.total : 0;
      push(
        {
          kind: "community",
          title: `Get active on ${where}`,
          why: `${c.competitorsActive} of ${c.total} rivals are discussed on ${where}; you're absent.`,
        },
        { impact: prevalence, ease: 0.65, competition: prevalence * 0.5 },
      );
    }
  }

  // SEO — only when you're clearly behind. Slow + contested but high-upside.
  if (gap.seo && gap.seo.ratio < 0.5 && gap.seo.medianCompetitorKeywords > 0) {
    push(
      {
        kind: "seo",
        title: "Close the SEO gap",
        why: `You rank for ${gap.seo.selfKeywords} keywords vs a rival median of ${gap.seo.medianCompetitorKeywords}.`,
      },
      { impact: 1 - gap.seo.ratio, ease: 0.3, competition: 0.7 },
    );
  }

  items.sort((a, b) => b.score - a.score);
  return { items };
}
