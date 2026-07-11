import { describe, it, expect } from "vitest";
import { enrichReferrers } from "./referrer-enrich";
import type { QualityReferrer } from "./funnel";

const ref = (over: Partial<QualityReferrer>): QualityReferrer => ({
  host: "g2.com", category: "marketplace", url: "https://g2.com/p", anchor: "x",
  target: "https://rival.com/a", authority: 800, dofollow: true, ...over,
});

describe("enrichReferrers", () => {
  it("attaches platform reach from the ETV map, null when the host is absent", () => {
    const out = enrichReferrers([ref({ host: "g2.com" }), ref({ host: "unknown.io" })],
      new Map([["g2.com", 95000]]));
    expect(out[0]!.etv).toBe(95000);
    expect(out[1]!.etv).toBeNull(); // never invents a number
  });

  it("tags a tiny, low-authority referrer as low relevance", () => {
    const out = enrichReferrers([ref({ host: "tiny.blog", authority: 40 })], new Map([["tiny.blog", 10]]));
    expect(out[0]!.relevance).toBe("low");
  });

  it("keeps a high-reach or high-authority referrer as core", () => {
    const strongReach = enrichReferrers([ref({ host: "g2.com", authority: 40 })], new Map([["g2.com", 95000]]));
    const strongAuth = enrichReferrers([ref({ host: "g2.com", authority: 800 })], new Map());
    expect(strongReach[0]!.relevance).toBe("core");
    expect(strongAuth[0]!.relevance).toBe("core");
  });

  it("does not mutate the input array/objects", () => {
    const input = [ref({ host: "g2.com" })];
    const snapshot = JSON.stringify(input);
    enrichReferrers(input, new Map([["g2.com", 95000]]));
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});
