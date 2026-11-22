// tests/market/infer/terms.test.ts — a market's words come from search
// volume (SPEC §6, owner D49, issue 1270). What a customer can see: the
// prompts tracked for them, and the market and buyer their pages are
// written for.
import { describe, expect, it } from "vitest";
import { writingMarket } from "../../../src/lib/generate/voice/market.ts";
import { candidateTerms, searchedTerms, spokenMarket, termsDue } from "../../../src/lib/market/infer/terms.ts";
import type { MarketConclusion } from "../../../src/lib/market/infer/types.ts";
import { generatePrompts } from "../../../src/lib/market/prompts/generate.ts";

const CONCLUDED: MarketConclusion = {
  buyer: "B2B SaaS and software companies seeking to be discovered",
  job: "get named by AI assistants",
  category: "AI discovery monitoring and content",
  synonyms: ["AI answer visibility", "buyer discovery tracking"],
  differentiators: [],
  notOurMarket: ["SEO software"],
  categoryReason: "",
  rivals: [{ domain: "aeoengine.ai", name: "AEO Engine", basis: "ranks", reason: "" }],
};

const READ = searchedTerms(
  candidateTerms(
    [
      { term: "AI visibility tool", otherMeaning: false },
      { term: "geo", otherMeaning: true },
      { term: "AI SEO", otherMeaning: false },
      { term: "AEO Engine alternatives", otherMeaning: false },
      { term: "AI discovery monitoring", otherMeaning: false },
    ],
    { brands: ["ReachKit", "AEO Engine"] }
  ),
  [
    { keyword: "geo", searchVolume: 90000 },
    { keyword: "ai seo", searchVolume: 6600 },
    { keyword: "ai visibility tool", searchVolume: 1600 },
  ]
);
const MARKET: MarketConclusion = { ...CONCLUDED, ...READ, termsAt: "2026-10-05T00:00:00.000Z" };

describe("D49 — the search term is the most-searched term that means this market", () => {
  it("passes over a term another meaning pollutes, however often it is searched, and never proposes a brand", () => {
    expect(READ.searchTerm).toBe("AI SEO");
    expect(READ.terms.map((t) => t.term)).not.toContain("AEO Engine alternatives");
    expect(READ.terms.find((t) => t.term === "AI discovery monitoring")?.volume).toBe(0);
  });

  it("is null where nothing proposed is searched, and the market keeps its own category", () => {
    const none = searchedTerms([{ term: "buyer discovery tracking", polluted: false }], []);
    expect(none.searchTerm).toBeNull();
    const said = spokenMarket({ ...CONCLUDED, ...none, termsAt: "2026-10-05T00:00:00.000Z" });
    expect(said.category).toBe(CONCLUDED.category);
    expect(said.synonyms).toEqual([]);
  });
});

describe("D49 — what is printed uses the searched terms and the founder's own buyer", () => {
  it("tracked prompts name the market by its search term and never by a label nobody searches", () => {
    const prompts = generatePrompts(spokenMarket(MARKET, "Founders and Business Owners"), "ReachKit").map((p) => p.text);
    expect(prompts).toContain("What are the best AI SEO tools right now, and what is each one good at?");
    expect(prompts).toContain("Which AI visibility platforms do people actually recommend this year?");
    expect(prompts).toContain("Which AI SEO software is built for founders and business owners?");
    const all = prompts.join(" ");
    for (const unsearched of ["AI discovery monitoring", "AI answer visibility", "buyer discovery tracking", "B2B SaaS"]) {
      expect(all).not.toContain(unsearched);
    }
  });

  it("a page is written for the search term and the founder's buyer; a founder's own category still stands", () => {
    const stored = { current: MARKET, adoptedAt: null, pending: null, categoryOverridden: false, rivalsOverridden: false };
    const site = { category: CONCLUDED.category, competitors: [], stored };
    const written = writingMarket({ site, reportCategory: "", founderBuyer: "Founders and Business Owners" });
    expect(written.category).toBe("AI SEO");
    expect(written.synonyms).toEqual(["AI visibility"]);
    expect(written.market?.buyer).toBe("Founders and Business Owners");
    // What a stored question may not carry onto a page.
    expect(written.unsearched).toEqual(["AI discovery monitoring and content", "AI answer visibility", "buyer discovery tracking", "geo", "AI discovery monitoring"]);

    const own = writingMarket({
      site: { ...site, category: "Answer engine consulting", stored: { ...stored, categoryOverridden: true } },
      reportCategory: "",
    });
    expect(own.category).toBe("Answer engine consulting");
    expect(own.market?.buyer).toBe(CONCLUDED.buyer);
  });

  it("a market whose terms were never read is spoken as it was concluded", () => {
    expect(spokenMarket(CONCLUDED).category).toBe(CONCLUDED.category);
    expect(termsDue(CONCLUDED, new Date("2026-10-06"))).toBe(true);
    expect(termsDue(MARKET, new Date("2026-10-12"))).toBe(false);
    expect(termsDue(MARKET, new Date("2026-11-05"))).toBe(true);
  });
});
