// tests/generate/pipeline/repetition-1509.test.ts — issue 1509: each page
// says something its sibling pages do not.
//
// A business fact already stated on two or more of the site's live pages is
// offered last, for every kind of business and in any language; the closing
// section on how the business handles the question says at most two of its
// promises; and the stored-row check counts the share of a page's
// business-fact passages its siblings already state.
import "../env";
import { describe, expect, it } from "vitest";
import { PACK, PAGE_BLOCKS } from "../../../src/lib/config/constants";
import { buildPack, freshFirst, repeatedFactShare, type PackInputs } from "../../../src/lib/generate/pipeline/pack";
import { layoutPage, withPromisesAtMost } from "../../../src/lib/generate/pipeline/compose";
import { TEMPLATES } from "../../../src/lib/generate/templates";
import type { SourcedFact } from "../../../src/lib/generate/pipeline/grounding";
import { AT, opportunity, pageParts, report } from "../fixtures";

const sourced = (passage: string, path = "/about"): SourcedFact => ({
  fact: { url: `https://example.com${path}`, readAt: AT, passage },
  sourceText: passage,
});

/** One business of each of the six kinds, in its own language: the fact
 *  every page so far has led with, and two it has not said yet. */
const PANEL = [
  { kind: "hospitality", language: "en", said: "Open since 1998 on the harbour front.", fresh: ["Breakfast is served until noon.", "Every cake is baked in the back kitchen."] },
  { kind: "local-service", language: "de", said: "Meisterbetrieb seit 1987 in Köln.", fresh: ["Notdienst an Wochenenden.", "Kostenvoranschlag vor Ort ohne Gebühr."] },
  { kind: "shop", language: "en", said: "Free delivery on orders over €40.", fresh: ["Every frame is cut to order.", "Returns within 30 days."] },
  { kind: "professional-services", language: "de", said: "Über 200 Mandanten im Mittelstand.", fresh: ["Festpreise für Jahresabschlüsse.", "Beratung auch per Video."] },
  { kind: "software", language: "en", said: "Trusted by 4,000 teams worldwide.", fresh: ["Boards sync offline.", "One flat fee for the whole team."] },
  { kind: "creator", language: "en", said: "Over 12,000 students have taken the course.", fresh: ["Lessons are 10 minutes each.", "Every module ends with a worksheet."] },
] as const;

/** A live page that states `passage` inside a sentence of its own, as a
 *  writer folds a fact into the prose. */
const livePage = (passage: string, topic: string) => `## ${topic}\n\nA word on ${topic}. **${passage}** And more on [${topic}](https://example.com/).`;

function inputs(facts: readonly SourcedFact[], livePages: readonly string[]): PackInputs {
  return {
    type: "qa",
    opportunity: opportunity(),
    site: { businessName: "Example", domain: "example.com", doNotClaim: [], rivals: [] },
    category: "anything",
    byline: null,
    voice: null,
    profile: null,
    facts,
    research: { facts: [], products: [] },
    report: report(),
    sitePages: [],
    links: [],
    now: AT,
    livePages,
  };
}

describe("a business fact said on two live pages is offered last", () => {
  for (const business of PANEL) {
    it(`${business.kind} (${business.language}): "${business.said}" is not what the next page leads with`, () => {
      const facts = [sourced(business.said), ...business.fresh.map((passage, index) => sourced(passage, `/p${index}`))];
      const live = [livePage(business.said, "one"), livePage(business.said.toUpperCase(), "two")];
      const pack = buildPack(inputs(facts, live));
      expect(pack.facts.map((fact) => fact.passage)).toEqual([...business.fresh, business.said]);
    });
  }

  it("said on one live page only, or with no live pages read, it keeps its place", () => {
    const facts = [sourced(PANEL[0].said), sourced(PANEL[0].fresh[0])];
    expect(freshFirst(facts, [livePage(PANEL[0].said, "one")]).map((each) => each.fact.passage)).toEqual([PANEL[0].said, PANEL[0].fresh[0]]);
    expect(PACK.repeatedOn).toBe(2);
    // With no live pages read, the order is the one the facts came in.
    expect(buildPack({ ...inputs(facts, []), livePages: undefined }).facts.map((fact) => fact.passage)).toEqual([PANEL[0].said, PANEL[0].fresh[0]]);
  });
});

describe("the closing section says at most two of the business's promises", () => {
  const PROMISES = ["We answer every call within one hour.", "Every repair comes with a two year warranty.", "Quotes are always free of charge."];

  it("a sentence that would say a third is dropped, and the section keeps the rest", () => {
    const body = [
      "We answer every call within one hour, day or night.",
      "Every repair comes with a two year warranty on parts.",
      "Quotes are always free of charge for homeowners.",
      "Book online from the contact page.",
    ].join(" ");
    const out = withPromisesAtMost(body, PROMISES);
    expect(out).toBe("We answer every call within one hour, day or night. Every repair comes with a two year warranty on parts. Book online from the contact page.");
    expect(PAGE_BLOCKS.businessPromises).toBe(2);
  });

  it("is applied to the business section of a laid-out page and to no other", () => {
    const parts = pageParts();
    const third = "Quotes are always free of charge for every team.";
    const said = `We answer every call within one hour. Every repair comes with a two year warranty. ${third}`;
    // Said once in a question's section, so the page's own cap of two a
    // promise (`taglineRepeats`) is not what keeps it out of the closing.
    const sections = parts.sections.map((section, index) =>
      section.key === "business" ? { ...section, body: `${section.body}\n\n${said}` } : index === 0 ? { ...section, body: `${section.body}\n\n${third}` } : section
    );
    const laid = layoutPage({ ...parts, sections }, TEMPLATES.qa, { facts: [], promises: PROMISES, queries: ["q"], names: ["Acme"] });
    const markdown = laid.body.bodyMarkdown;
    const business = markdown.slice(markdown.lastIndexOf("\n## "));
    expect(business).toContain("We answer every call within one hour.");
    expect(business).not.toContain(third);
    expect(markdown).toContain(third);
  });
});

describe("the stored-row check: the share of a page's business facts its siblings already say", () => {
  const facts = ["Open since 1998 on the harbour front.", "Breakfast is served until noon.", "Every cake is baked in the back kitchen.", "Not on this page at all."] as const;
  const page = facts.slice(0, 3).map((passage, index) => livePage(passage, `t${index}`)).join("\n\n");

  it("is one in three where one of three stated facts is on two other live pages", () => {
    const others = [livePage(facts[0], "a"), livePage(facts[0], "b"), livePage(facts[1], "c")];
    expect(repeatedFactShare({ markdown: page, facts, others })).toBeCloseTo(1 / 3);
  });

  it("is zero where no sibling says them twice, and null for a page that states no fact", () => {
    expect(repeatedFactShare({ markdown: page, facts, others: [livePage(facts[0], "a")] })).toBe(0);
    expect(repeatedFactShare({ markdown: "## Nothing\n\nNo facts here.", facts, others: [] })).toBeNull();
  });
});
