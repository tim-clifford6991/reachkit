import { describe, it, expect } from "vitest";
import { attachActivity } from "./index";
import type { DemandPocket } from "./types";

const pocket = (urls: string[]): DemandPocket => ({
  surface: "r/SaaS", platform: "Reddit", subreddit: "r/SaaS", count: urls.length, intentSum: 1, score: 1,
  topThreads: urls.map((u) => ({ title: "t", url: u, intent: .8, publishedAt: null, theme: "x" })),
});

describe("attachActivity", () => {
  it("attaches activity by url and leaves unknown threads null (no invention)", () => {
    const out = attachActivity([pocket(["a", "b"])], new Map([["a", { score: 9, comments: 2 }]]));
    expect(out[0]!.topThreads[0]!.activity).toEqual({ score: 9, comments: 2 });
    expect(out[0]!.topThreads[1]!.activity).toBeNull();
  });
  it("does not mutate the input", () => {
    const input = [pocket(["a"])]; const snap = JSON.stringify(input);
    attachActivity(input, new Map([["a", { score: 1, comments: 1 }]]));
    expect(JSON.stringify(input)).toBe(snap);
  });
});
