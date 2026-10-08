// SPEC §6 (owner D67 of 2026-10-07, issue 1318) — a local business's terms,
// measured searches and rivals are its place's, never the whole country's.
import "../../generate/env";
import { describe, expect, it } from "vitest";
import type { MarketEvidence } from "@/lib/market/infer/evidence";
import { concludeRivals, type RivalsAnswer } from "@/lib/market/infer/infer";
import { localTerms } from "@/lib/market/infer/terms";
import type { MarketConclusion } from "@/lib/market/infer/types";
import { marketSeeds, measuredMarketOf, neverMeasured } from "@/lib/market/questions/measured";
import { matchLocation } from "@/lib/vendors/dataforseo/locations";
import { buildRequest, placeCacheKey } from "@/lib/vendors/dataforseo/transport";

const AUSTIN = { name: "Austin", region: "Texas" };
const IN_AUSTIN = { ...AUSTIN, location: "Austin,Texas,United States" };

const MARKET: MarketConclusion = {
  buyer: "Homeowners in Austin",
  job: "Get a plumbing fault repaired",
  category: "Residential plumbing",
  synonyms: [],
  differentiators: [],
  notOurMarket: ["HVAC installation"],
  categoryReason: "",
  rivals: [],
  terms: [
    { term: "emergency plumber", volume: 74000 },
    { term: "plumber austin", volume: 2900 },
  ],
  searchTerm: "emergency plumber",
  termsAt: "2026-10-07T06:00:00.000Z",
};

describe("terms and measured searches", () => {
  it("every term is the service plus the place, once", () => {
    const terms = localTerms(
      [
        { term: "emergency plumber", polluted: false },
        { term: "emergency plumber near me", polluted: false },
        { term: "plumber austin tx", polluted: false },
      ],
      AUSTIN
    );
    expect(terms.map((t) => t.term)).toEqual(["emergency plumber austin", "plumber austin tx"]);
  });

  it("a term read for the whole country is neither a seed nor a measured term of a business in one place", () => {
    expect(marketSeeds(MARKET)).toEqual(["emergency plumber", "plumber austin"]);
    expect(marketSeeds(MARKET, AUSTIN)).toEqual(["plumber austin"]);
  });

  it("a search the country asks is never measured; near me is, only where it can be read from the place", () => {
    const unlocated = measuredMarketOf(MARKET, AUSTIN)!;
    const located = measuredMarketOf(MARKET, IN_AUSTIN)!;
    expect(neverMeasured("water heater repair", unlocated)).toBe("elsewhere");
    expect(neverMeasured("water heater repair austin", unlocated)).toBeNull();
    expect(neverMeasured("plumber near me", unlocated)).toBe("elsewhere");
    expect(neverMeasured("plumber near me", located)).toBeNull();
    expect(neverMeasured("water heater repair", measuredMarketOf(MARKET)!)).toBeNull();
  });
});

describe("rivals come from the place's own results", () => {
  const evidence: MarketEvidence = {
    domain: "northsidepl.com",
    siteName: "Northside Plumbing",
    headline: null,
    measuredUnder: "plumber austin",
    pages: [],
    products: [],
    claims: [],
    answers: [],
    ownSearches: [],
    topTens: [{ domain: "mrrfix.com", appearances: 3, title: "Mr. Rooter Plumbing of Austin" }],
  };
  type Candidate = RivalsAnswer["candidates"][number];
  const candidate = (domain: string, name: string, extra: Partial<Candidate>): Candidate => ({ domain, name, kind: "product", inMarket: true, basis: "same_job", reason: "", ...extra });
  const answer: RivalsAnswer = {
    candidates: [
      candidate("rrplumb.com", "Roto-Rooter", { national: true }),
      candidate("mrrfix.com", "Mr. Rooter", { national: true, basis: "ranks" }),
      candidate("radiantpl.com", "Radiant Plumbing", { national: false }),
    ],
  };

  it("a national chain counts only where this place's results show it, and is weighed by its name there", () => {
    const rivals = concludeRivals(answer, evidence, 5, AUSTIN);
    expect(rivals.map((r) => r.name)).toEqual(["Mr. Rooter", "Radiant Plumbing"]);
    expect(rivals[0]).toMatchObject({ national: true, searchNames: ["mr. rooter austin"] });
    expect(rivals[1]!.searchNames).toEqual(["radiant plumbing"]);
  });

  it("a business that sells nationally keeps every rival under its own name", () => {
    const rivals = concludeRivals(answer, evidence);
    expect(rivals.map((r) => r.name)).toEqual(["Roto-Rooter", "Mr. Rooter", "Radiant Plumbing"]);
    expect(rivals[0]!.searchNames).toEqual(["roto-rooter"]);
  });
});

describe("where the vendor reads", () => {
  const list = [
    { name: "Austin,Texas,United States", kind: "City" },
    { name: "Austin-Bergstrom International Airport,Texas,United States", kind: "Airport" },
    { name: "Portland,Oregon,United States", kind: "City" },
    { name: "Portland,Maine,United States", kind: "City" },
    { name: "Dusseldorf,North Rhine-Westphalia,Germany", kind: "City" },
    { name: "Manchester,England,United Kingdom", kind: "Post town" },
  ];

  it("finds a city by its name and region, and does not guess between two of one name", () => {
    expect(matchLocation(list, { name: "Austin" })).toBe("Austin,Texas,United States");
    expect(matchLocation(list, { name: "Düsseldorf" })).toBe("Dusseldorf,North Rhine-Westphalia,Germany");
    expect(matchLocation(list, { name: "Manchester", region: "Greater Manchester" })).toBe("Manchester,England,United Kingdom");
    expect(matchLocation(list, { name: "Portland", region: "OR" })).toBe("Portland,Oregon,United States");
    expect(matchLocation(list, { name: "Portland" })).toBeNull();
    expect(matchLocation(list, { name: "Marfa" })).toBeNull();
  });

  it("Google's results are read from the city; volumes, which the vendor holds by country, from the country", () => {
    const locale = { country: "US", language: "en", place: IN_AUSTIN } as const;
    const where = (path: string): unknown => JSON.parse(buildRequest({ path, mode: "live", locale, fields: { keyword: "plumber austin" } }).body)[0].location_name;
    expect(where("/v3/serp/google/organic/live/advanced")).toBe("Austin,Texas,United States");
    expect(where("/v3/serp/google/ai_mode/live/advanced")).toBe("Austin,Texas,United States");
    expect(where("/v3/dataforseo_labs/google/keyword_overview/live")).toBe("United States");
    expect(placeCacheKey(locale)).not.toBe(placeCacheKey({ country: "US", language: "en" }));
  });

  it("a stored name never moves a read to another country", () => {
    const locale = { country: "US", language: "en", place: { name: "Leeds", location: "Leeds,West Yorkshire,England,United Kingdom" } } as const;
    const task = JSON.parse(buildRequest({ path: "/v3/serp/google/organic/live/advanced", mode: "live", locale, fields: {} }).body)[0];
    expect(task.location_name).toBe("United States");
  });
});
