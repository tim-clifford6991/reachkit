// SPEC §6, owner D66 (issue 1311): a German site's searches, questions and
// tracked prompts are German, and a search's shape is read the same in
// either language. English is what it was before D66.
import { describe, expect, it } from "vitest";
import { SHAPES, languagePack, modelInstruction } from "@/lib/locale/language";
import { comparisonsOf } from "@/lib/market/infer/demand";
import { generatePrompts, promptTemplateOf } from "@/lib/market/prompts/generate";
import { buyerPrompts } from "@/lib/market/questions/buyer-prompts";
import { classifyIntent, passesRelevanceGuard } from "@/lib/market/questions/select";
import type { Profile } from "@/lib/market/questions/profile";
import { templateQuestion } from "@/lib/market/questions/template";
import { contentTypeOf } from "@/lib/opportunities/content-type";
import { slugify } from "@/lib/opportunities/derive/candidate";
import { sourceOf } from "@/lib/opportunities/derive/topics";

const BAKERY: Profile = {
  category: "Bäckerei",
  job: "frisches Brot und Brötchen kaufen",
  offeringType: "Handwerksbäckerei",
  audienceTerms: ["Familien in Düsseldorf"],
  namedRivals: [],
  vocabulary: ["Brot", "Brötchen", "Sauerteig", "Kuchen", "Düsseldorf"],
  brandTokens: ["Hinkel"],
  language: "de",
};

const MARKET = {
  category: "Bäckerei Düsseldorf",
  synonyms: ["Handwerksbäcker"],
  buyer: "Familien in Düsseldorf, die frisches Brot suchen",
  job: "frisches Brot kaufen",
  rivals: [
    { name: "Terbuyken", domain: "terbuyken.de" },
    { name: "Bäckerei Schüren", domain: "schueren.de" },
    { name: "Kamps", domain: "kamps.de" },
  ],
};

describe("a search's shape, in German and in English", () => {
  it.each([
    ["beste bäckerei düsseldorf", "decision"],
    ["best bakery near me", "decision"],
    ["kamps alternativen", "decision"],
    ["wie kann man sauerteig ansetzen", "problem"],
    ["how to make sourdough", "problem"],
    ["was ist sauerteig", "informational"],
  ])("%s is a %s search", (search, intent) => {
    expect(classifyIntent(search, { ...BAKERY, brandTokens: [] })).toBe(intent);
  });

  it("reads German page types from German words", () => {
    const row = (targetQuery: string) => ({ type: "keyword_page" as const, targetQuery });
    expect(contentTypeOf(row("brot backen anleitung"))).toBe("how_to");
    expect(contentTypeOf(row("bäckerei vergleich düsseldorf"))).toBe("listicle");
    expect(contentTypeOf(row("was ist sauerteig"))).toBe("documentation");
    expect(SHAPES.price.test("hochzeitstorte kosten")).toBe(true);
    expect(sourceOf("hochzeitstorte preise", { brands: [] })).toBe("product");
    expect(sourceOf("warum wird brot hart", { brands: [] })).toBe("problem");
  });

  it("keeps a word with an umlaut whole, and drops no letter of it from an address", () => {
    expect(SHAPES.pain.test("ölwechsel störung")).toBe(true);
    expect(slugify("Bäckerei Düsseldorf: Brötchen & Süßes")).toBe("backerei-dusseldorf-brotchen-susses");
  });

  it("writes a German site's new address as German does without umlauts (issue 1514)", () => {
    expect(slugify("Bäckerei Düsseldorf: Brötchen & Süßes", "de")).toBe("baeckerei-duesseldorf-broetchen-suesses");
    expect(slugify("ÖLWECHSEL Übersicht", "de")).toBe("oelwechsel-uebersicht");
    // An accent German has no convention for is dropped, as in English.
    expect(slugify("Café Crème", "de")).toBe("cafe-creme");
  });

  it("knows a German compound and a plural as the business's own words", () => {
    expect(passesRelevanceGuard("sauerteigbrot kaufen düsseldorf", BAKERY)).toBe(true);
    expect(passesRelevanceGuard("brote und kuchen in düsseldorf", BAKERY)).toBe(true);
    expect(passesRelevanceGuard("autowerkstatt düsseldorf", BAKERY)).toBe(false);
    // The same search read as English finds no word it knows but the place.
    expect(passesRelevanceGuard("brote und kuchen in düsseldorf", { ...BAKERY, language: undefined })).toBe(false);
  });
});

describe("what ReachKit writes for a German site", () => {
  it("words a search as a German question, whatever its shape", () => {
    expect(templateQuestion("beste bäckerei düsseldorf", "de")).toBe("Was sind die besten Empfehlungen für bäckerei düsseldorf?");
    expect(templateQuestion("kamps alternativen", "de")).toBe("Welche Alternativen gibt es zu kamps?");
    expect(templateQuestion("hochzeitstorte kosten", "de")).toBe("Was kostet hochzeitstorte?");
    expect(templateQuestion("Brötchen am Sonntag", "de")).toBe("Brötchen am Sonntag?");
    // English is unchanged.
    expect(templateQuestion("best crm for startups")).toBe("What's the best crm for startups?");
  });

  it("writes the comparison searches a German buyer types", () => {
    const rivals = MARKET.rivals.map((rival) => ({ ...rival, volume: 500 }));
    const searches = comparisonsOf({ rivals, product: "hinkel", ownSearched: true, searchedOnly: true, language: "de" }).map((c) => c.query);
    expect(searches).toContain("terbuyken alternative");
    expect(searches).toContain("hinkel vs kamps");
    expect(searches.some((search) => /alternatives/.test(search))).toBe(false);
  });

  it("builds the tracked prompts in German, as many as in English, with no English sentence among them", () => {
    const german = generatePrompts(MARKET, "Hinkel", "de");
    const english = generatePrompts(MARKET, "Hinkel", "en");
    expect(german).toHaveLength(english.length);
    expect(german.map((prompt) => prompt.kind)).toEqual(english.map((prompt) => prompt.kind));
    expect(german.filter((prompt) => /\b(?:which|what|the|tools|best)\b/i.test(prompt.text))).toEqual([]);
    expect(german.find((prompt) => prompt.kind === "persona")?.text).toBe("Wir sind Familien in Düsseldorf. Welcher Anbieter für Bäckerei Düsseldorf passt am besten zu uns?");
    // Each is known as a template, so a page never asks one template twice (D61).
    expect(german.filter((prompt) => promptTemplateOf(prompt.text) === null)).toEqual([]);
    expect(buyerPrompts({ ...MARKET, synonyms: [], rivals: [] }, 2, "de")[0]).toBe("Was sind die besten Anbieter für Bäckerei Düsseldorf?");
  });

  it("tells a model whose market it writes for, and tells it nothing for the United States in English", () => {
    expect(modelInstruction({ country: "US", language: "en" })).toBeNull();
    expect(modelInstruction({ country: "DE", language: "de" })).toMatch(/Germany.*German/);
    expect(modelInstruction({ country: "GB", language: "en" })).toMatch(/United Kingdom/);
    expect(languagePack("de").studySearch("sauerteig")).toBe("sauerteig Statistik Studie");
  });
});
