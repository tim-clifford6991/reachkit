import { describe, it, expect } from "vitest";
import { estimateTrafficMix } from "./traffic-mix";
import type { DistributionProfile } from "./types";

function prof(seo: DistributionProfile["seo"], mentions: number[]): DistributionProfile {
  return {
    domain: "x.com",
    channels: [],
    communities: mentions.map((m, i) => ({
      source: i % 2 ? "reddit" : "hacker_news",
      mentions: m,
      lastSeen: null,
      active: true,
      topThreads: [],
    })),
    seo,
    crawledAt: "2026-06-16T00:00:00Z",
  };
}

describe("estimateTrafficMix", () => {
  it("returns null with no SEO posture and no mentions", () => {
    expect(estimateTrafficMix(prof(null, []))).toBeNull();
  });

  it("attributes everything to direct when signals are all zero", () => {
    const mix = estimateTrafficMix(prof({ organicKeywords: 0, etv: 0, authority: null, referringDomains: 0 }, []))!;
    expect(mix).toMatchObject({ organic: 0, referral: 0, social: 0, direct: 1, estimated: true });
  });

  it("splits the non-direct share across organic/referral/social and always reserves a direct floor", () => {
    const mix = estimateTrafficMix(
      prof({ organicKeywords: 1000, etv: 500, authority: 50, referringDomains: 100 }, [20]),
    )!;
    const total = mix.organic + mix.referral + mix.social + mix.direct;
    expect(total).toBeCloseTo(1, 5);
    expect(mix.direct).toBeCloseTo(0.2, 5); // reserved floor
    expect(mix.organic).toBeGreaterThan(0);
    expect(mix.referral).toBeGreaterThan(0);
    expect(mix.social).toBeGreaterThan(0);
    expect(mix.estimated).toBe(true);
  });

  it("estimates from community mentions alone (no SEO)", () => {
    const mix = estimateTrafficMix(prof(null, [5, 5]))!;
    expect(mix.social).toBeGreaterThan(0);
    expect(mix.organic).toBe(0);
  });
});
