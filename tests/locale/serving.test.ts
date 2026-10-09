// SPEC §6 (issue 1370) — where a business is, is not where it sells: a
// serving area stands only on the site's own evidence that it serves the
// place. The wording is taken from the customer panel's sites.
import "../generate/env";
import { describe, expect, it } from "vitest";
import { servingEvidence } from "../../src/lib/locale/serving.ts";
import { heldToEvidence } from "../../src/lib/market/infer/infer.ts";
import type { MarketEvidence } from "../../src/lib/market/infer/evidence.ts";
import { settleArea } from "../../src/lib/scan/market-conclusion.ts";

const BRIGHTON = { name: "Brighton" };
const none = { pages: [], service: [], localPack: false, inPerson: false };

/** clearleft.com as a pass reads it: Brighton is its address, its studio,
 *  its events and a client's name, and never where it says it sells. */
const AGENCY = {
  place: BRIGHTON,
  service: ["design transformation consulting", "UX design agency", "digital design agency", "design consultancy"],
  stated: { type: "LocalBusiness", description: "We partner with ambitious organisations to establish design as a strategic capability." },
  pages: [
    { url: "https://clearleft.com/", title: "Strategic design partners: website design, UX design | Clearleft", h1: "Design that moves organisations forward", text: "We design websites and digital services. 68 Middle Street Brighton BN1 1AL United Kingdom" },
    { url: "https://clearleft.com/about", title: "About us | Clearleft", text: "You'll typically find us in our studio by the sea in Brighton, England. Made in Brighton. A design consultancy based in Brighton." },
    { url: "https://clearleft.com/services/product-design", title: "Product design | Clearleft", text: "Brighton & Hove City Council: delivering a design system. One day of each sprint was spent at our studio in Brighton." },
    { url: "https://clearleft.com/thinking/brighton-design-agency-events", title: "Brighton design agency events", text: "A one-day conference in Brighton for design and research practitioners." },
    { url: "https://clearleft.com/contact", title: "Contact our Brighton design agency", text: "A 15-minute walk from Brighton train station." },
  ],
  localPack: false,
  inPerson: false,
};

describe("a serving area stands on the site's own evidence", () => {
  it("gives a national agency none: an address, a studio, an event and a contact page say where it is", () => {
    expect(servingEvidence(AGENCY)).toBeNull();
  });

  it("keeps a local business's place on any one thing that says it serves it", () => {
    // alexander.co.uk: the areas its structured data lists.
    expect(servingEvidence({ ...none, place: { name: "Manchester" }, stated: { serves: ["Greater Manchester, Greater London, United Kingdom"] } })).toBe("area_served");
    // fletcherelectric.co.uk: a page titled by the service and the place.
    expect(
      servingEvidence({ ...none, place: { name: "Leeds" }, service: ["electrician"], pages: [{ url: "https://www.fletcherelectric.co.uk/", title: "Fletcher Electric | North Leeds electrician near you", text: "" }] })
    ).toBe("service_page");
    // baeckerei-hinkel.de: a page with no text of its own, and a description.
    expect(
      servingEvidence({ ...none, place: { name: "Düsseldorf" }, service: ["Bäckerei"], stated: { description: "Bäckerei Hinkel in Düsseldorf – die Bäckerei der Brotfreunde." } })
    ).toBe("service_page");
    // austinplumbery.com and alexander.co.uk: the service said with the place.
    const says = (place: string, service: string, text: string) =>
      servingEvidence({ ...none, place: { name: place }, service: [service], pages: [{ url: "https://example.com/", title: "Home", text }] });
    expect(says("Austin", "plumbing services", "Proudly serving our neighbors here in Austin.")).toBe("service_wording");
    expect(says("Austin", "plumbing services", "A customer first, family first, Austin first plumbing services company.")).toBe("service_wording");
    expect(says("Manchester", "chartered accountants", "One of the leading firms of accountants in Manchester.")).toBe("service_wording");
    expect(says("Leeds", "electrician", "Results for hundreds of satisfied customers across Leeds.")).toBe("service_wording");
    expect(says("Düsseldorf", "Bäckerei", "Ihre Düsseldorfer Bäckerei seit 1891.")).toBe("service_wording");
    // Google shows it in the place's local pack.
    expect(servingEvidence({ ...AGENCY, localPack: true })).toBe("local_pack");
  });

  it("takes an address as enough only for a business carried out in person", () => {
    const restaurant = { ...none, place: { name: "San Francisco" }, service: ["fine dining"], pages: [{ url: "https://zunicafe.com/", title: "Zuni", text: "1658 Market Street San Francisco, CA 94102" }] };
    expect(servingEvidence({ ...restaurant, inPerson: true })).toBe("in_person");
    expect(servingEvidence(restaurant)).toBeNull();
  });
});

describe("the market conclusion is held to it", () => {
  const evidence: MarketEvidence = {
    domain: "clearleft.com",
    siteName: "Clearleft",
    headline: null,
    measuredUnder: null,
    pages: AGENCY.pages,
    stated: AGENCY.stated,
    products: [],
    claims: [],
    answers: [],
    ownSearches: [],
    topTens: [],
  };
  const market = {
    buyer: "heads of design",
    job: "build design capability",
    category: "design transformation consulting",
    synonyms: ["UX design agency", "design consultancy"],
    differentiators: [],
    notOurMarket: [],
    categoryReason: "",
    kind: "professional-services" as const,
    serves: BRIGHTON,
  };

  it("drops a town the market call read from an office's address, and keeps one the site bears out with what said so", () => {
    expect(heldToEvidence(market, evidence)).toMatchObject({ serves: null });
    expect(heldToEvidence(market, { ...evidence, ownLocalPack: true })).toMatchObject({ serves: BRIGHTON, servesBecause: "local_pack" });
  });

  it("decides again a place a pass stored before any evidence was asked for, and never a founder's", async () => {
    const locale = { country: "GB", language: "en" } as const;
    const stored = { place: { name: "Brighton", location: "Brighton,England,United Kingdom" }, located: true as const };
    expect(await settleArea({ siteId: "s", area: { ...stored, by: "read" }, read: null, locale })).toEqual({ place: null, by: "read" });
    expect(await settleArea({ siteId: "s", area: { ...stored, by: "read" }, read: BRIGHTON, because: "service_page", locale })).toEqual({ ...stored, by: "read", because: "service_page" });
    expect(await settleArea({ siteId: "s", area: { ...stored, by: "founder" }, read: null, locale })).toEqual({ ...stored, by: "founder" });
    expect(await settleArea({ siteId: "s", area: { ...stored, by: "read", because: "area_served" }, read: null, locale })).toEqual({ ...stored, by: "read", because: "area_served" });
  });
});
