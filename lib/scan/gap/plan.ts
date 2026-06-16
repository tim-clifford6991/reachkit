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
}

export interface DistributionPlan {
  items: PlanItem[];
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

/** Build the ranked distribution plan from a gap analysis. PURE. */
export function buildPlan(gap: GapAnalysis): DistributionPlan {
  const items: PlanItem[] = [];

  // Channel gaps — the core "where to show up". Priority by how many rivals validate it.
  for (const g of gap.channelGaps) {
    items.push({
      kind: "channel",
      title: channelTitle(g),
      why: channelWhy(g),
      priority: 100 + g.competitorsActive * 10 - (g.state === "absent" ? 0 : g.state === "dormant" ? 1 : 2),
    });
  }

  // Demand pockets — where buyers are already asking (highest-intent first).
  for (const p of gap.demandPockets.slice(0, 5)) {
    items.push({
      kind: "demand",
      title: `Show up in ${p.surface}`,
      why: `${p.count} live thread${p.count === 1 ? "" : "s"} where people describe your problem — engage with value, not a pitch.`,
      priority: 90 + Math.min(20, Math.round(p.score)),
    });
  }

  // Community gaps — rivals active where you're absent.
  for (const c of gap.communityGaps) {
    if (c.competitorsActive > 0 && !c.selfActive) {
      const where = c.source === "hacker_news" ? "Hacker News" : "Reddit";
      items.push({
        kind: "community",
        title: `Get active on ${where}`,
        why: `${c.competitorsActive} of ${c.total} rivals are discussed on ${where}; you're absent.`,
        priority: 60 + c.competitorsActive * 5,
      });
    }
  }

  // SEO — only when you're clearly behind.
  if (gap.seo && gap.seo.ratio < 0.5 && gap.seo.medianCompetitorKeywords > 0) {
    items.push({
      kind: "seo",
      title: "Close the SEO gap",
      why: `You rank for ${gap.seo.selfKeywords} keywords vs a rival median of ${gap.seo.medianCompetitorKeywords}.`,
      priority: 50,
    });
  }

  items.sort((a, b) => b.priority - a.priority);
  return { items };
}
