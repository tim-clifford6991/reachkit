// tests/market/questions/market-words.test.ts — #1195: a pass that concludes
// a new market measures it. From the re-measure of reachkit.app on
// 2026-10-02 (scan dae8bbb0): the market's own suggestions were bought and
// then dropped as off-topic, and no AI answer in the new market was asked.
import { describe, expect, it } from "vitest";
import { buyerPrompts } from "../../../src/lib/market/questions/buyer-prompts.ts";
import type { Profile } from "../../../src/lib/market/questions/profile.ts";
import { selectTwelve } from "../../../src/lib/market/questions/select.ts";

/** The profile that pass held: its words are the old market's. */
const PROFILE: Profile = {
  category: "SEO software",
  job: "rank pages in Google",
  offeringType: "software",
  audienceTerms: ["founders"],
  namedRivals: [],
  vocabulary: ["seo", "content", "ranking"],
  brandTokens: ["reachkit"],
};

/** The rows the synonym "AI answer visibility" bought that day. */
const BOUGHT = [
  { keyword: "best answer optimization tools for ai visibility", volume: 70, difficulty: 14 },
  { keyword: "best answer engine optimization for enhancing ai visibility", volume: 70, difficulty: 7 },
  { keyword: "best ai visibility products with optimized answer engines", volume: 50, difficulty: 22 },
];

describe("a concluded market's words select its searches (#1195)", () => {
  it("drops them without the synonyms and keeps them with", () => {
    const category = "AI discovery monitoring and content";
    expect(selectTwelve({ profile: PROFILE, market: BOUGHT, ownRanked: 0, category })).toEqual([]);
    const kept = selectTwelve({
      profile: PROFILE,
      market: BOUGHT,
      ownRanked: 0,
      category,
      synonyms: ["AI answer visibility", "answer engine optimization"],
    });
    expect(kept.map((s) => s.keyword)).toContain("best answer optimization tools for ai visibility");
  });
});

describe("the market's buyer prompts (#1195)", () => {
  const market = {
    category: "AI visibility tracking",
    synonyms: ["answer engine optimization", "generative engine optimization"],
    buyer: "B2B SaaS founders",
    job: "Get named in AI answers.",
    rivals: [{ domain: "tryprofound.com", name: "Profound", basis: "same_job" as const, reason: "" }],
  };

  it("asks the category, each synonym, the buyer's case, the job and an alternative to each rival", () => {
    expect(buyerPrompts(market, 8)).toEqual([
      "What are the best AI visibility tracking tools?",
      "What are the best answer engine optimization tools?",
      "What are the best generative engine optimization tools?",
      "Which AI visibility tracking tool is best for B2B SaaS founders?",
      "Which tools help me get named in AI answers?",
      "What are the best alternatives to Profound?",
    ]);
  });

  it("asks no more than it is allowed, and nothing without a category", () => {
    expect(buyerPrompts(market, 2)).toHaveLength(2);
    expect(buyerPrompts({ ...market, category: " " }, 8)).toEqual([]);
  });
});
