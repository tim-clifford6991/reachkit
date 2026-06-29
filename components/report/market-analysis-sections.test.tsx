import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MarketAnalysisSections } from "./market-analysis-sections";
import type { MarketAnalysis } from "@/lib/scan/gap";
import type { DistributionProfile } from "@/lib/scan/profile";

function prof(domain: string, keywords: number | null, blogActive: boolean): DistributionProfile {
  return {
    domain,
    channels: [
      {
        kind: "blog",
        label: "Blog",
        url: `https://${domain}/`,
        cadence: {
          totalPosts: 20,
          postsLast30: blogActive ? 4 : 0,
          postsLast90: blogActive ? 12 : 0,
          lastPublishedAt: "2026-06-01T00:00:00Z",
          postsPerMonth: 4,
          active: blogActive,
        },
      },
    ],
    communities: [
      { source: "hacker_news", mentions: 5, lastSeen: "2026-06-01T00:00:00Z", active: true, topThreads: [] },
    ],
    seo: keywords === null ? null : { organicKeywords: keywords, etv: 0, authority: null, referringDomains: null },
    crawledAt: "2026-06-16T00:00:00Z",
  };
}

const market: MarketAnalysis = {
  cohort: {
    self: prof("me.com", 100, false),
    competitors: [prof("ahrefs.com", 1_500_000, true)],
    competitorDomains: ["ahrefs.com"],
    product: { name: "Me", description: "an SEO tool" },
  },
  demand: { painQueries: [], pockets: [], totalHits: 5, buyerPainHits: 3 },
  gap: {
    channelMatrix: [
      { kind: "youtube", self: { present: false, active: false, postsPerMonth: null }, competitorsPresent: 1, competitorsActive: 1, total: 1 },
    ],
    channelGaps: [],
    communityGaps: [],
    seo: null,
    shareOfVoice: null,
    keywordGap: [],
    demandPockets: [
      {
        surface: "r/SEO",
        platform: "Reddit",
        subreddit: "r/SEO",
        count: 4,
        intentSum: 3,
        score: 5,
        topThreads: [{ title: "how do I get found", url: "https://reddit.com/r/SEO/x", intent: 0.9, publishedAt: "2026-06-10T00:00:00Z", theme: "Problem" }],
      },
    ],
  },
  plan: { items: [{ kind: "channel", title: "Start a YouTube channel", why: "1 of 1 prominent rivals actively use this channel — you have none.", priority: 14, ease: 0.3, impact: 0.9, competition: 0.56, score: 0.14 }] },
};

describe("MarketAnalysisSections", () => {
  it("renders all four surfaces without throwing", () => {
    const html = renderToStaticMarkup(<MarketAnalysisSections market={market} />);
    expect(html).toContain("Your closest competitors");
    expect(html).toContain("ahrefs.com");
    expect(html).toContain("You vs them"); // channel matrix
    expect(html).toContain("1/1"); // rivals-active intensity count in the heatmap
    expect(html).toContain("Where your buyers are asking"); // demand pockets
    expect(html).toContain("r/SEO");
    expect(html).toContain("Your distribution plan");
    expect(html).toContain("Start a YouTube channel");
  });
});
