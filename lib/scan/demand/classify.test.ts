import { describe, it, expect } from "vitest";
import { intentLabelToScore, parseClassifications, buildClassifyPrompt } from "./classify";
import type { DemandHit } from "./types";

function hit(i: number): DemandHit {
  return { title: `t${i}`, url: `https://x/${i}`, snippet: `s${i}`, subreddit: null, query: "q" };
}

describe("intentLabelToScore", () => {
  it("maps labels to scores; unknown → 0", () => {
    expect(intentLabelToScore("high")).toBe(0.9);
    expect(intentLabelToScore("Medium")).toBe(0.6);
    expect(intentLabelToScore("low")).toBe(0.3);
    expect(intentLabelToScore("none")).toBe(0);
    expect(intentLabelToScore("garbage")).toBe(0);
  });
});

describe("parseClassifications", () => {
  const hits = [hit(0), hit(1), hit(2)];

  it("aligns results by index and zeroes intent on non-pain", () => {
    const raw = JSON.stringify({
      results: [
        { i: 0, buyerPain: true, intent: "high" },
        { i: 1, buyerPain: false, intent: "high" }, // not pain → intent 0
      ],
    });
    const out = parseClassifications(raw, hits);
    expect(out[0]).toMatchObject({ isBuyerPain: true, intent: 0.9 });
    expect(out[1]).toMatchObject({ isBuyerPain: false, intent: 0 });
    // index 2 missing from results → defaults to non-pain
    expect(out[2]).toMatchObject({ isBuyerPain: false, intent: 0 });
  });

  it("defaults every hit to non-pain on malformed JSON", () => {
    const out = parseClassifications("nonsense", hits);
    expect(out).toHaveLength(3);
    expect(out.every((h) => !h.isBuyerPain && h.intent === 0)).toBe(true);
  });
});

describe("buildClassifyPrompt", () => {
  it("numbers the hits and embeds the problem", () => {
    const p = buildClassifyPrompt("no users find my app", [hit(0), hit(1)]);
    expect(p).toContain("no users find my app");
    expect(p).toContain("0. t0");
    expect(p).toContain("1. t1");
  });
});
