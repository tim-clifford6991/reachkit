// SPEC §7 title specific: an informational page's title carries the page's own
// evidence, never the business's promise; the offering page still may. No model.
import "../env";
import { describe, expect, it } from "vitest";
import { titleBrief, titleRuleFor } from "../../../src/lib/generate/pipeline/title";
import { titleFaults } from "../../../src/lib/generate/rules/title";
import { pack } from "../fixtures";
import stored from "../fixtures/dogfood-promise-titles-2026-10.json";
import type { ContentType } from "../../../src/lib/opportunities/content-type";

type Evidence = { title: string; type: string; factsUsed: string[]; profileItems: string[]; marketFacts: string[] };

/** A pack as the stored draft's meta records it: the site's facts it used, its profile, its market facts. */
function packOf(row: Evidence, type: ContentType = row.type as ContentType) {
  const base = pack();
  return pack({
    type,
    target: { question: row.title, searches: [] },
    facts: row.factsUsed.map((passage) => ({ ...base.facts[0]!, passage })),
    claims: row.marketFacts.map((passage) => ({ ...base.claims[0]!, passage })),
    profile: { job: null, products: [], audience: [], promises: row.profileItems, vocabulary: [] },
  });
}

const aeoVsGeo = stored.drafts.find((row) => row.type === "documentation")!;
const PROMISE = /7 pages a week/;

describe("a stored dogfood draft's title inputs", () => {
  it.each(stored.drafts)("on the $type page, what the title may hold carries no promise", (row) => {
    expect(titleRuleFor(packOf(row), { description: "" }).holds).not.toMatch(PROMISE);
  });

  it("the documentation page's promise title now lacks its specific", () => {
    expect(aeoVsGeo.title).toBe("AEO vs GEO: the difference in up to 7 pages a week");
    expect(titleFaults(aeoVsGeo.title, titleRuleFor(packOf(aeoVsGeo), aeoVsGeo))).toContain("specific");
  });

  it("the same pack as an offering page still holds the promise as its figure", () => {
    expect(titleRuleFor(packOf(aeoVsGeo, "offering"), { description: "" }).holds).toMatch(PROMISE);
    expect(titleFaults(aeoVsGeo.title, titleRuleFor(packOf(aeoVsGeo, "offering"), aeoVsGeo))).not.toContain("specific");
  });
});

// A local business: its promise is a figure the brief lists, so the brief itself is held to it.
const PLUMBER = { title: "Boiler noises: why they happen, fixed 24/7 in 2 hours", factsUsed: ["Our plumbers answer 24/7 and reach you in 2 hours."], marketFacts: [] };
const plumber = (type: ContentType) => packOf({ ...PLUMBER, type, profileItems: PLUMBER.factsUsed });

describe("a plumber's title brief", () => {
  it("offers no promise figure on a Q&A page", () => {
    expect((titleBrief(plumber("qa")).figures as string[]).join("\n")).not.toMatch(/24\/7/);
    expect(titleFaults(PLUMBER.title, titleRuleFor(plumber("qa"), { description: "" }))).toContain("specific");
  });

  it("still offers it on the offering page", () => {
    expect((titleBrief(plumber("offering")).figures as string[]).join("\n")).toMatch(/24\/7/);
  });
});
