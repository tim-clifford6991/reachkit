// SPEC §6 "Its own name is never a topic", on the asked path too: a search
// that names the business wants its own site, so it is never a new page,
// unless it sets the business against a named rival (D50). 0¢.
import "../env";
import { describe, expect, it } from "vitest";
import type { MarketConclusion } from "../../../src/lib/market/infer/types";
import type { Profile } from "../../../src/lib/market/questions/profile";
import { measured } from "../../../src/lib/measure/measured";
import type { StoredReport } from "../../../src/lib/scan/report";
import {
  askedOnMarket,
  askedSupply,
  askedTopics,
  brandsOf,
  comparisonBrands,
  comparisonUnasked,
  namesAnyBrand,
  noLongerRelevant,
  proposedTopics,
} from "../../../src/lib/opportunities/derive/topics";
import { AT, question, reportOf, serp } from "../fixtures";
import { panelSite, storedPayloads } from "../../golden/plan/panel";

function siteReport(domain: string, profile: Partial<Profile>): StoredReport {
  const report = reportOf({ questions: [question()], serps: [serp()] });
  if (report.market.kind === "unmeasured") throw new Error("the fixture report holds a market");
  const market = measured({ ...report.market.value, profile: { ...report.market.value.profile, ...profile } }, AT);
  return { ...report, domain, market } as StoredReport;
}

const REACHKIT_MARKET: MarketConclusion = {
  buyer: "marketing teams",
  job: "get named in AI answers",
  category: "AI visibility software",
  synonyms: [],
  differentiators: [],
  notOurMarket: [],
  categoryReason: "",
  rivals: [{ domain: "tryprofound.com", name: "Profound", basis: "ranks", reason: "", volume: 6600 }],
  demand: { at: "2026-10-05T00:00:00.000Z", own: 880, brands: { profound: 6600 } },
};

const SITES = {
  "baeckerei-hinkel.de": { report: siteReport("baeckerei-hinkel.de", { category: "Bäckerei", brandTokens: ["Bäckerei Hinkel"] }), market: null },
  "stripe.com": {
    report: siteReport("stripe.com", { category: "payment processing platform", vocabulary: [], brandTokens: ["Stripe", "Payments"] }),
    market: null,
  },
  "reachkit.app": { report: siteReport("reachkit.app", { category: "AI visibility software", brandTokens: ["ReachKit"] }), market: REACHKIT_MARKET },
} as const;

const onMarket = (domain: keyof typeof SITES, query: string): boolean => {
  const { report, market } = SITES[domain];
  return askedOnMarket(query, { market, ...brandsOf({ report, market }) });
};

describe("a search that names the business is never a topic, on the asked path", () => {
  it.each([
    ["baeckerei-hinkel.de", "bäckerei hinkel schließt"],
    ["stripe.com", "stripe payments"],
    ["reachkit.app", "reachkit pricing"],
    ["reachkit.app", "reachkit alternatives"],
  ] as const)("%s: %s is not asked on the market", (domain, query) => {
    expect(onMarket(domain, query)).toBe(false);
  });

  it("a category word is not the business's name, and the business against a rival stays", () => {
    expect(onMarket("stripe.com", "payment gateway")).toBe(true);
    expect(onMarket("reachkit.app", "reachkit vs profound")).toBe(true);
  });

  it("askedSupply writes no section on the business's own name", () => {
    const { report, market } = SITES["stripe.com"];
    const spare = ["how does stripe payments work", "how does a payment gateway work"].map((query) => ({
      topic: { query, source: "problem" as const, volume: null, rival: null, asked: { term: "payment gateway", serpAt: AT } },
      fit: 2 as const,
    }));
    const supply = askedSupply({ report, market, asked: [], spare, refused: [], taken: [], dismissed: [], now: AT });
    expect(supply.map((row) => row.topic.query)).toEqual(["how does a payment gateway work"]);
  });
});

describe("the business against a named rival stays a Write only where it is observed", () => {
  const { report, market } = SITES["reachkit.app"];
  const asked = ["reachkit vs profound", "reachkit alternatives", "reachkit pricing"].map((query) => ({ query, term: "ai visibility software", serpAt: AT }));

  it("seen asked, the comparison is proposed, and the business's own alternatives and price are not", () => {
    const proposed = proposedTopics({ report, market, taken: [], ownRanked: 0, max: 80, asked, written: ["reachkit pricing"] });
    expect(proposed.map((topic) => topic.query).filter((query) => query.startsWith("reachkit"))).toEqual(["reachkit vs profound"]);
  });

  it("with no volume and seen asked nowhere, it is unobserved", () => {
    const brands = comparisonBrands({ report, market });
    expect(comparisonUnasked({ query: "reachkit vs profound", volume: 0, brands, prompts: [] })).toBe(true);
    const seen = [{ term: "ai visibility software", peopleAlsoAsk: [], related: ["reachkit vs profound"], at: AT }];
    expect(comparisonUnasked({ query: "reachkit vs profound", volume: 0, brands, prompts: [], asked: seen })).toBe(false);
  });
});

describe("baeckerei-hinkel.de's stored search results, through the asked path", () => {
  it("lose only the searches that name the bakery", () => {
    const site = panelSite("baeckerei-hinkel.de");
    const seen = [...storedPayloads("baeckerei-hinkel.de", "every").values()].map(({ search, at, serp: stored }) => ({
      term: search,
      peopleAlsoAsk: stored.peopleAlsoAsk ?? [],
      related: stored.relatedSearches ?? [],
      at,
    }));
    const queries = askedTopics(seen, AT, Number.POSITIVE_INFINITY).map((topic) => topic.query);
    const report = siteReport(site.domain, site.profile);
    const { own, rivals } = brandsOf({ report, market: site.market });
    // What the asked path kept before this rule: the searches on the market in force.
    const before = queries.filter((query) => noLongerRelevant(query, { market: site.market, own }) === null);
    const after = new Set(queries.filter((query) => askedOnMarket(query, { market: site.market, own, rivals })));
    const lost = before.filter((query) => !after.has(query));
    expect(lost).toEqual(before.filter((query) => namesAnyBrand(query, own)));
    expect(lost).toEqual([
      "bäckerei hinkel düsseldorf",
      "bäckerei hinkel düsseldorf brotsorten",
      "bäckerei hinkel schließt",
      "bäckerei hinkel düsseldorf online shop",
      "bäckerei hinkel düsseldorf filialen",
      "bäckerei hinkel online-shop",
      "bäckerei hinkel produkte",
    ]);
    expect(before.length - lost.length).toBe(218);
  });
});
