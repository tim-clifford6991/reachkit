import { describe, it, expect } from "vitest";
import { narrateShareOfVoice, narrateBenchmark, narrateKeywordGap, narrateTrafficMix } from "./narrate";
import type { ShareOfVoice, KeywordGapRow } from "./types";

const sov = (pct: number): ShareOfVoice => ({ selfPct: pct, rivals: [], selfMentions: 1, totalMentions: 10 });

describe("narrateShareOfVoice", () => {
  it("escalates by share band", () => {
    expect(narrateShareOfVoice(sov(0.05))).toContain("invisible");
    expect(narrateShareOfVoice(sov(0.2))).toContain("room to be mentioned");
    expect(narrateShareOfVoice(sov(0.5))).toContain("own");
  });
});

describe("narrateBenchmark", () => {
  it("handles no-data, ahead, and behind", () => {
    expect(narrateBenchmark("Organic keywords", 10, 0)).toContain("No rival");
    expect(narrateBenchmark("Organic keywords", 100, 50)).toContain("ahead");
    expect(narrateBenchmark("Organic keywords", 50, 100)).toContain("50%");
  });
});

describe("narrateKeywordGap", () => {
  it("is empty with no rows; names the top keyword otherwise", () => {
    expect(narrateKeywordGap([])).toBe("");
    const rows: KeywordGapRow[] = [{ keyword: "habit tracker", volume: 12000, rivalsRanking: 3, bestRivalPosition: 2 }];
    expect(narrateKeywordGap(rows)).toContain('"habit tracker"');
    expect(narrateKeywordGap(rows)).toContain("12,000");
  });
});

describe("narrateTrafficMix", () => {
  it("names the dominant channel", () => {
    const out = narrateTrafficMix({ organic: 0.6, referral: 0.1, social: 0.1, direct: 0.2, estimated: true });
    expect(out).toContain("organic search");
    expect(out).toContain("60%");
  });
});
