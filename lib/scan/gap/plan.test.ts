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
  keywordGap: [],
  demandPockets: [
    { surface: "r/SaaS", platform: "Reddit", subreddit: "r/SaaS", count: 8, intentSum: 5, score: 6, topThreads: [] },
  ],
};

describe("buildPlan", () => {
  it("ranks by the Ease × Impact × Competition composite (easy, validated, uncontested first)", () => {
    const plan = buildPlan(gap);
    // Composite favours easier + less-saturated channels: Reddit + blog beat the
    // hard, rival-saturated YouTube; slow contested SEO sinks to the bottom.
    expect(plan.items.map((i) => `${i.kind}:${i.title}`)).toEqual([
      "community:Get active on Reddit",
      "channel:Revive your blog",
      "demand:Show up in r/SaaS",
      "channel:Start a YouTube channel",
      "seo:Close the SEO gap",
    ]);
    // Every item carries the triad + a 0..1 composite, sorted descending.
    for (const it of plan.items) {
      expect(it.score).toBeGreaterThanOrEqual(0);
      expect(it.score).toBeLessThanOrEqual(1);
      expect(it.score).toBeCloseTo(it.impact * it.ease * (1 - it.competition), 6);
    }
    const scores = plan.items.map((i) => i.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  });

  it("grounds the 'why' in rival counts", () => {
    const plan = buildPlan(gap);
    const youtube = plan.items.find((i) => i.title === "Start a YouTube channel");
    expect(youtube?.why).toBe(
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
