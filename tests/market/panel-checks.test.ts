// tests/market/panel-checks.test.ts — the customer panel's checks (SPEC §0,
// owner 2026-10-07, issue 1304).
//
// `npm run panel` holds a pass to what a business is, for every kind of
// business. Driven on two fixture results — a local plumber the pass read
// well, and a German bakery it read as an American software company — so
// nothing is bought.
import { describe, expect, it } from "vitest";
import { checkSite, defectsByKind, isRealQuestion, type CheckResult, type SiteResult } from "../../scripts/panel/checks";

const plumber: SiteResult = {
  site: { domain: "northside-plumbing.example", kind: "local service (plumber)", country: "US", language: "en", market: ["plumb"], why: "fixture" },
  siteName: "Northside Plumbing",
  status: "done",
  stoppedReason: "complete",
  market: {
    buyer: "Homeowners in Austin with a leak, a blocked drain or a failed water heater",
    job: "Get a plumbing fault repaired the same day",
    category: "Residential plumbing in Austin",
    synonyms: ["emergency plumber", "drain cleaning"],
    differentiators: ["family owned"],
    notOurMarket: ["HVAC installation", "home warranty plans"],
    categoryReason: "Every page sells a plumbing repair to a household in Austin.",
    terms: [
      { term: "plumber austin", volume: 2900 },
      { term: "water heater repair austin", volume: 590 },
    ],
    searchTerm: "plumber austin",
    rivals: [
      { domain: "radiantplumbing.example", name: "Radiant Plumbing", basis: "ranks", reason: "Same repairs, same city.", searchNames: ["radiant plumbing"], volume: 1900 },
      { domain: "stanspipes.example", name: "Stan's Pipes", basis: "ai_answer", reason: "Named by AI answers for Austin plumbers.", volume: 0 },
      { domain: "abacusplumbing.example", name: "Abacus", basis: "same_job", reason: "Same job.", searchNames: ["abacus plumbing"], volume: 720 },
    ],
  },
  deadRivals: [],
  locales: [{ location: "United States", language: "en" }],
  searches: ["emergency plumber austin", "water heater repair cost", "how to unclog a drain"],
  knowledgePages: 6,
  questions: ["How much does a water heater replacement cost?", "Do you charge a call-out fee at night?"],
  audience: ["Homeowners in Austin"],
  topics: [
    { query: "tankless water heater repair", status: "open", type: "new_post", fit: 3, volume: 320 },
    { query: "radiant plumbing alternatives", status: "open", type: "comparison_page", fit: 2, volume: 40 },
    { query: "hvac installation cost", status: "dismissed", type: "new_post", fit: 0, volume: 900 },
  ],
  cents: 21.4,
  costBySource: { "serp/google/organic": 2.4 },
};

const bakery: SiteResult = {
  site: { domain: "baeckerei-muster.example", kind: "German small business (bakery)", country: "DE", language: "de", market: ["bäcker", "brot"], why: "fixture" },
  siteName: "Bäckerei Muster",
  status: "done",
  stoppedReason: "complete",
  market: {
    buyer: "Small businesses and their customers",
    job: "Buy bread",
    category: "Online services",
    synonyms: [],
    differentiators: [],
    notOurMarket: ["restaurant delivery"],
    categoryReason: "",
    terms: [
      { term: "bakery software", volume: 0 },
      { term: "bread", volume: 0 },
    ],
    searchTerm: null,
    rivals: [
      { domain: "yelp.com", name: "Yelp", basis: "ranks", reason: "Holds the top tens.", volume: 500000 },
      { domain: "kamps.example", name: "Kamps", basis: "same_job", reason: "A bakery chain.", volume: 0 },
    ],
  },
  deadRivals: ["kamps.example"],
  locales: [{ location: "United States", language: "en" }],
  searches: ["kamps", "bäckerei muster öffnungszeiten", "restaurant delivery near me", "wedding cake ideas"],
  knowledgePages: 3,
  questions: ["Unsere Filialen", "Kann ich Brot vorbestellen?", "FAQ"],
  audience: [],
  topics: [
    { query: "kamps", status: "open", type: "new_post", fit: 1, volume: 1000 },
    { query: "bread baking classes", status: "open", type: "new_post", fit: 1, volume: 200, ready: true },
  ],
  cents: 30,
  costBySource: {},
};

const verdicts = (checks: readonly CheckResult[]): string[] => checks.map((check) => check.verdict);

describe("npm run panel — a pass held to what the business is", () => {
  it("passes a local business the pass read as itself, and lets a topic compare with a rival", () => {
    const checks = checkSite(plumber);

    expect(verdicts(checks)).toEqual(["pass", "pass", "pass", "pass", "pass", "pass", "pass", "pass", "pass"]);
  });

  it("fails a German bakery read as an American software company, and says what is wrong", () => {
    const checks = checkSite(bakery);
    const by = Object.fromEntries(checks.map((check) => [check.check, check]));

    expect(verdicts(checks)).toEqual(["fail", "fail", "fail", "fail", "fail", "fail", "fail", "fail", "pass"]);
    expect(by["the category is specific, and is the business's own"]!.detail).toContain("names no market");
    expect(by["the terms are in the site's own language and country"]!.detail).toContain("a de site in Germany was read in United States / en");
    expect(by["3–5 rivals, none a listing, each with demand or AI evidence"]!.items).toEqual([
      "2 rivals, not 3–5",
      "yelp.com lists or writes about businesses; it is not one",
      "kamps.example does not resolve: no such site",
      "Kamps (kamps.example) has no brand demand and no AI answer names it (same_job)",
    ]);
    expect(by["no measured search is off-market, a rival's brand or navigational"]!.items).toEqual([
      'kamps — a rival\'s brand ("kamps")',
      'bäckerei muster öffnungszeiten — navigational: names the site itself ("bäckerei muster")',
      'restaurant delivery near me — off-market: "restaurant delivery" is a market this site is not in',
      "wedding cake ideas — shares no word with the market",
    ]);
    expect(by["knowledge-base buyer questions are real questions, not headings"]!.items).toEqual(["Unsere Filialen", "FAQ"]);
    expect(by["the audience is specific"]!.detail).toContain("names no one in particular");
    expect(by["topics are all on-market"]!.items).toContain("bread baking classes — ready to be written at business fit 1");
  });

  it("holds a pass to the general rules of issue 1314, on what the panel's own passes left", () => {
    const by = (result: SiteResult) => Object.fromEntries(checkSite(result).map((check) => [check.check, check]));
    const market = plumber.market!;
    const pass: SiteResult = {
      ...plumber,
      siteName: "Zuni Café",
      market: {
        ...market,
        rivals: [
          { domain: "when2meet.example", name: "When2meet", basis: "ai_answer", reason: "A free poll.", volume: 110000, closeness: "partial" },
          { domain: "abcplumbingaustin.example", name: "ABC Home & Commercial Services", basis: "same_job", reason: "Same job.", volume: 9900 },
          { domain: "piper.example", name: "Chili Piper", basis: "same_job", reason: "Same job.", volume: 6600 },
        ],
      },
      wrongRivals: ["piper.example"],
      searches: ["best bakery near me near me", "chartered accountant vs", "emergency plumber austin"],
      topics: [
        { query: "zuni caf vs quince", status: "open", type: "comparison_page", fit: 3, volume: null, ready: true },
        { query: "abcplumbingaustin alternatives", status: "open", type: "comparison_page", fit: 3, volume: null, ready: true },
        { query: "plumbing tools for beginners", status: "open", type: "listed_page", fit: 1, volume: 2400, ready: false },
      ],
      knowledgePages: 74,
      costBySource: { "site-knowledge": 44.41, "serp/google/ai_mode": 4 },
      aiMode: { reads: 20, timeouts: 20 },
    };
    const found = by(pass);

    expect(found["3–5 rivals, none a listing, each with demand or AI evidence"]!.items).toEqual([
      "piper.example is not Chili Piper's site: its home page never names it",
      "When2meet leads the rivals and does only part of this business's job",
    ]);
    expect(found["no measured search is off-market, a rival's brand or navigational"]!.items).toEqual([
      "best bakery near me near me — says a phrase twice",
      "chartered accountant vs — compares with nothing",
    ]);
    // A topic the pass holds back at low fit is not a defect; a malformed one is.
    expect(found["topics are all on-market"]!.items).toEqual([
      'zuni caf vs quince — the site\'s name lost its letters ("zuni caf")',
      "abcplumbingaustin alternatives — calls a rival by its domain, not its name",
    ]);
    expect(found["the pass pays for answers: the knowledge base is bounded, AI Mode reads come back"]!.items).toEqual([
      "the knowledge base cost 44.41¢ for 74 pages; its bound is 15¢",
      "20 of 20 AI Mode reads timed out and were billed",
    ]);
  });

  it("a site whose own pages ask nothing passes with no buyer question, and one whose pages ask some does not", () => {
    const check = (pageQuestions: number | null) =>
      checkSite({ ...plumber, questions: [], pageQuestions }).find((result) => result.check.startsWith("knowledge-base buyer questions"))!;
    expect(check(0)).toMatchObject({ verdict: "pass", detail: "the site's own pages ask no question, and none is kept" });
    expect(check(5).verdict).toBe("fail");
    expect(check(null).verdict).toBe("review");
  });

  it("sends what it cannot judge to a person: a listing's own rivals, a non-English wording, an unread base", () => {
    const directory: SiteResult = {
      ...bakery,
      site: { ...bakery.site, listsOthers: true },
      locales: [{ location: "Germany", language: "de" }],
      questions: [],
    };
    const by = Object.fromEntries(checkSite(directory).map((check) => [check.check, check]));

    expect(by["3–5 rivals, none a listing, each with demand or AI evidence"]!.items).not.toContain("yelp.com lists or writes about businesses; it is not one");
    expect(by["the terms are in the site's own language and country"]!.verdict).toBe("review");
    expect(by["knowledge-base buyer questions are real questions, not headings"]!.verdict).toBe("review");
  });

  it("groups the failures by kind with the sites each affects", () => {
    const defects = defectsByKind([
      { domain: plumber.site.domain, checks: checkSite(plumber) },
      { domain: bakery.site.domain, checks: checkSite(bakery) },
      { domain: "second.example", checks: [{ check: "the category is specific, and is the business's own", verdict: "fail", detail: "x", items: [] }] },
    ]);

    expect(defects[0]).toMatchObject({ check: "the category is specific, and is the business's own" });
    expect(defects[0]!.sites.map((site) => site.domain)).toEqual(["baeckerei-muster.example", "second.example"]);
    expect(defects).toHaveLength(8);
  });

  it("fails a specific category that is another business's: a restaurant read as a product it promoted", () => {
    const restaurant: SiteResult = {
      ...plumber,
      site: { domain: "corner-cafe.example", kind: "restaurant", country: "US", language: "en", market: ["restaurant", "dining", "café"], why: "fixture" },
      market: { ...plumber.market!, category: "Cannabis edibles", synonyms: ["THC edibles"], searchTerm: "THC edibles" },
    };
    const [category] = checkSite(restaurant);

    expect(category).toMatchObject({ verdict: "fail", detail: '"Cannabis edibles" is not this business\'s market (restaurant: restaurant, dining, café)' });
    expect(checkSite({ ...restaurant, market: { ...restaurant.market!, category: "Mediterranean restaurant in San Francisco" } })[0]!.verdict).toBe("pass");
  });

  it("fails a knowledge base no page was read into, and lists a one-place business's national terms and rivals to read", () => {
    const local: SiteResult = { ...plumber, site: { ...plumber.site, place: ["austin"] }, knowledgePages: 0, questions: [] };
    const by = Object.fromEntries(checkSite(local).map((check) => [check.check, check]));

    expect(by["knowledge-base buyer questions are real questions, not headings"]).toMatchObject({ verdict: "fail", detail: "the knowledge base was not built: no page of the site was read into it" });
    expect(by["a local business is measured in its own place"]).toMatchObject({ verdict: "review" });
    expect(by["a local business is measured in its own place"]!.items).toEqual([
      "water heater repair cost",
      "how to unclog a drain",
      "rival: Radiant Plumbing (radiantplumbing.example)",
      "rival: Stan's Pipes (stanspipes.example)",
      "rival: Abacus (abacusplumbing.example)",
    ]);
  });

  it("knows a buyer's question from a heading, in English and German", () => {
    expect(["How long does a filling take?", "Wie lange dauert eine Lieferung", "Is parking available"].every(isRealQuestion)).toBe(true);
    expect(["Pricing", "Our services", "Häufige Fragen", "Why us?"].some(isRealQuestion)).toBe(false);
  });
});
