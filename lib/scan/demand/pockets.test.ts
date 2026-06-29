import { describe, it, expect } from "vitest";
import { clusterIntoPockets, pocketKey, pocketScore, recencyWeight } from "./pockets";
import type { ClassifiedHit } from "./types";

const NOW = Date.UTC(2026, 5, 16); // fixed "now" for deterministic recency
const RECENT = new Date(NOW).toISOString();
const daysAgo = (d: number) => new Date(NOW - d * 86_400_000).toISOString();

function hit(p: Partial<ClassifiedHit>): ClassifiedHit {
  return {
    title: p.title ?? "t",
    url: p.url ?? "https://reddit.com/r/SaaS/comments/1/x",
    snippet: p.snippet ?? "",
    subreddit: p.subreddit ?? null,
    platform: p.platform ?? "Reddit",
    theme: p.theme ?? "Problem",
    query: p.query ?? "q",
    publishedAt: p.publishedAt ?? RECENT, // default fresh → weight 1.0
    isBuyerPain: p.isBuyerPain ?? true,
    intent: p.intent ?? 0.6,
  };
}

describe("pocketKey", () => {
  it("prefers the subreddit", () => {
    expect(pocketKey(hit({ subreddit: "r/SaaS" }))).toBe("r/SaaS");
  });
  it("falls back to the URL host (www stripped)", () => {
    expect(pocketKey(hit({ subreddit: null, url: "https://www.indiehackers.com/post/9" }))).toBe(
      "indiehackers.com",
    );
  });
  it("returns 'other' for an unparseable URL", () => {
    expect(pocketKey(hit({ subreddit: null, url: "not a url" }))).toBe("other");
  });
});

describe("recencyWeight", () => {
  it("decays with age; unknown dates get a mild penalty", () => {
    expect(recencyWeight(RECENT, NOW)).toBe(1);
    expect(recencyWeight(daysAgo(60), NOW)).toBe(0.85);
    expect(recencyWeight(daysAgo(300), NOW)).toBe(0.35);
    expect(recencyWeight(daysAgo(900), NOW)).toBe(0.05);
    expect(recencyWeight(null, NOW)).toBe(0.7);
    expect(recencyWeight("garbage", NOW)).toBe(0.7);
  });
});

describe("pocketScore", () => {
  it("rewards reach with diminishing returns", () => {
    expect(pocketScore(0.9, 1)).toBeCloseTo(0.9, 5);
    expect(pocketScore(1.8, 10)).toBeCloseTo(3.6, 5);
  });
});

describe("clusterIntoPockets", () => {
  it("groups fresh buyer-pain hits by subreddit and drops non-pain + noise", () => {
    const pockets = clusterIntoPockets(
      [
        hit({ subreddit: "r/SaaS", intent: 0.9, url: "https://reddit.com/r/SaaS/a" }),
        hit({ subreddit: "r/SaaS", intent: 0.6, url: "https://reddit.com/r/SaaS/b" }),
        hit({ subreddit: "r/startups", intent: 0.3, url: "https://reddit.com/r/startups/c" }),
        hit({ subreddit: "r/noise", isBuyerPain: false, intent: 0, url: "https://reddit.com/r/noise/d" }),
      ],
      NOW,
    );
    expect(pockets.map((p) => p.surface)).toEqual(["r/SaaS", "r/startups"]);
    const saas = pockets[0]!;
    expect(saas.count).toBe(2);
    expect(saas.intentSum).toBeCloseTo(1.5, 5); // both fresh → weight 1.0
    expect(saas.topThreads[0]?.intent).toBe(0.9);
    expect(pockets.find((p) => p.surface === "r/noise")).toBeUndefined();
  });

  it("ranks a fresh pocket above a higher-raw-intent stale one (recency wins)", () => {
    const pockets = clusterIntoPockets(
      [
        hit({ subreddit: "r/fresh", intent: 0.6, publishedAt: RECENT, url: "https://reddit.com/r/fresh/a" }),
        hit({ subreddit: "r/stale", intent: 0.9, publishedAt: daysAgo(900), url: "https://reddit.com/r/stale/b" }),
      ],
      NOW,
    );
    // r/fresh: 0.6*1.0=0.6 ; r/stale: 0.9*0.05=0.045 → fresh ranks first
    expect(pockets[0]?.surface).toBe("r/fresh");
    expect(pockets[1]?.intentSum).toBeCloseTo(0.045, 5);
  });

  it("returns an empty array when nothing is buyer pain", () => {
    expect(clusterIntoPockets([hit({ isBuyerPain: false, intent: 0 })], NOW)).toEqual([]);
  });

  it("caps topThreads at 5", () => {
    const hits = Array.from({ length: 8 }, (_, i) =>
      hit({ subreddit: "r/big", intent: i / 10, url: `https://reddit.com/r/big/${i}` }),
    );
    const [pocket] = clusterIntoPockets(hits, NOW);
    expect(pocket?.count).toBe(8);
    expect(pocket?.topThreads).toHaveLength(5);
  });
});
