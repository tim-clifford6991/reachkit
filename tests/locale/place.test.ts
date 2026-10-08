// SPEC §6 (owner D67 of 2026-10-07, issue 1318) — a business that serves
// one area is measured where it serves: how a search says a place, and what
// a home page states of its own.
import { describe, expect, it } from "vitest";
import { areaOf, isLocalSearch, localSearch, namesPlace, readPlace, withoutPlace } from "../../src/lib/locale/place.ts";
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

  it("reads the town of a business that marks itself a local one, and none from a plain organisation's office", () => {
    expect(readPlace(page("Plumber"))).toEqual({ name: "Austin", region: "TX" });
    expect(readPlace(page("Organization"))).toBeNull();
    expect(readPlace("<p>Call us in Austin</p>")).toBeNull();
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
