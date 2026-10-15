// SPEC §6 (owner D67 of 2026-10-07, issue 1318) — a business that serves
// one area is measured where it serves: how a search says a place, and what
// a home page states of its own.
import { describe, expect, it } from "vitest";
import { areaOf, isLocalSearch, localSearch, namesPlace, placeCandidates, readPlaceSignals, statedPlace, townOfAddress, withoutPlace } from "../../src/lib/locale/place.ts";
import { modelInstruction } from "../../src/lib/locale/language/index.ts";

const AUSTIN = { name: "Austin", region: "Texas" };
const DUSSELDORF = { name: "Düsseldorf" };

describe("a local business's searches are the service plus the place", () => {
  it("adds the place to a search the whole country types, and puts it in place of near me", () => {
    expect(localSearch("emergency plumber", AUSTIN)).toBe("emergency plumber austin");
    expect(localSearch("emergency plumber near me", AUSTIN)).toBe("emergency plumber austin");
    expect(localSearch("Bäckerei in der Nähe", DUSSELDORF)).toBe("Bäckerei Düsseldorf");
  });

  it("leaves a search that names the place as it is, however the place is spelled", () => {
    expect(localSearch("plumber austin tx", AUSTIN)).toBe("plumber austin tx");
    expect(namesPlace("bäckerei duesseldorf", DUSSELDORF)).toBe(true);
    expect(namesPlace("bakery dusseldorf altstadt", DUSSELDORF)).toBe(true);
    expect(namesPlace("austintatious plumbing", AUSTIN)).toBe(false);
  });

  it("knows a search asked of a place from one the country asks", () => {
    expect(isLocalSearch("dentist near me", AUSTIN)).toBe(true);
    expect(isLocalSearch("zahnarzt in meiner nähe", DUSSELDORF)).toBe(true);
    expect(isLocalSearch("how to unclog a drain", AUSTIN)).toBe(false);
  });

  it("says the service without its place, which is what a prompt then names", () => {
    expect(withoutPlace("emergency plumber austin tx", AUSTIN)).toBe("emergency plumber");
    expect(withoutPlace("plumber in Austin, Texas", AUSTIN)).toBe("plumber");
    expect(withoutPlace("bäckerei düsseldorf", DUSSELDORF)).toBe("bäckerei");
    expect(withoutPlace("Austin", AUSTIN)).toBe("Austin");
  });
});

describe("what a home page states of where it is", () => {
  const page = (type: string): string =>
    `<script type="application/ld+json">{"@context":"https://schema.org","@type":"${type}","name":"Northside","address":{"@type":"PostalAddress","addressLocality":"Austin","addressRegion":"TX"}}</script>`;

  const readPlace = (html: string) => statedPlace(readPlaceSignals(html));

  it("reads the town of a business that marks itself a local one, and none from a plain organisation's office", () => {
    expect(readPlace(page("Plumber"))).toEqual({ name: "Austin", region: "TX" });
    expect(readPlace(page("Organization"))).toBeNull();
    expect(readPlace("<p>Call us in Austin</p>")).toBeNull();
  });

  it("reads none from an office's address under a plain LocalBusiness, and reads it once the page lists the town as served (issue 1370)", () => {
    expect(readPlace(page("LocalBusiness"))).toBeNull();
    expect(readPlace(page("LocalBusiness").replace('"name":"Northside"', '"name":"Northside","areaServed":["Austin","Round Rock"]'))).toEqual({ name: "Austin", region: "TX" });
  });

  it("reads a stored area defensively: a founder's national answer, a place, and nothing from anything else", () => {
    expect(areaOf({ place: null, by: "founder" })).toEqual({ place: null, by: "founder" });
    expect(areaOf({ place: { name: "Leeds", location: "Leeds,West Yorkshire,England,United Kingdom" }, by: "read", located: true })).toEqual({
      place: { name: "Leeds", location: "Leeds,West Yorkshire,England,United Kingdom" },
      by: "read",
      located: true,
    });
    expect(areaOf({ place: "Leeds" })).toBeNull();
  });
});

describe("what a model is told", () => {
  it("is told the place, and nothing new for a business that sells across the United States", () => {
    expect(modelInstruction({ country: "US", language: "en" })).toBeNull();
    expect(modelInstruction({ country: "US", language: "en", place: AUSTIN })).toContain("serves Austin, Texas and nowhere else");
    expect(modelInstruction({ country: "DE", language: "de", place: DUSSELDORF })).toMatch(/Germany.*serves Düsseldorf/s);
  });
});

describe("owner ruling 2026-10-15 (issue 1441) — the towns a free pass may measure in, in the order of the evidence", () => {
  const ld = (body: string): string => `<script type="application/ld+json">{"@context":"https://schema.org",${body}}</script>`;
  const candidates = (html: string) => placeCandidates(readPlaceSignals(html)).map((c) => `${c.from}:${c.place.name}${c.place.region === undefined ? "" : `/${c.place.region}`}`);

  it("the structured address first, as setup reads it", () => {
    expect(candidates(ld('"@type":"Plumber","address":{"@type":"PostalAddress","addressLocality":"Austin","addressRegion":"TX"}'))).toEqual(["address:Austin/TX"]);
  });

  it("a business that lists the towns it serves and gives no address: each town it lists", () => {
    expect(candidates(ld('"@type":"Plumber","name":"Peanut Plumbing","areaServed":["Austin","San Antonio"],"telephone":"(512) 924-7989"'))).toEqual([
      "area_served:Austin",
      "area_served:San Antonio",
    ]);
  });

  it("an address written as one string: the town out of it", () => {
    expect(candidates(ld('"@type":"LocalBusiness","address":"12-16 New Station Street\\nLeeds, LS15DL","name":"laynes"'))).toEqual(["address_text:Leeds"]);
    expect(townOfAddress("500 W 2nd St, Austin, TX 78701")).toEqual({ name: "Austin", region: "TX" });
    expect(townOfAddress("1 High Street, Leeds LS1 5DL, United Kingdom")).toEqual({ name: "Leeds" });
    expect(townOfAddress("")).toBeNull();
  });

  it("nothing from a page that is no business, or gives an empty address", () => {
    expect(candidates(ld('"@type":"Organization","address":"1 Main St, Leeds"'))).toEqual([]);
    expect(candidates(ld('"@type":"LocalBusiness","address":""'))).toEqual([]);
  });
});
