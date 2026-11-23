// A how-to query on a vendor results page falls to documentation and keeps its research and its outside sources.
import "./env";
import { expect, it } from "vitest";
import { citesMinOf } from "../../src/lib/generate/rules/brief-lines";
import { builtFromOutside, fittedTemplate, meetsStandard, missingFrom, ownTypeOf, researchedAs, typeTheResearchFills, type ResearchRead } from "../../src/lib/generate/standard";
import { TEMPLATES } from "../../src/lib/generate/templates";
import { opportunity, pack } from "./fixtures";

const row = opportunity({ type: "keyword_page", targetQuery: "how to check if a chatbot names my shop" });
const vendors = ["one", "two", "three", "four", "five"].map((name) => ({ domain: `${name}.example`, url: `https://${name}.example/` }));
const read: ResearchRead = { R: 1, Q: 0, F: 0, stepPages: 0, asked: 0, urls: [], top: vendors, facts: 6 };

it("keeps the how-to's research and sources need on the documentation page it falls to", () => {
  const type = typeTheResearchFills(row, read)!, own = ownTypeOf(row, read)!;
  expect([type, own]).toEqual(["documentation", "how_to"]);
  const fallen = pack({ type, own, claims: [], questions: [] });
  expect(researchedAs(type, own)).toBe("how_to");
  expect(builtFromOutside(type, own)).toBe(true);
  expect(citesMinOf(fittedTemplate(fallen))).toBe(citesMinOf(TEMPLATES.how_to));
  const missing = missingFrom(fallen);
  expect(missing).toContain("outside_sources");
  expect(meetsStandard({ pack: { ...fallen, missing } }).met).toBe(false);
});

it("holds a refresh of a how-to to the how-to's outside sources", () => {
  const live = { url: "https://shop.example/guide", title: "Guide", markdown: "# Guide\n\nThe old text.", why: null, type: "how_to" };
  expect(missingFrom(pack({ type: "update", claims: [], questions: [], live }))).toContain("outside_sources");
});
