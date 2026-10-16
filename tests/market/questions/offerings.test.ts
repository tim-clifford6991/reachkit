// tests/market/questions/offerings.test.ts — issue 1454: a business that
// sells several lines is read as several lines and measured across them.
import "../../generate/env.ts";
import { describe, expect, it } from "vitest";
import { normaliseProfile } from "../../../src/lib/market/questions/profile.ts";
import { offeringSeeds, spreadAcrossOfferings } from "../../../src/lib/market/questions/offerings.ts";
import { seedLadder } from "../../../src/lib/market/questions/widen.ts";
import type { SelectedSearch } from "../../../src/lib/market/questions/select.ts";

const ANSWER = {
  category: "coffee shop",
  job: "serve coffee and breakfast",
  offeringType: "café",
  audienceTerms: ["commuters", "students"],
  namedRivals: [],
  vocabulary: ["espresso"],
  brandTokens: ["Layne's"],
  town: "Leeds",
};

function search(keyword: string, index: number): SelectedSearch {
  const rank = index + 1;
  return { keyword, volume: 1000 - rank, intent: "decision", score: 100 - rank, rank };
}

describe("the profile names every line the business sells", () => {
  it("orders the lines by weight as shares of one, the category's line first, and keeps a local town", () => {
    const profile = normaliseProfile({
      ...ANSWER,
      offerings: [
        { name: "Breakfast", category: "breakfast café", weight: 40 },
        { name: "Coffee", category: "Coffee shop", weight: 60 },
      ],
      kind: "hospitality",
      reach: "local",
    });
    expect(profile.offerings?.map((o) => [o.category, o.weight])).toEqual([
      ["Coffee shop", 0.6],
      ["breakfast café", 0.4],
    ]);
    expect(profile.kind).toBe("hospitality");
    expect(profile.reach).toBe("local");
    expect(profile.town).toBe("Leeds");
  });

  it("a business that sells across a country keeps no town, and a kind or reach off the list is none", () => {
    const profile = normaliseProfile({ ...ANSWER, offerings: [], kind: "restaurant", reach: "national" });
    expect(profile.town).toBe("");
    expect(profile.kind).toBeUndefined();
    expect(profile.offerings).toEqual([{ name: "coffee shop", category: "coffee shop", weight: 1 }]);
  });

  it("a placeholder line is dropped and a placeholder category is no category", () => {
    const profile = normaliseProfile({
      ...ANSWER,
      category: "<UNKNOWN>",
      offerings: [{ name: "x", category: "n/a", weight: 1 }],
      kind: "",
      reach: "",
    });
    expect(profile.category).toBe("");
    expect(profile.offerings).toBeUndefined();
  });
});

describe("selection spreads the searches across the lines", () => {
  const offerings = [
    { name: "Coffee", category: "coffee shop", weight: 0.5 },
    { name: "Breakfast", category: "breakfast", weight: 0.5 },
  ];

  it("gives each line its share, in the candidates' order, ranked again", () => {
    const candidates = [
      "coffee shop leeds",
      "best coffee leeds",
      "coffee shop near station",
      "espresso coffee bar",
      "breakfast leeds",
      "best breakfast city centre",
    ].map(search);
    const spread = spreadAcrossOfferings(candidates, offerings, 4);
    expect(spread.map((s) => s.keyword)).toEqual(["coffee shop leeds", "best coffee leeds", "breakfast leeds", "best breakfast city centre"]);
    expect(spread.map((s) => s.rank)).toEqual([1, 2, 3, 4]);
  });

  it("a line with no search gives its places back, so one line's business is unchanged", () => {
    const candidates = ["coffee shop leeds", "best coffee leeds", "coffee bar", "coffee beans"].map(search);
    expect(spreadAcrossOfferings(candidates, offerings, 3).map((s) => s.keyword)).toEqual([
      "coffee shop leeds",
      "best coffee leeds",
      "coffee bar",
    ]);
    expect(spreadAcrossOfferings(candidates, [offerings[0]!], 3)).toEqual(candidates.slice(0, 3));
  });

  it("a large enough line is seeded right after the category", () => {
    const profile = normaliseProfile({
      ...ANSWER,
      offerings: [
        { name: "Coffee", category: "coffee shop", weight: 0.8 },
        { name: "Cakes", category: "cakes", weight: 0.1 },
        { name: "Breakfast", category: "breakfast café", weight: 0.3 },
      ],
      kind: "hospitality",
      reach: "local",
    });
    expect(offeringSeeds(profile)).toEqual(["breakfast café"]);
    expect(seedLadder(profile).slice(0, 2)).toEqual(["coffee shop", "breakfast café"]);
  });

  it("a line that is the first worded again is bought no seed; a line that shares only a generic word is", () => {
    const plumber = normaliseProfile({
      ...ANSWER,
      category: "plumbing services",
      offerings: [
        { name: "Residential", category: "residential plumbing repair and maintenance", weight: 1 },
        { name: "Commercial", category: "commercial plumbing repair and maintenance", weight: 1 },
      ],
    });
    expect(offeringSeeds(plumber)).toEqual([]);

    const accountancy = normaliseProfile({
      ...ANSWER,
      category: "chartered accountant services",
      offerings: [
        { name: "Tax", category: "tax advisory", weight: 1 },
        { name: "Accounts", category: "accounting and bookkeeping", weight: 1 },
        { name: "Audit", category: "audit services", weight: 1 },
      ],
    });
    expect(offeringSeeds(accountancy)).toEqual(["tax advisory", "accounting and bookkeeping", "audit services"]);
  });
});
