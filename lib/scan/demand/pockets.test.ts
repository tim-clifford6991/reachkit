import { describe, it, expect } from "vitest";
import { clusterIntoPockets, pocketKey, pocketScore } from "./pockets";
import type { ClassifiedHit } from "./types";

function hit(p: Partial<ClassifiedHit>): ClassifiedHit {
  return {
    title: p.title ?? "t",
    url: p.url ?? "https://reddit.com/r/SaaS/comments/1/x",
    snippet: p.snippet ?? "",
    subreddit: p.subreddit ?? null,
    query: p.query ?? "q",
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

describe("pocketScore", () => {
  it("rewards reach with diminishing returns", () => {
    // single hot thread vs many medium threads
    expect(pocketScore(0.9, 1)).toBeCloseTo(0.9, 5);
    expect(pocketScore(1.8, 10)).toBeCloseTo(3.6, 5); // 1.8 * (1 + log10(10)=1) = 3.6
  });
});

describe("clusterIntoPockets", () => {
  it("groups buyer-pain hits by subreddit and drops non-pain + noise", () => {
    const pockets = clusterIntoPockets([
      hit({ subreddit: "r/SaaS", intent: 0.9, url: "https://reddit.com/r/SaaS/a" }),
      hit({ subreddit: "r/SaaS", intent: 0.6, url: "https://reddit.com/r/SaaS/b" }),
      hit({ subreddit: "r/startups", intent: 0.3, url: "https://reddit.com/r/startups/c" }),
      hit({ subreddit: "r/noise", isBuyerPain: false, intent: 0, url: "https://reddit.com/r/noise/d" }),
    ]);
    expect(pockets.map((p) => p.surface)).toEqual(["r/SaaS", "r/startups"]); // sorted by score
    const saas = pockets[0]!;
    expect(saas.count).toBe(2);
    expect(saas.intentSum).toBeCloseTo(1.5, 5);
    expect(saas.topThreads[0]?.intent).toBe(0.9); // sorted by intent desc
    // the non-pain hit produced no pocket
    expect(pockets.find((p) => p.surface === "r/noise")).toBeUndefined();
  });

  it("returns an empty array when nothing is buyer pain", () => {
    expect(clusterIntoPockets([hit({ isBuyerPain: false, intent: 0 })])).toEqual([]);
  });

  it("caps topThreads at 5", () => {
    const hits = Array.from({ length: 8 }, (_, i) =>
      hit({ subreddit: "r/big", intent: i / 10, url: `https://reddit.com/r/big/${i}` }),
    );
    const [pocket] = clusterIntoPockets(hits);
    expect(pocket?.count).toBe(8);
    expect(pocket?.topThreads).toHaveLength(5);
  });
});
