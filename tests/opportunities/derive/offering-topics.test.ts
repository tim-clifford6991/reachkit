// A short site is offered a topic for each further line it sells, never one per town, and its buyers' problem
// searches before the comparisons `max` would otherwise keep.
import { describe, expect, it } from "vitest";
import type { Place } from "../../../src/lib/locale/locales";
import type { MarketConclusion } from "../../../src/lib/market/infer/types";
import type { Offering, Profile } from "../../../src/lib/market/questions/profile-types";
import { proposedTopics } from "../../../src/lib/opportunities/derive/topics";
import { defaultReport } from "../fixtures";

const market = (buyer: string, serves?: Place): MarketConclusion => ({
  buyer, job: "", category: "", synonyms: [], differentiators: [], notOurMarket: [], categoryReason: "", rivals: [], ...(serves ? { serves } : {}),
});

function reportSelling(offerings: Offering[], over: Partial<Profile> = {}) {
  const report = defaultReport();
  if (report.market.kind === "unmeasured") throw new Error("the fixture report holds a market");
  const profile = { ...report.market.value.profile, category: offerings[0]!.category, offerings, ...over };
  return { ...report, market: { ...report.market, value: { ...report.market.value, profile } } };
}

const line = (category: string, weight: number): Offering => ({ name: category, category, weight });

function offeringsProposed(a: { report: ReturnType<typeof reportSelling>; market: MarketConclusion; short?: boolean; language?: "en" | "de" }) {
  return proposedTopics({ ...a, taken: [], ownRanked: 0, max: 40, short: a.short ?? true })
    .filter((topic) => topic.offering === true)
    .map(({ query, source, composed }) => ({ query, source, composed }));
}

describe("a short site's further lines become topics", () => {
  it("a café that also does breakfast and catering is offered both lines for its buyer and with a price", () => {
    const report = reportSelling([line("coffee shop", 0.5), line("breakfast", 0.3), line("event catering", 0.2)]);
    expect(offeringsProposed({ report, market: market("office workers") })).toEqual([
      { query: "breakfast for office workers", source: "product", composed: true },
      { query: "breakfast pricing", source: "product", composed: true },
      { query: "event catering for office workers", source: "product", composed: true },
      { query: "event catering pricing", source: "product", composed: true },
    ]);
  });

  it("a German bakery that also makes wedding cakes is offered that line in German", () => {
    const report = reportSelling([line("Bäckerei", 0.6), line("Hochzeitstorten", 0.4)], { language: "de" });
    expect(offeringsProposed({ report, market: market("Brautpaare"), language: "de" }).map((topic) => topic.query)).toEqual([
      "hochzeitstorten für brautpaare",
      "hochzeitstorten preise",
    ]);
  });

  it("a business that sells one line, or a site already holding a week, is offered none", () => {
    expect(offeringsProposed({ report: reportSelling([line("accounting", 1)]), market: market("small businesses") })).toEqual([]);
    const report = reportSelling([line("accounting", 0.6), line("payroll", 0.4)]);
    expect(offeringsProposed({ report, market: market("small businesses"), short: false })).toEqual([]);
  });
});

describe("an offering's topic never carries a place (doorway policy)", () => {
  it("a line named with the town it serves is offered without it, and a line that differs only by a town is none", () => {
    const austin = { name: "Austin", region: "TX" };
    const report = reportSelling([line("drain cleaning", 0.4), line("plumbing Austin", 0.3), line("drain cleaning Round Rock", 0.3)], { town: "Austin" });
    const queries = offeringsProposed({ report, market: market("homeowners", austin) }).map((topic) => topic.query);
    expect(queries).toEqual(["plumbing for homeowners", "plumbing pricing"]);
    expect(queries.filter((query) => /austin|round rock/.test(query))).toEqual([]);
  });

  it("the site's stored town is taken out even where the market names no place", () => {
    const report = reportSelling([line("hair salon", 0.6), line("wedding makeup Leeds", 0.4)], { town: "Leeds" });
    expect(offeringsProposed({ report, market: market("brides") }).map((topic) => topic.query)).toEqual(["wedding makeup for brides", "wedding makeup pricing"]);
  });
});

describe("a short site's written problems are offered before the comparisons", () => {
  const problems = ["how to fix a leaking tap", "why is my boiler pressure low", "how to unblock a sink", "how often to service a boiler"];
  const comparisons = ["rival one vs rival two", "rival three vs rival four", "rival five vs rival six"].map((query) => ({ query, rival: "rival.example" }));
  const report = reportSelling([line("plumbing", 1)]);
  const proposed = (short?: boolean) =>
    proposedTopics({ report, market: market("homeowners"), taken: [], ownRanked: 0, max: problems.length, comparisons, written: problems, ...(short === undefined ? {} : { short }) });

  it("with `max` set to cut, a short site keeps every written problem", () => {
    expect(proposed(true).map((topic) => topic.query)).toEqual(problems);
  });

  it("a full site keeps today's order, where `max` cuts problems first", () => {
    expect(proposed(false)).toEqual(proposed());
    expect(proposed(false).filter((topic) => problems.includes(topic.query)).length).toBeLessThan(problems.length);
  });
});
