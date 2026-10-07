// tests/market/questions/well-formed.test.ts — issue 1314.
//
// A search nobody would type as it stands is never measured and never
// planned. Every search here is one the customer panel's passes measured or
// planned, for a bakery, an accountant, a shop and a plumber.
import { describe, expect, it } from "vitest";
import { comparisonsOf } from "@/lib/market/infer/demand";
import { measuredMarketOf, neverMeasured } from "@/lib/market/questions/measured";
import { comparisonName, malformedSearch } from "@/lib/market/questions/well-formed";
import { slugify } from "@/lib/opportunities/derive/candidate";

// The names and search names are the ones the panel's passes stored.
const ABC = { name: "ABC Home & Commercial Services", domain: "abcplumbingaustin.com", searchNames: ["abc home & commercial services", "abc plumbing austin"] };
const RADIANT = { name: "Radiant Plumbing & Air Conditioning", domain: "radiantplumbing.com", searchNames: ["radiant plumbing & air conditioning", "radiant plumbing austin"] };
const TATTOOS = { name: "TemporaryTattoos.com", domain: "temporarytattoos.com", searchNames: ["temporarytattoos.com"] };
const PEEC = { name: "Peec AI", domain: "peec.ai", searchNames: ["peec ai"] };

describe("what is not a search", () => {
  it("a phrase said twice, a comparison with one side, a web address, and a rival called by its domain", () => {
    expect(malformedSearch("best bakery near me near me")).toBe("repeated_phrase");
    expect(malformedSearch("chartered accountant vs")).toBe("empty_comparison");
    expect(malformedSearch("temporarytattoos.com alternatives")).toBe("web_address");
    expect(malformedSearch("abcplumbingaustin alternatives", [ABC])).toBe("domain_for_name");
  });

  it("and what is one: a place named once, a whole comparison, a technology with a dot, a rival by its name", () => {
    for (const search of ["best bakery near me", "chartered accountant vs bookkeeper", "node.js hosting", "asp.net developers", "bora bora hotels", "zuni café vs quince"]) {
      expect(malformedSearch(search, [ABC, RADIANT, PEEC]), search).toBeNull();
    }
    expect(malformedSearch("peec alternatives", [PEEC])).toBeNull();
    expect(malformedSearch("forvis mazars alternatives", [{ name: "Forvis Mazars", domain: "mazars.co.uk" }])).toBeNull();
    expect(malformedSearch("radiantplumbing alternatives", [RADIANT])).toBe("domain_for_name");
  });

  it("is never measured, whatever volume the vendor lists it at", () => {
    const market = measuredMarketOf({ buyer: "", job: "", category: "bakery", synonyms: [], differentiators: [], notOurMarket: [], categoryReason: "", rivals: [] })!;
    expect(neverMeasured("best bakery near me near me", market)).toBe("malformed");
    expect(neverMeasured("best bakery near me", market)).toBeNull();
  });
});

describe("a rival is named by its name, never by its domain", () => {
  it("says a long name as buyers would, and a name that is an address without its ending", () => {
    expect(comparisonName(ABC)).toBe("abc plumbing austin");
    expect(comparisonName(RADIANT)).toBe("radiant plumbing austin");
    expect(comparisonName({ ...RADIANT, searchNames: undefined })).toBe("radiant plumbing");
    expect(comparisonName(TATTOOS)).toBe("temporarytattoos");
    expect(comparisonName({ name: "Bäckerei Schüren", domain: "baeckerei-schueren.de" })).toBe("bäckerei schüren");
  });

  it("so no comparison a pass derives holds a domain", () => {
    const queries = comparisonsOf({ rivals: [ABC, RADIANT, TATTOOS].map((r) => ({ ...r, volume: 1000 })), product: null, ownSearched: false, searchedOnly: true }).map((c) => c.query);
    expect(queries).toContain("abc plumbing austin alternatives");
    for (const query of queries) expect(malformedSearch(query, [ABC, RADIANT, TATTOOS]), query).toBeNull();
  });
});

describe("a letter outside ASCII is written in ASCII in a slug, never dropped", () => {
  it("keeps the word whole", () => {
    expect(slugify("zuni café vs quince")).toBe("zuni-cafe-vs-quince");
    expect(slugify("Bäckerei Hohe Straße")).toBe("backerei-hohe-strasse");
  });
});
