// tests/generate/rules/structure-1507.test.ts — SPEC §7 (issue 1507): the
// six consistency rules, each on the stored production body that broke it,
// and the live pages planned a refresh for them.
import "../env";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { applyLinks, dedupeLinks } from "../../../src/lib/generate/links/apply";
import { widenNumberLinks } from "../../../src/lib/generate/links/text";
import { repairMechanical } from "../../../src/lib/generate/pipeline/repair";
import { bodyH1s, brokenLinkLines, missingBlock, renumberSteps, repeatedHeadings, stepsInOrder, type BlockRuleInputs } from "../../../src/lib/generate/rules/blocks";
import { headingsUnderTitle, parseMarkdown, toHtml } from "../../../src/lib/publish/render/markdown";
import { REPAIRED_IN_CODE, repairStructure, structureDefects } from "../../../src/lib/generate/rules/structure";
import { renderOf } from "../../../src/lib/generate/rules/text";
import { checkTitle, descriptionFiguresMissing, type TitleRuleInputs } from "../../../src/lib/generate/rules/title";
import { TEMPLATES } from "../../../src/lib/generate/templates";
import { refreshCauseOf, structureCandidates, type OwnLivePage } from "../../../src/lib/opportunities/refresh";
import type { Opportunity } from "../../../src/lib/opportunities/types";

/** Every page production published, as its row stored it on 2026-10-18. */
const STORED = JSON.parse(readFileSync(path.join(__dirname, "../live-structure-pages-1507.json"), "utf8")) as {
  pages: { draftId: string; liveUrl: string; description: string; markdown: string }[];
};
const stored = (slug: string) => STORED.pages.find((page) => page.liveUrl.endsWith(`/${slug}`))!;
const A = stored("best-answer-engine-optimization-services-for-ai-visibility");
const B = stored("reachkit-vs-aeo-engine");
const C = stored("how-to-rank-on-chatgpt");
const D = stored("how-to-rank-in-ai-overview");
const E = stored("profound-alternatives");

const blocks = (): BlockRuleInputs => ({ template: TEMPLATES.how_to, sections: [], length: null, faq: [], domain: "example.com" });
const words = (markdown: string) => new Set(renderOf(markdown).toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []);

describe("1. every figure in the meta description is in the body", () => {
  it("profound-alternatives' $1,597 is not on the page; its €49 is", () => {
    expect(descriptionFiguresMissing(E.description, E.markdown)).toEqual(["1,597"]);
  });

  it("stops a new page and an update alike, and passes one whose figures the body states", () => {
    const rule = { type: "how_to", terms: [], follow: [], asks: false, rivals: [], places: [], holds: "", year: 2026, titles: [], description: E.description } as TitleRuleInputs;
    const faults = (type: TitleRuleInputs["type"], markdown: string) => {
      const failed = checkTitle({ title: "Profound alternatives for service businesses", rule: { ...rule, type }, markdown });
      return failed?.detail?.rule === "title" ? failed.detail.faults : [];
    };
    expect(faults("how_to", E.markdown)).toContain("description_figures");
    expect(faults("update", E.markdown)).toEqual(["description_figures"]);
    expect(faults("update", `${E.markdown}\n\nAEO Engine's plan is $1,597 a month.`)).toEqual([]);
  });

  it("a year passes where it is the page's own, and a count the page sets out is not a figure", () => {
    const plumbers = "The 3 best plumbers in Leeds (2026), from £85 a call-out.";
    expect(descriptionFiguresMissing(plumbers, "Call-outs start at £85.", { years: [2026] })).toEqual([]);
    expect(descriptionFiguresMissing(plumbers, "Call-outs start at £85.", { years: [2025] })).toEqual(["2026"]);
    expect(descriptionFiguresMissing("Kits from €5 and 20% off this week.", "Kits cost €6.")).toEqual(["5", "20"]);
  });

  it("numbers are compared after the page's language reads them (D66)", () => {
    // A German page: "1.597 €" is the body's 1597; "2,5 Stunden" is 2.5.
    expect(descriptionFiguresMissing("Pakete ab 1.597 € im Monat, in 2,5 Stunden eingerichtet.", "Das Paket kostet 1597 Euro und ist in 2,5 Stunden fertig.", { language: "de" })).toEqual([]);
    expect(descriptionFiguresMissing("Pakete ab 1.597 € im Monat.", "Das Paket kostet 159,70 Euro.", { language: "de" })).toEqual(["1.597"]);
    // "$1,597" and "1597" are one number; "5" is the body's "five".
    expect(descriptionFiguresMissing("Five plans from $1,597; 5 seats.", "Prices start at 1597 dollars for five seats.")).toEqual([]);
    expect(descriptionFiguresMissing("Fünf Pläne ab 5 €.", "Es gibt fünf Pläne.", { language: "de" })).toEqual([]);
  });
});

describe("2. a numbered list runs from 1 with no gap", () => {
  it("how-to-rank-in-ai-overview goes 4 then 6; counted again, it runs 1 to 9 and every word stays", () => {
    expect(stepsInOrder(D.markdown)).toBe(false);
    const fixed = renumberSteps(D.markdown);
    expect(stepsInOrder(fixed)).toBe(true);
    expect(fixed.match(/^\d+(?=\. )/gm)).toEqual(["1", "2", "3", "4", "5", "6", "7", "8", "9"]);
    expect(fixed.replace(/^\d+\. /gm, "")).toBe(D.markdown.replace(/^\d+\. /gm, ""));
  });

  it("a repair that drops a step renumbers in code", () => {
    const steps = "## How do you prune a rose?\n\n1. Cut the dead wood.\n2. Our nursery waited 47 days for proof.\n3. Feed it in spring.";
    const repaired = repairMechanical(steps, ["traceable_numerals"], { brief: { facts: [], queries: [] }, sources: [] });
    expect(repaired.match(/^\d+\. .*/gm)).toEqual(["1. Cut the dead wood.", "2. Feed it in spring."]);
  });
});

describe("3. no anchor twice, and no page under its query-string variants", () => {
  it("best-answer-engine…'s four 'Every free scan, in the open.' links are one", () => {
    const fixed = dedupeLinks(A.markdown);
    expect(fixed.match(/Every free scan, in the open\./g)).toHaveLength(1);
    expect(fixed).toContain("- [Every free scan, in the open.](https://reachkit.app/scans)\n");
    expect(fixed).not.toContain("?sort=");
  });

  it("the link pass never lists one page under two addresses", () => {
    const targets = ["", "?sort=az", "?sort=lowest"].map((query) => ({
      source: "known" as const,
      url: `https://shop.example.com/candles${query}`,
      label: "All our candles",
      why: { kind: "newer" as const },
    }));
    const out = applyLinks("A body with no links yet.", { domain: "shop.example.com", targets, groundedUrl: "https://shop.example.com/" });
    expect(out.match(/\]\(/g)).toHaveLength(1);
  });

  it("the same link said twice, and a source named by its host, are not repeats", () => {
    expect(dedupeLinks(C.markdown)).toBe(C.markdown);
    const cited = "Fees start at £90 ([lawsociety.org.uk](https://lawsociety.org.uk/a)). Most firms bill hourly ([lawsociety.org.uk](https://lawsociety.org.uk/b)).";
    expect(dedupeLinks(cited)).toBe(cited);
    expect(dedupeLinks("[Book a lesson](https://studio.example.com/book) or [Book a lesson](https://studio.example.com/pricing).")).toBe(
      "[Book a lesson](https://studio.example.com/book) or Book a lesson."
    );
  });
});

describe("4. no link inside a word", () => {
  it("reachkit-vs-aeo-engine's 'B[2](…)B' is 'B2B' again", () => {
    const line = B.markdown.split("\n").find((each) => each.includes("B[2]"))!;
    expect(widenNumberLinks(line)).toContain("For a B2B SaaS or software company");
  });

  it("the numeral repair links the figure, never the digits of a word", () => {
    const page = "Our B40 plan saves 40 hours a month.";
    const repaired = repairMechanical(page, ["traceable_numerals"], {
      brief: { facts: [], queries: [] },
      sources: [{ url: "https://accounts.example.com/b40", text: "The B40 plan saves 40 hours a month." }],
    });
    expect(repaired).toContain("Our B40 plan");
    expect(repaired).toContain("[40 hours a month](https://accounts.example.com/b40)");
  });
});

describe("5. no broken link markup", () => {
  it("reachkit-vs-aeo-engine's '[One plan.' is found and stops a generated page", () => {
    expect(brokenLinkLines(B.markdown)).toEqual(["[One plan."]);
    expect(missingBlock({ markdown: B.markdown, title: "x", blocks: blocks() })).toBe("link_markup");
    expect(repairStructure(B.markdown)).toContain("\nOne plan.\n");
  });
});

describe("6. body_md holds no H1, the rendered page has exactly one, and no heading repeats the title or the answer", () => {
  const TITLE_A = "Best Answer Engine Optimization Services for AI Visibility";

  it("best-answer-engine…'s three body H1s stop a generated page, and move under the title", () => {
    expect(bodyH1s(A.markdown)).toHaveLength(3);
    expect(missingBlock({ markdown: A.markdown, title: TITLE_A, blocks: blocks() })).toBe("h1");
    const fixed = repairStructure(A.markdown, { title: TITLE_A });
    expect(bodyH1s(fixed)).toEqual([]);
    expect(fixed.startsWith("## Why AI visibility matters for your business\n")).toBe(true);
  });

  it("the stored A body, rendered under its title, has one <h1> and no heading equal to the title", () => {
    for (const body of [A.markdown, repairStructure(A.markdown, { title: TITLE_A })]) {
      const html = `<h1>${TITLE_A}</h1>${toHtml(headingsUnderTitle(parseMarkdown(body)))}`;
      expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
      const headings = [...html.matchAll(/<h[2-6][^>]*>([^<]*)</g)].map((match) => match[1]!.trim().toLowerCase());
      expect(headings).not.toContain(TITLE_A.toLowerCase());
    }
  });

  it("a body heading that repeats the title or the answer box is dropped, and what stood under it stays", () => {
    const page = ":::answer\nA boiler service costs £85 in Leeds. We test the flue, the seals and the pressure.\n:::\n\n## Boiler servicing in Leeds\n\nWe come within the week.\n\n## A boiler service costs £85 in Leeds\n\nThe price includes parts.\n\n## What does it include?\n\nThe flue and the seals.";
    expect(repeatedHeadings(page, "Boiler servicing in Leeds")).toEqual(["Boiler servicing in Leeds", "A boiler service costs £85 in Leeds"]);
    expect(missingBlock({ markdown: page, title: "Boiler servicing in Leeds", blocks: blocks() })).toBe("h1");
    const fixed = repairStructure(page, { title: "Boiler servicing in Leeds" });
    expect(fixed).toContain("We come within the week.\n\nThe price includes parts.");
    expect(fixed.match(/^## .*/gm)).toEqual(["## What does it include?"]);
  });
});

describe("7. the live pages, read again and repaired through a refresh", () => {
  it("the dry report: every stored page against rules 1–6", () => {
    expect(STORED.pages.map((page) => [page.liveUrl.split("/").pop(), structureDefects(page)])).toEqual([
      ["best-answer-engine-optimization-services-for-ai-visibility", ["repeated_links", "h1"]],
      ["reachkit-vs-aeo-engine", ["glued_numeral", "link_markup"]],
      ["how-to-rank-on-chatgpt", []],
      ["how-to-rank-in-ai-overview", ["steps_order"]],
      ["profound-alternatives", ["description_figures"]],
    ]);
  });

  it("code repairs what it can, writing no word; a description takes a writer", () => {
    for (const page of STORED.pages) {
      const fixed = repairStructure(page.markdown);
      const left = structureDefects({ ...page, markdown: fixed });
      expect(left.every((defect) => !REPAIRED_IN_CODE.includes(defect))).toBe(true);
      const before = words(page.markdown);
      expect([...words(fixed)].filter((word) => !before.has(word))).toEqual([]);
    }
    expect(structureDefects({ ...E, markdown: repairStructure(E.markdown) })).toEqual(["description_figures"]);
  });

  // §6's floor stands: a version is refreshed 30 days after it went live.
  const AT = new Date("2026-11-10T06:00:00Z");
  const own = (page: { liveUrl: string; markdown: string; description: string }, over: Partial<OwnLivePage> = {}): OwnLivePage => ({
    url: page.liveUrl,
    publishedAt: new Date("2026-10-05T07:00:00Z"),
    row: { id: page.liveUrl, siteId: "site", scanId: "scan", family: "write", type: "keyword_page", targetQuery: "a search", evidence: { family: "write" } } as unknown as Opportunity,
    declined: false,
    facts: [],
    marketFacts: [],
    markdown: page.markdown,
    structure: structureDefects(page),
    ...over,
  });

  it("each live page that breaks one is planned a refresh at its own address, naming what it breaks", () => {
    const planned = structureCandidates([A, B, C, D].map((page) => own(page)), AT);
    expect(planned.map((candidate) => candidate.targetRef)).toEqual([A.liveUrl, B.liveUrl, D.liveUrl]);
    expect(planned.every((candidate) => candidate.type === "refresh_page")).toBe(true);
    expect(planned[2]!.evidence).toMatchObject({ shortfall: { kind: "due", cause: "structure", defects: ["steps_order"] } });
    expect(refreshCauseOf(own(D), { siteText: [], market: [] }, AT)).toBe("structure");
    // A page the customer edited, whose refresh they stopped, or under the floor is left alone.
    expect(structureCandidates([own(A, { edited: true }), own(B, { stopped: true }), own(D, { publishedAt: new Date("2026-10-20T07:00:00Z") })], AT)).toEqual([]);
    expect(refreshCauseOf(own(A, { edited: true }), { siteText: [], market: [] }, AT)).toBeNull();
  });
});
