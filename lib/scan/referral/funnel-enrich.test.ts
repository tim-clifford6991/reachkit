import { describe, it, expect } from "vitest";
import { applyFunnelEnrichment } from "./funnel";
import type { FunnelResult } from "./funnel";

function baseResult(): FunnelResult {
  const bd = (byCategory: Record<string, number>, hosts: string[]) => ({
    sampled: hosts.length, byCategory,
    topQualityReferrers: hosts.map((h) => ({ host: h, category: "marketplace" as const, url: `https://${h}/p`, anchor: "a", target: "https://x.com", authority: 800, dofollow: true })),
    qualityShare: 1,
  });
  return {
    subject: { domain: "you.com", isSubject: true, monthlyTraffic: 0, score: 10, band: "b", mix: null, paidEtv: 0, brandedSearchVolume: 0, topPagesCount: 0, lens: null, category: "notetaking", backlinks: bd({ marketplace: 1 }, ["g2.com"]) },
    category: "notetaking",
    competitors: [{ domain: "rival.com", isSubject: false, monthlyTraffic: 100, score: 50, band: "b", mix: null, paidEtv: 0, brandedSearchVolume: 0, topPagesCount: 0, lens: null, closeness: 1, reason: "", backlinks: bd({ marketplace: 8 }, ["g2.com", "capterra.com"]) }],
    discoveryChannels: {}, channelsMissing: [],
    channelStrength: {},
  };
}

describe("applyFunnelEnrichment", () => {
  it("attaches reach+relevance to every entity's referrers and a channelStrength row per domain", () => {
    const out = applyFunnelEnrichment(baseResult(), new Map([["g2.com", 95000], ["capterra.com", 60000]]));
    expect(out.subject.backlinks.topQualityReferrers[0]!.etv).toBe(95000);
    expect(out.competitors[0]!.backlinks.topQualityReferrers[0]!.relevance).toBe("core");
    expect(out.channelStrength["you.com"]!.reviews).toBe("lo");   // 1 marketplace
    expect(out.channelStrength["rival.com"]!.reviews).toBe("hi"); // 8 marketplace
  });

  it("leaves etv null for hosts missing from the reach map (no invented number)", () => {
    const out = applyFunnelEnrichment(baseResult(), new Map());
    expect(out.subject.backlinks.topQualityReferrers[0]!.etv).toBeNull();
  });
});
