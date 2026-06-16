import { describe, it, expect } from "vitest";
import { analyzeGap } from "./analyze";
import type { DistributionProfile, ContentChannel, ChannelKind } from "@/lib/scan/profile/types";

function ch(kind: ChannelKind, active: boolean | null, postsPerMonth = 4): ContentChannel {
  const c: ContentChannel = { kind, label: kind, url: `https://x/${kind}` };
  if (active !== null) {
    c.cadence = {
      totalPosts: 10,
      postsLast30: active ? 4 : 0,
      postsLast90: active ? 12 : 0,
      lastPublishedAt: "2026-06-01T00:00:00Z",
      postsPerMonth,
      active,
    };
  }
  return c;
}

function profile(
  domain: string,
  channels: ContentChannel[],
  opts: { keywords?: number; communities?: Array<{ source: "hacker_news" | "reddit"; active: boolean }> } = {},
): DistributionProfile {
  return {
    domain,
    channels,
    communities: (opts.communities ?? []).map((c) => ({
      source: c.source,
      mentions: 5,
      lastSeen: "2026-06-01T00:00:00Z",
      active: c.active,
      topThreads: [],
    })),
    seo: opts.keywords !== undefined ? { organicKeywords: opts.keywords, etv: 0, authority: null, referringDomains: null } : null,
    crawledAt: "2026-06-16T00:00:00Z",
  };
}

describe("analyzeGap", () => {
  it("flags absent + dormant channels where rivals are active, ranked by prevalence", () => {
    const self = profile("me.com", [ch("blog", false), ch("github", null)], { keywords: 100 });
    const competitors = [
      profile("a.com", [ch("youtube", true), ch("blog", true)], { keywords: 1000 }),
      profile("b.com", [ch("youtube", true), ch("blog", true)], { keywords: 2000 }),
      profile("c.com", [ch("blog", true)], { keywords: 1500 }),
    ];

    const gap = analyzeGap(self, competitors);

    // blog: all 3 rivals active, I'm dormant. youtube: 2 active, I'm absent.
    expect(gap.channelGaps.map((g) => [g.kind, g.state, g.competitorsActive])).toEqual([
      ["blog", "dormant", 3],
      ["youtube", "absent", 2],
    ]);
    // github isn't a gap (no rival uses it).
    expect(gap.channelGaps.find((g) => g.kind === "github")).toBeUndefined();
  });

  it("flags 'behind' when present+active but out-published by the rival median", () => {
    const self = profile("me.com", [ch("blog", true, 1)]); // 1 post/mo
    const competitors = [
      profile("a.com", [ch("blog", true, 8)]),
      profile("b.com", [ch("blog", true, 10)]),
    ];
    const gap = analyzeGap(self, competitors);
    const blog = gap.channelGaps.find((g) => g.kind === "blog");
    expect(blog?.state).toBe("behind"); // 1 < median(8,10)/2 = 4.5
  });

  it("computes community gaps and SEO standing vs the rival median", () => {
    const self = profile("me.com", [], { keywords: 200, communities: [{ source: "reddit", active: false }] });
    const competitors = [
      profile("a.com", [], { keywords: 1000, communities: [{ source: "reddit", active: true }] }),
      profile("b.com", [], { keywords: 3000, communities: [{ source: "reddit", active: true }] }),
    ];
    const gap = analyzeGap(self, competitors);

    const reddit = gap.communityGaps.find((c) => c.source === "reddit")!;
    expect(reddit).toMatchObject({ competitorsActive: 2, selfActive: false });
    expect(gap.seo).toEqual({ selfKeywords: 200, medianCompetitorKeywords: 2000, ratio: 0.1 });
  });

  it("includes the channel matrix for every channel kind", () => {
    const gap = analyzeGap(profile("me.com", []), []);
    expect(gap.channelMatrix.map((r) => r.kind)).toEqual([
      "blog",
      "youtube",
      "newsletter",
      "devto",
      "medium",
      "github",
      "podcast",
    ]);
  });
});
