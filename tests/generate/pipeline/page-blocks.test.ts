// tests/generate/pipeline/page-blocks.test.ts — issue 1137, SPEC §7
// (2026-09-29, *What every page carries*) and the round-1 review of
// 2026-10-02: the page is laid out in code from the writer's parts, what a
// page never says is cut in code, and `required_blocks` stops a page that
// lacks one of its blocks.
import "../env";
import { describe, expect, it } from "vitest";
import { composePage, sentenceCase, tidy, tidyText, withClosing } from "../../../src/lib/generate/pipeline/compose";
import { applyLinks } from "../../../src/lib/generate/links/apply";
import { outlineOf } from "../../../src/lib/generate/pipeline/steps";
import { answerBoxWords, missingBlock } from "../../../src/lib/generate/rules/blocks";
import { CLEAN_MARKDOWN, GROUNDED, OUTLINE_ANSWER, draftParts } from "../fixtures";

const OUTLINE = { sections: OUTLINE_ANSWER.sections.map((s) => ({ ...s, role: s.role as "detail" })) };
const TIDY = { facts: [GROUNDED.passage], promises: [], queries: ["best project management software"], names: ["Acme"] };

function page(over: Record<string, unknown> = {}, first = CLEAN_MARKDOWN) {
  const composed = composePage(draftParts(first, over), OUTLINE, TIDY);
  return { ...composed, markdown: withClosing(composed.body.bodyMarkdown, composed.closing, "https://example.com/") };
}

function missing(markdown: string, over: Partial<Parameters<typeof missingBlock>[0]["blocks"]> = {}, title = "A title") {
  return missingBlock({ markdown, title, blocks: { compares: true, faq: page().faq, domain: "example.com", ...over } });
}

describe("the page is laid out from its parts", () => {
  it("opens with the short-answer box, then the takeaways, then each section under the outline's heading", () => {
    const { markdown } = page();
    expect(markdown.startsWith(":::answer\nThe right tool for a small team")).toBe(true);
    expect(answerBoxWords(markdown)).toBeGreaterThanOrEqual(40);
    expect(markdown).toContain(":::takeaways\n- Count the people who open the tool every day.");
    expect(markdown.match(/^## .*\?$/gm)).toEqual(OUTLINE_ANSWER.sections.map((s) => `## ${s.heading}`));
    expect(markdown.endsWith("[Count your seats before you choose a plan.](https://example.com/)")).toBe(true);
    expect(missing(markdown)).toBeNull();
  });

  it("a heading the writer put inside a section is an H3, and a repeat of the section's own is cut", () => {
    const { markdown } = page({}, "## Which tool should a small team pick?\n\nIt depends on seats.\n\n# A shouted point\n\nText.");
    expect(markdown).toContain("It depends on seats.\n\n### A shouted point");
    expect(markdown.match(/^## Which tool should a small team pick\?$/gm)).toHaveLength(1);
  });
});

describe("what the writer got nearly right is put right in code", () => {
  it("a table whose delimiter row is short is given one cell a column", () => {
    const table = "The plans differ.\n\n| Plan | Built for | Seats |\n| --- |\n| Starter | A small team | Few |";
    const parts = draftParts();
    const { markdown } = page({ sections: [parts.sections[0], parts.sections[1], table, ...parts.sections.slice(3)] });
    expect(markdown).toContain("| Plan | Built for | Seats |\n| --- | --- | --- |\n| Starter");
    expect(missing(markdown)).toBeNull();
  });

  it("a heading is tidied and cased at the outline, so the page and the rules hold one string", () => {
    const sections = [
      { role: "detail", heading: "What Does Each Tool Actually Do For Acme Teams" },
      ...OUTLINE_ANSWER.sections,
    ];
    const outline = outlineOf(sections, ["business"], new Set(["acme"]));
    expect(outline?.sections[0]?.heading).toBe("What does each tool do for Acme teams?");
  });

  it("the chosen pages the text did not reach are listed under the business's own section", () => {
    const body = "## How is it handled here?\n\nOpenly.\n\n## What next?\n\nCount.";
    const out = applyLinks(body, {
      domain: "example.com",
      targets: [{ source: "site", purpose: "pricing", url: "https://example.com/pricing", label: "Pricing" }],
      groundedUrl: "https://example.com/about",
      appendUnder: "How is it handled here?",
    });
    expect(out).toBe(
      "## How is it handled here?\n\nOpenly.\n\n- [Pricing](https://example.com/pricing)\n\n## What next?\n\nCount."
    );
  });
});

describe("what a page never says is cut in code (round-1 review, 2026-10-02)", () => {
  it("strips a prompt's fact labels, keeping the link under the source's name", () => {
    expect(tidyText("Seats are capped [F7][F8](https://example.com/pricing) on every plan [M39].")).toBe(
      "Seats are capped [example.com](https://example.com/pricing) on every plan."
    );
  });

  it("cuts 'actually', a filler pull-quote, legal and refund text, a demo caption and a byline line", () => {
    const body = [
      "Actually, the plan is flat. It is actually simple.",
      "> Seats are the thing to watch.",
      `> ${GROUNDED.passage}`,
      "Refunds are issued within 14 days under our terms of service. Count the seats.",
      "Example dashboard.",
      "By Jordan Lee",
    ].join("\n\n");
    expect(tidy(body, TIDY)).toBe(
      ["The plan is flat. It is simple.", `> ${GROUNDED.passage}`, "Count the seats."].join("\n\n")
    );
  });

  it("says a promise of the business at most twice", () => {
    const line = "ReachKit writes one page a day.";
    const body = [line, "It means one page a day for you.", "Again: one page a day.", "Seats matter."].join("\n\n");
    const out = tidy(body, { ...TIDY, promises: ["Then ReachKit writes one page a day to change that."] });
    expect(out.match(/one page a day/g)).toHaveLength(2);
    expect(out).toContain("Seats matter.");
  });

  it("puts a Title Case heading in sentence case, keeping names and acronyms", () => {
    const proper = new Set(["acme", "google"]);
    expect(sentenceCase("Which SEO Tool Should A Small Team Pick On Google?", proper)).toBe(
      "Which SEO tool should a small team pick on Google?"
    );
    // One capitalised word is a name, not a habit: left as written.
    expect(sentenceCase("How does Ahrefs price its plans?", proper)).toBe("How does Ahrefs price its plans?");
  });
});

describe("required_blocks — the first block a generated page lacks", () => {
  const { markdown } = page();

  it.each([
    ["fact_label", markdown.replace("The choice turns", "The choice [F3] turns"), {}],
    ["answer_box", markdown.replace(/^:::answer\n.*\n:::\n\n/, ""), {}],
    ["takeaways", markdown.replace("- Read what the plan includes before choosing.\n- A seat limit is felt last and most.\n", ""), {}],
    ["sections", markdown.replace(/## What decides the choice\?[\s\S]*?(?=## How do the plans)/, ""), {}],
    ["question_headings", markdown.replace("## What decides the choice?", "## What decides the choice"), {}],
    ["section_opening", markdown.replace("The choice turns on how many people need a seat. ", "- "), {}],
    ["table", markdown.replace(/\n\| Plan[\s\S]*?growing team \|/, ""), {}],
    ["business_section", markdown.replace(/https:\/\/example\.com/g, "https://other.test"), {}],
    ["faq", markdown, { faq: [] }],
    ["closing", markdown.replace(/\n\n\[Count your seats[^\n]*$/, "\n\nCount your seats."), {}],
  ])("%s", (block, broken, over) => {
    expect(broken === markdown).toBe(block === "faq");
    expect(missing(broken, over)).toBe(block);
  });

  it("a page that does not compare owes no table, and a Sources list is the one heading that is not a question", () => {
    const noTable = markdown.replace(/\n\| Plan[\s\S]*?growing team \|/, "");
    expect(missing(noTable, { compares: false })).toBeNull();
    const closing = "[Count your seats before you choose a plan.](https://example.com/)";
    const sourced = markdown.replace(closing, `## Sources\n\n- [A study](https://study.test/a), read 2026-10-01\n\n${closing}`);
    expect(missing(sourced)).toBeNull();
  });
});
