import { describe, it, expect } from "vitest";
import { computeMarketAlerts, summarizeMarket } from "./market";
import type { MarketAnalysis } from "@/lib/scan/gap";

type Summary = ReturnType<typeof summarizeMarket>;
const rival = (domain: string) => ({ domain, organicKeywords: 1, etv: 1, referringDomains: 1 });
const base = (over: Partial<Summary> = {}): Summary => ({
  self: rival("me.com"),
  rivals: [rival("a.com")],
  selfSharePct: 0.3,
  demandPocketCount: 4,
  keywordGapCount: 10,
  ...over,
});

describe("computeMarketAlerts", () => {
  it("returns [] on the first run (no prior snapshot)", () => {
    expect(computeMarketAlerts(null, base())).toEqual([]);
  });

  it("flags a newly-appeared competitor", () => {
    const alerts = computeMarketAlerts(base(), base({ rivals: [rival("a.com"), rival("b.com")] }));
    expect(alerts).toContainEqual({ kind: "competitor_launch", message: "New competitor in your space: b.com" });
  });

  it("flags a share-of-voice shift beyond the threshold, ignores small wobble", () => {
    expect(computeMarketAlerts(base({ selfSharePct: 0.3 }), base({ selfSharePct: 0.31 })).some((a) => a.kind === "mention_shift")).toBe(false);
    const big = computeMarketAlerts(base({ selfSharePct: 0.3 }), base({ selfSharePct: 0.42 }));
    expect(big.find((a) => a.kind === "mention_shift")?.message).toContain("up");
  });

  it("flags net-new keyword opportunities", () => {
    const alerts = computeMarketAlerts(base({ keywordGapCount: 10 }), base({ keywordGapCount: 13 }));
    expect(alerts.find((a) => a.kind === "keyword_opportunity")?.message).toContain("3 new keyword");
  });
});

describe("summarizeMarket", () => {
  it("distils a market analysis into the snapshot row", () => {
    const market = {
      cohort: {
        self: { domain: "me.com", channels: [], communities: [], seo: { organicKeywords: 100, etv: 5, authority: null, referringDomains: 9 }, crawledAt: "" },
        competitors: [{ domain: "a.com", channels: [], communities: [], seo: null, crawledAt: "" }],
        competitorDomains: ["a.com"],
        product: { name: "Me" },
      },
      demand: { painQueries: [], pockets: [{}, {}], totalHits: 0, buyerPainHits: 0 },
      gap: { channelMatrix: [], channelGaps: [], communityGaps: [], seo: null, shareOfVoice: { selfPct: 0.4, rivals: [], selfMentions: 2, totalMentions: 5 }, keywordGap: [{}, {}, {}], demandPockets: [] },
      plan: { items: [] },
    } as unknown as MarketAnalysis;

    expect(summarizeMarket(market)).toMatchObject({
      self: { domain: "me.com", organicKeywords: 100, referringDomains: 9 },
      selfSharePct: 0.4,
      demandPocketCount: 2,
      keywordGapCount: 3,
    });
  });
});
