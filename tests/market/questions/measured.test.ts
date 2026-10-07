// SPEC §6 (owner D65 of 2026-10-07, issue 1303): which searches a pass
// measures. The owner's rule is that no word list or threshold is tuned to
// one market, so each case below is a different kind of business.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MarketConclusion } from "@/lib/market/infer/types";
import { marketSeeds, measuredMarketOf, neverMeasured, unjudged, withJudged } from "@/lib/market/questions/measured";
import type { Profile } from "@/lib/market/questions/profile";
import { selectTwelve } from "@/lib/market/questions/select";
import { seedLadder } from "@/lib/market/questions/widen";

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
});

function market(over: Partial<MarketConclusion>): MarketConclusion {
  return { buyer: "", job: "", category: "", synonyms: [], differentiators: [], notOurMarket: [], categoryReason: "", rivals: [], ...over };
}

function profile(over: Partial<Profile>): Profile {
  return { category: "", offeringType: "", job: "", vocabulary: [], audienceTerms: [], namedRivals: [], brandTokens: [], ...over } as Profile;
}

const DENTIST = market({
  category: "Family dental care in Leeds",
  synonyms: ["gentle dentistry"],
  notOurMarket: ["Dental laboratory services", "Orthodontic software"],
  termsAt: "2026-10-07T00:00:00.000Z",
  searchTerm: "dentist leeds",
  terms: [
    { term: "emergency dentist leeds", volume: 1900 },
    { term: "dentist leeds", volume: 5400 },
    { term: "crown", volume: 40500, polluted: true },
    { term: "gentle family dentistry", volume: 0 },
  ],
  rivals: [{ domain: "brightsmile.co.uk", name: "Bright Smile", basis: "ranks", reason: "", searchNames: ["bright smile leeds"] }],
  demand: { at: "2026-10-07T00:00:00.000Z", own: 0, brands: { "bright smile leeds": 320, "city dental": 210 } },
});

describe("the seeds are the searches buyers type", () => {
  it("leads with the market's searched terms, most searched first, and never a polluted or unsearched one", () => {
    expect(marketSeeds(DENTIST)).toEqual(["dentist leeds", "emergency dentist leeds"]);
    const ladder = seedLadder(profile({ category: "dental practice" }), DENTIST.category, DENTIST.synonyms, marketSeeds(DENTIST));
    expect(ladder.slice(0, 3)).toEqual(["dentist leeds", "emergency dentist leeds", "Family dental care in Leeds"]);
  });

  it("falls back to the category where no term is searched or none was read", () => {
    const unread = market({ category: "Bespoke oak furniture" });
    expect(marketSeeds(unread)).toEqual([]);
    expect(seedLadder(profile({ category: "furniture" }), unread.category, [], marketSeeds(unread))[0]).toBe("Bespoke oak furniture");
  });
});

describe("what is never measured", () => {
  const m = measuredMarketOf(DENTIST)!;

  it("a search that uses a term from notOurMarket, whole or without its closing word", () => {
    expect(neverMeasured("best orthodontic software", m)).toBe("not_our_market");
    expect(neverMeasured("dental laboratory near me", m)).toBe("not_our_market");
    expect(neverMeasured("dental implants leeds", m)).toBeNull();
  });

  it("a search that is only a rival's name or another product's, but not the name beside another word", () => {
    expect(neverMeasured("Bright Smile", m)).toBe("brand");
    expect(neverMeasured("brightsmile.co.uk", m)).toBe("brand");
    expect(neverMeasured("city dental", m)).toBe("brand");
    expect(neverMeasured("bright smile reviews", m)).toBeNull();
  });

  it("a search the market judged off it, once judged", () => {
    const judged = measuredMarketOf({ ...DENTIST, judged: withJudged(undefined, { "Dental Nurse jobs": false, "teeth whitening leeds": true }) })!;
    expect(neverMeasured("dental nurse jobs", judged)).toBe("judged");
    expect(neverMeasured("teeth whitening leeds", judged)).toBeNull();
    expect(unjudged([{ keyword: "teeth whitening leeds" }, { keyword: "dentist leeds", term: true }, { keyword: "invisalign leeds" }], judged)).toEqual(["invisalign leeds"]);
  });
});

describe("the twelve hold the market's own searches", () => {
  // A new site: nothing ranked, so its demand ceiling is at its floor and
  // every head term is above it.
  const PLUMBER = market({
    category: "Emergency plumbing",
    notOurMarket: ["Plumbing supplies"],
    termsAt: "2026-10-07T00:00:00.000Z",
    searchTerm: "emergency plumber",
    terms: [
      { term: "emergency plumber", volume: 22000 },
      { term: "24 hour plumber", volume: 8100 },
      { term: "boiler repair", volume: 12000 },
    ],
  });
  const P = profile({ category: "plumber", vocabulary: ["plumber", "plumbing", "supplies", "boiler", "leaking", "repair", "emergency"], brandTokens: ["pipewise"] });
  const rows = [
    { keyword: "how to fix a leaking boiler", volume: 210 },
    { keyword: "plumbing supplies near me", volume: 260 },
    { keyword: "emergency boiler repair cost", volume: 90 },
  ];

  it("measures the searched terms at their own volume beside the long-tail searches, and nothing off the market", () => {
    const selected = selectTwelve({ profile: P, market: rows, ownRanked: 0, category: PLUMBER.category, measured: measuredMarketOf(PLUMBER)! });
    const keywords = selected.map((s) => s.keyword);
    expect(keywords).toEqual(expect.arrayContaining(["emergency plumber", "boiler repair", "24 hour plumber", "how to fix a leaking boiler", "emergency boiler repair cost"]));
    expect(keywords).not.toContain("plumbing supplies near me");
    expect(selected.find((s) => s.keyword === "emergency plumber")).toMatchObject({ volume: 22000, term: true });
  });

  it("selects as it always did for a site with no market", () => {
    const selected = selectTwelve({ profile: P, market: rows, ownRanked: 0, category: "Emergency plumbing" });
    expect(selected.map((s) => s.keyword)).toContain("plumbing supplies near me");
    expect(selected.some((s) => s.term === true)).toBe(false);
  });
});
