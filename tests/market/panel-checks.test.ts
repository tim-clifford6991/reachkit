// tests/market/panel-checks.test.ts — the customer panel's checks (SPEC §0,
// owner 2026-10-07, issue 1304).
//
// `npm run panel` holds a pass to what a business is, for every kind of
// business. Driven on two fixture results — a local plumber the pass read
// well, and a German bakery it read as an American software company — so
// nothing is bought.
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { checkComparisonDemand, checkSite, countPageQuestions, defectsByKind, isRealQuestion, saidOf, type CheckResult, type SiteResult } from "../../scripts/panel/checks";

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

    // The last is the tracked prompts: this fixture is a run stored before
    // their kind was recorded (D69), which a person reads.
    expect(verdicts(checks)).toEqual(["pass", "pass", "pass", "pass", "pass", "pass", "pass", "pass", "pass", "pass", "review"]);
  });

  it("fails a German bakery read as an American software company, and says what is wrong", () => {
    const checks = checkSite(bakery);
    const by = Object.fromEntries(checks.map((check) => [check.check, check]));

    expect(verdicts(checks)).toEqual(["fail", "fail", "fail", "fail", "fail", "fail", "fail", "fail", "pass", "pass", "review"]);
    expect(by["the category is specific, and is the business's own"]!.detail).toContain("names no market");
    expect(by["the terms are in the site's own language and country"]!.detail).toContain("a de site in Germany was read in United States / en");
    expect(by["3–5 rivals, none a listing, each with demand or seen by the pass"]!.items).toEqual([
      "2 rivals, not 3–5",
      "yelp.com lists or writes about businesses; it is not one",
      "kamps.example does not resolve: no such site",
      "Kamps (kamps.example) has no brand demand, and no AI answer or top ten of this pass shows it",
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

    expect(found["3–5 rivals, none a listing, each with demand or seen by the pass"]!.items).toEqual([
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

  it("counts the questions of the pages the base reads, never a privacy policy's headings (issue 1414, streaksapp.com)", () => {
    const policy = "<body><main><h2>What information does the app obtain and how is it used?</h2><p>We collect nothing.</p><h2>What are my opt-out rights?</h2><p>Delete the app.</p></main></body>";
    const faq = "<body><main><h2>Does the app work on a watch?</h2><p>It does.</p></main></body>";
    expect(countPageQuestions([{ url: "https://habits.example/privacy.html", html: policy }])).toBe(0);
    expect(countPageQuestions([{ url: "https://habits.example/privacy.html", html: policy }, { url: "https://habits.example/faq", html: faq }])).toBe(1);
  });

  it("says what the pass's own log gave as the reason, each once with its count (issue 1414, wesbos.com)", () => {
    const timeout = { event: "vendor_call", source: "ai_optimization/chat_gpt/llm_scraper", outcome: "failed", failure: "deadline", reason: "task not ready by the deadline" };
    expect(
      saidOf([
        { event: "drivers_measured", aiPresence: "unmeasured" },
        { event: "site_profile_undeterminable", because: "ledger.ts: insert into fetches failed: unsupported Unicode escape sequence" },
        timeout,
        timeout,
      ])
    ).toEqual([
      "site_profile_undeterminable: ledger.ts: insert into fetches failed: unsupported Unicode escape sequence",
      "vendor_call ai_optimization/chat_gpt/llm_scraper: task not ready by the deadline (2 times)",
    ]);
  });

  it("sends what it cannot judge to a person: a listing's own rivals, a non-English wording, an unread base", () => {
    const directory: SiteResult = {
      ...bakery,
      site: { ...bakery.site, listsOthers: true },
      locales: [{ location: "Germany", language: "de" }],
      questions: [],
    };
    const by = Object.fromEntries(checkSite(directory).map((check) => [check.check, check]));

    expect(by["3–5 rivals, none a listing, each with demand or seen by the pass"]!.items).not.toContain("yelp.com lists or writes about businesses; it is not one");
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

  it("fails a knowledge base no page was read into, and lists a one-place business's national terms and rivals to read where a run was stored before D67", () => {
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
    expect(by["the tracked prompts fit the kind of business"]).toMatchObject({ verdict: "review" });
  });

  it("holds a local business to its place (D67): its searches, where they were read, and its national rivals", () => {
    const check = "a local business is measured in its own place";
    const austin: SiteResult = {
      ...plumber,
      site: { ...plumber.site, place: ["austin"] },
      searches: ["emergency plumber austin", "plumber near me"],
      locales: [{ location: "United States", language: "en" }, { location: "Austin,Texas,United States", language: "en" }],
      area: { place: "Austin", location: "Austin,Texas,United States" },
      resultDomains: ["radiantplumbing.example", "yelp.com"],
    };
    expect(checkSite(austin).find((c) => c.check === check)).toMatchObject({ verdict: "pass" });

    const national: SiteResult = {
      ...austin,
      searches: ["emergency plumber austin", "water heater repair cost"],
      market: { ...austin.market!, rivals: [...austin.market!.rivals, { domain: "rotorooter.example", name: "Roto-Rooter", basis: "same_job", reason: "", national: true }] },
    };
    expect(checkSite(national).find((c) => c.check === check)).toMatchObject({
      verdict: "fail",
      items: ["not asked of the place: water heater repair cost", "Roto-Rooter (rotorooter.example) is a national chain no result of this pass showed"],
    });
    expect(checkSite({ ...austin, area: null }).find((c) => c.check === check)!.items[0]).toBe("the pass stored no place: it was measured as a business that sells nationally");
    // And a business that sells everywhere is not measured in one place.
    expect(checkSite({ ...plumber, area: { place: "Austin", location: null } }).at(-1)).toMatchObject({ verdict: "fail", detail: "stored as serving Austin" });
  });

  it("holds the tracked prompts to the kind of business (D69) and a local site's to its place", () => {
    const check = "the tracked prompts fit the kind of business";
    const site = { ...plumber.site, place: ["austin"], kinds: ["local-service"] };
    const good: SiteResult = {
      ...plumber,
      site,
      market: { ...plumber.market!, kind: "local-service" },
      prompts: [{ kind: "category", text: "Looking for the best plumber in Austin. Who would you recommend, and why?" }, { kind: "comparison", text: "What are the best alternatives to Radiant Plumbing?" }],
    };
    expect(checkSite(good).find((c) => c.check === check)).toMatchObject({ verdict: "pass" });
    const odd: SiteResult = {
      ...good,
      market: { ...plumber.market!, kind: "software" },
      prompts: [{ kind: "use-case", text: "Which plumber tools have a free trial?" }],
    };
    expect(checkSite(odd).find((c) => c.check === check)).toMatchObject({
      verdict: "fail",
      items: ["recorded as software; it is local-service", "does not name the place: Which plumber tools have a free trial?"],
    });
    expect(checkSite({ ...good, prompts: [{ kind: "use-case", text: "Which plumber in Austin tools have a free trial?" }] }).find((c) => c.check === check)!.items).toEqual([
      "asks as a software buyer does: Which plumber in Austin tools have a free trial?",
    ]);
  });

  it("knows a buyer's question from a heading, in English and German", () => {
    expect(["How long does a filling take?", "Wie lange dauert eine Lieferung", "Is parking available"].every(isRealQuestion)).toBe(true);
    expect(["Pricing", "Our services", "Häufige Fragen", "Why us?"].some(isRealQuestion)).toBe(false);
  });
});

describe("issue 1506: a ready \"vs\" between products has measured demand, on every stored panel run", () => {
  const panel: SiteResult["site"][] = JSON.parse(readFileSync("docs/walk/panel/sites.json", "utf8")).sites;
  // Every stored run, the dated ones `--recheck --date` cannot reach
  // included: the six kinds of business, in English and in German.
  const runs = readdirSync("docs/walk/panel").filter((file) => /^2026-\d\d-\d\d(-\d+)?\.json$/.test(file));
  const results = runs.flatMap((file) =>
    (JSON.parse(readFileSync(`docs/walk/panel/${file}`, "utf8")).sites as (SiteResult & { site: { domain: string } })[]).flatMap((held) => {
      const site = panel.find((entry) => entry.domain === held.site.domain);
      return site === undefined ? [] : [{ file, result: { ...held, site } as SiteResult }];
    })
  );

  it("covers the six kinds, and a German site", () => {
    const kinds = new Set(results.flatMap(({ result }) => result.site.kinds ?? []));
    expect([...kinds].sort()).toEqual(["creator", "hospitality", "local-service", "professional-services", "shop", "software"]);
    expect(results.some(({ result }) => result.site.language === "de")).toBe(true);
  });

  it("each run passes, and the comparisons nobody was measured asking are held back for every kind that had one", () => {
    const failed = results
      .map(({ file, result }) => ({ file, domain: result.site.domain, check: checkComparisonDemand(result) }))
      .filter(({ check }) => check.verdict !== "pass");
    expect(failed).toEqual([]);
    const heldIn = new Set(
      results.filter(({ result }) => checkComparisonDemand(result).items.length > 0).flatMap(({ result }) => result.site.kinds ?? [])
    );
    expect([...heldIn].sort()).toEqual(["creator", "hospitality", "local-service", "professional-services", "shop", "software"]);
  });

  it("a comparison of the business with a rival, unmeasured, is held unless a tracked prompt names the rival", () => {
    const topic = { query: "northside plumbing vs radiant plumbing", status: "open", type: "comparison_page", fit: 3, volume: null, ready: true };
    expect(checkComparisonDemand({ ...plumber, topics: [topic], prompts: [] }).items).toEqual([
      "northside plumbing vs radiant plumbing — held back: no measured volume and no prompt names its rival",
    ]);
    const prompt = { kind: "comparison", text: "Is Radiant Plumbing better than other plumbers in Austin?" };
    expect(checkComparisonDemand({ ...plumber, topics: [topic], prompts: [prompt] })).toMatchObject({ verdict: "pass", items: [] });
  });
});
