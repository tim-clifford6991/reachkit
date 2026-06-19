import { describe, it, expect } from "vitest";
import { buildPlan } from "./plan";
import type { GapAnalysis } from "./types";

const gap: GapAnalysis = {
  channelMatrix: [],
  channelGaps: [
    { kind: "youtube", competitorsActive: 4, total: 5, state: "absent", prevalence: 0.8 },
    { kind: "blog", competitorsActive: 2, total: 5, state: "dormant", prevalence: 0.4 },
  ],
  communityGaps: [
    { source: "reddit", competitorsActive: 3, total: 5, selfActive: false },
    { source: "hacker_news", competitorsActive: 0, total: 5, selfActive: false },
  ],
  seo: { selfKeywords: 100, medianCompetitorKeywords: 1000, ratio: 0.1 },
  shareOfVoice: null,
  demandPockets: [
    { surface: "r/SaaS", subreddit: "r/SaaS", count: 8, intentSum: 5, score: 6, topThreads: [] },
  ],
};

describe("buildPlan", () => {
  it("ranks by priority: validated channels → demand → community → seo", () => {
    const plan = buildPlan(gap);
    expect(plan.items.map((i) => `${i.kind}:${i.title}`)).toEqual([
      "channel:Start a YouTube channel", // 140
      "channel:Revive your blog", // 119
      "demand:Show up in r/SaaS", // 96
      "community:Get active on Reddit", // 75
      "seo:Close the SEO gap", // 50
    ]);
  });

  it("grounds the 'why' in rival counts", () => {
    const plan = buildPlan(gap);
    expect(plan.items[0]?.why).toBe(
      "4 of 5 prominent rivals actively use this channel — you have none.",
    );
  });

  it("omits the community gap where no rival is active, and SEO when not behind", () => {
    const noGap = buildPlan({
      ...gap,
      communityGaps: [{ source: "hacker_news", competitorsActive: 0, total: 5, selfActive: false }],
      seo: { selfKeywords: 900, medianCompetitorKeywords: 1000, ratio: 0.9 },
    });
    expect(noGap.items.find((i) => i.kind === "community")).toBeUndefined();
    expect(noGap.items.find((i) => i.kind === "seo")).toBeUndefined();
  });
});
