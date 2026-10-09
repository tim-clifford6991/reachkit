// SPEC §6 (2026-10-09, issue 1369): a rival whose name is the category's own
// words has no brand to read. Driven on the market the customer panel's
// pass of tattly.com stored on 2026-10-09, so nothing is bought.
import { describe, expect, it } from "vitest";
import { byDemand, comparisonsOf, keywordsOwed } from "@/lib/market/infer/demand";
import type { BrandDemand, MarketConclusion } from "@/lib/market/infer/types";
import { measuredMarketOf, neverMeasured } from "@/lib/market/questions/measured";
import { isCategoryName, withoutCategoryBrands, withoutCategoryNames, type MarketNames } from "@/lib/market/rivals/category-name";
import { rivalBrandOnly } from "@/lib/opportunities/derive/topics";
import { judgeQuery, type SiteResult } from "../../../scripts/panel/checks";
import stored from "../fixtures/tattly-panel-2026-10-09.json";

const market = (category: string, synonyms: string[] = [], searchTerm: string | null = null): MarketNames => ({ category, synonyms, searchTerm });

describe("a name that is only the category's words — English", () => {
  const tattoos = market("temporary tattoos", ["fake tattoos", "stick-on tattoos"], "temporary tattoos");
  const plumbing = market("plumbing repair and maintenance", ["plumbing services", "emergency plumbing"], "plumber austin");

  it.each([
    ["Temporary Tattoos", tattoos],
    ["temporary tattoo", tattoos],
    ["TemporaryTattoos", tattoos],
    ["The Fake Tattoos", tattoos],
    ["Best Temporary Tattoos Online", tattoos],
    ["Austin Plumber", plumbing],
    ["Emergency Plumbing Services", plumbing],
  ])("%s is the category's words", (name, m) => {
    expect(isCategoryName(name, m, "en")).toBe(true);
  });

  it.each([
    ["Inkbox", tattoos],
    ["Ink Bond", tattoos],
    ["Tattly", tattoos],
    ["Temporary Tattoos by Inkbox", tattoos],
    ["temporarytattoos.com", tattoos],
    ["Radiant Plumbing", plumbing],
    ["Beyond Wow Plumbing & Drains", plumbing],
    ["Best Online", tattoos],
    ["", tattoos],
  ])("%s is a name", (name, m) => {
    expect(isCategoryName(name, m, "en")).toBe(false);
  });
});

describe("a name that is only the category's words — German", () => {
  const bakery = market("Handwerksbäckerei", ["Bäckerei", "Traditionsbäckerei"], "bäckerei düsseldorf");

  it.each(["Bäckerei", "Die Bäckerei", "Bäckereien Düsseldorf", "Handwerksbäckerei", "Beste Bäckerei in Düsseldorf"])("%s is the category's words", (name) => {
    expect(isCategoryName(name, bakery, "de")).toBe(true);
  });

  // A joined word with a part of its own is a name: the rule under-reports.
  it.each(["Bäckerei Hinkel", "Stadtbäckerei", "Bäckerei Terbuyken", "Kamps", "baeckerei.de"])("%s is a name", (name) => {
    expect(isCategoryName(name, bakery, "de")).toBe(false);
  });
});

describe("tattly.com's stored market, read again", () => {
  const before = stored.market as unknown as MarketConclusion;
  const rivals = withoutCategoryNames(before.rivals, before, "en");
  const demand = withoutCategoryBrands(before.demand, before, { own: ["tattly"], language: "en" }) as BrandDemand;
  const after: MarketConclusion = { ...before, rivals: byDemand(rivals, demand), demand };

  it("holds the rival the pass called by the category's name", () => {
    expect(before.rivals[0]).toMatchObject({ domain: "temporarytattoos.com", name: "Temporary Tattoos", volume: 60500 });
    expect(before.demand?.brands["temporary tattoos"]).toBe(60500);
  });

  it("keeps that rival, called by its domain, and leaves every other as it was", () => {
    const rival = rivals.find((r) => r.domain === "temporarytattoos.com");
    expect(rival).toMatchObject({ name: "temporarytattoos.com", searchNames: ["temporarytattoos.com"] });
    expect(rivals.filter((r) => r.domain !== "temporarytattoos.com")).toEqual(before.rivals.slice(1));
  });

  it("reads no brand volume under the category's words, and buys none", () => {
    expect(Object.keys(demand.brands)).not.toContain("temporary tattoos");
    expect(Object.keys(demand.brands)).toHaveLength(Object.keys(before.demand?.brands ?? {}).length - 1);
    expect(keywordsOwed({ demand, rivals, own: ["tattly"], at: new Date(demand.at) })).toEqual([]);
  });

  it("ranks the rival by what its own address is searched, behind the brands buyers search", () => {
    expect(after.rivals.map((r) => [r.domain, r.volume])).toEqual([
      ["inkbox.com", 33100],
      ["easytatt.com", 720],
      ["ink-bond.com", 480],
      ["temporarytattoos.com", 140],
      ["tatteco.com", 90],
    ]);
  });

  it("derives no comparison from the category's words", () => {
    const searches = comparisonsOf({ rivals: after.rivals, product: "tattly", ownSearched: true, searchedOnly: false }).map((c) => c.query);
    expect(searches.filter((query) => query.includes("temporary tattoos"))).toEqual([]);
  });

  it("no measured search is left out as a rival's name", () => {
    const was = measuredMarketOf(before);
    const now = measuredMarketOf(after);
    expect(was && neverMeasured("temporary tattoos", was)).toBe("brand");
    for (const search of stored.searches) expect(now && neverMeasured(search, now)).not.toBe("brand");
    expect(rivalBrandOnly("temporary tattoos", { market: after, own: ["tattly"], rivals: [] })).toBe(false);
  });

  it("the panel's own check reads none of the twelve as a rival's search", () => {
    const site = (m: MarketConclusion): SiteResult => ({ site: stored.site, siteName: stored.siteName, market: m }) as unknown as SiteResult;
    const named = (m: MarketConclusion): string[] => stored.searches.filter((search) => /rival/.test(judgeQuery(search, site(m), "names")?.why ?? ""));
    expect(named(before)).toHaveLength(6);
    expect(named(after)).toEqual([]);
  });

  it("changes nothing where no name is the category's", () => {
    const others = before.rivals.slice(1);
    expect(withoutCategoryNames(others, before, "en")).toEqual(others);
    expect(withoutCategoryBrands(demand, before, { own: ["tattly"] })).toBe(demand);
  });
});
