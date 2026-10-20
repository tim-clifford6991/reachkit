// SPEC §7, nothing invented (SEO shape ruling on issue 1618, 2026-10-20): an
// offering page for a list-shaped search leaves the search's "best" and
// "top" words out of its title, its H1 and its description, unless the
// business's own pages state them. Laid out by code; no model.
import "../env";
import { describe, expect, it } from "vitest";
import { layoutPage } from "../../../src/lib/generate/pipeline/compose";
import { titleRuleFor, unclaimedSuperlatives } from "../../../src/lib/generate/pipeline/title";
import { titleFaults } from "../../../src/lib/generate/rules/title";
import { pack } from "../fixtures";
import type { PageParts } from "../../../src/lib/generate/pipeline/write";
import { TEMPLATES } from "../../../src/lib/generate/templates";
import type { ContentType } from "../../../src/lib/opportunities/content-type";

const SEARCH = "best dentist portland";

const PARTS: PageParts = {
  titles: ["Best Dentist Portland: Cleanings from $95"],
  slug: "dentist-portland",
  description: "The best dentist in Portland for a cleaning: $95, evenings and Saturdays, booked online in two minutes.",
  answer: "A cleaning at the practice costs $95 and takes forty minutes, with evening and Saturday times you can book online.",
  takeaways: ["A cleaning is $95.", "Evenings and Saturdays.", "Booked online."],
  sections: [{ key: "what", heading: "What is a cleaning at the practice?", body: "A forty-minute cleaning and check." }],
  closing: "Book a cleaning online.",
  faq: [],
  updated: "",
};

function offeringPack(type: ContentType, stated: string[] = []) {
  const base = pack();
  return pack({ type, target: { question: `Who is the ${SEARCH}?`, searches: [SEARCH] }, facts: [...base.facts, ...stated.map((passage) => ({ ...base.facts[0]!, passage }))], pages: [] });
}

function laidFor(type: ContentType, stated: string[] = []) {
  return layoutPage(PARTS, TEMPLATES[type], { facts: stated, promises: [], queries: [SEARCH], names: ["Portland"], unclaimed: unclaimedSuperlatives(offeringPack(type, stated)) }).body;
}

describe("an offering page claims no superlative its own pages do not state", () => {
  it("its title, H1 and description drop the search's best", () => {
    const body = laidFor("offering");
    expect(body.title).toBe("Dentist Portland: Cleanings from $95");
    expect(body.heading).toBe(body.title);
    expect(body.description).not.toMatch(/\bbest\b/i);
    expect(body.description).toMatch(/^The dentist in Portland/);
    // The title check reads the search without the word too, so it does not stop the title.
    expect(titleFaults(body.title, titleRuleFor(offeringPack("offering"), { description: body.description }))).not.toContain("term");
  });

  it("keeps it where the business's own pages say it", () => {
    expect(laidFor("offering", ["Voted best dentist in Portland by readers of the Portland Mercury, 2025."]).title).toMatch(/^Best dentist/i);
  });

  it("a listicle on the same search keeps its words", () => {
    expect(laidFor("listicle").description).toMatch(/\bbest\b/);
  });
});
