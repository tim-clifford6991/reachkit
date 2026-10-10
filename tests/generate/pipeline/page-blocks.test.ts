// tests/generate/pipeline/page-blocks.test.ts — SPEC §7 (*What every page
// carries*, issue 1137; D41, D42) and the round-1 review of 2026-10-02: the
// page is laid out in code from the writer's parts in its template's order,
// what a page never says is cut in code, and `required_blocks` stops a page
// that lacks one of its template's blocks.
import "../env";
import { describe, expect, it } from "vitest";
import { layoutPage, sentenceCase, tidy, tidyText, withClosing } from "../../../src/lib/generate/pipeline/compose";
import { applyLinks } from "../../../src/lib/generate/links/apply";
import { bodyWords, lengthRangeFor } from "../../../src/lib/generate/length";
import { answerBoxWords, missingBlock } from "../../../src/lib/generate/rules/blocks";
import { TEMPLATES, type Template } from "../../../src/lib/generate/templates";
import type { PageParts } from "../../../src/lib/generate/pipeline/write";
import { CLEAN_MARKDOWN, GROUNDED, pageParts, prose } from "../fixtures";

const TIDY = { facts: [GROUNDED.passage], promises: [], queries: ["which plan fits a small team"], names: ["Acme"] };

function page(parts: PageParts = pageParts(), template: Template = TEMPLATES.qa) {
  const laid = layoutPage(parts, template, TIDY);
  const markdown = withClosing(laid.body.bodyMarkdown, laid.closing, "https://example.com/");
  const blocks = { template, sections: laid.sections, length: lengthRangeFor(template), faq: laid.faq, domain: "example.com" };
  return { ...laid, markdown, blocks, missing: (changed = markdown) => missingBlock({ markdown: changed, title: "A title", blocks }) };
}

describe("the page is laid out from its parts", () => {
  it("opens with the short-answer box, then the takeaways, then each section under its heading, the closing line last", () => {
    const { markdown, missing, sections } = page();
    expect(markdown.startsWith(":::answer\nThe right tool for a small team")).toBe(true);
    expect(answerBoxWords(markdown)).toBeGreaterThanOrEqual(40);
    expect(markdown).toContain(":::takeaways\n- Count seats.");
    expect(markdown.match(/^## .*\?$/gm)).toEqual(sections.map((section) => `## ${section.heading}`));
    expect(markdown.endsWith("[Count your seats before you choose a plan.](https://example.com/)")).toBe(true);
    expect(missing()).toBeNull();
  });

  it("puts the sections in the template's order, whatever order the writer returned them in, and drops one the template does not have", () => {
    const parts = pageParts();
    const [first, ...rest] = parts.sections;
    const business = rest.pop()!;
    const stray = { key: "pricing_table", heading: "What does it cost?", body: "It varies by plan." };
    const { sections, markdown } = page({ ...parts, sections: [business, stray, ...rest, first!] });
    expect(sections.map((section) => section.key)).toEqual([...rest.map(() => "question"), "question", "business"]);
    expect(sections.at(-1)?.heading).toBe(business.heading);
    expect(markdown).not.toContain("What does it cost?");
  });

  it("a Q&A page's own questions are its buyer questions, each with the paragraph that answers it", () => {
    const { faq } = page(pageParts("A small team picks by seat count.\n\nThe detail follows."));
    expect(faq).toHaveLength(6);
    expect(faq[0]).toEqual({ question: "Which tool should a small team pick?", answer: "A small team picks by seat count." });
  });

  it("a heading the writer put inside a section is an H3, and a repeat of the section's own is cut", () => {
    const { markdown } = page(pageParts("## Which tool should a small team pick?\n\nIt depends on seats.\n\n# A shouted point\n\nText."));
    expect(markdown).toContain("It depends on seats.\n\n### A shouted point");
    expect(markdown.match(/^## Which tool should a small team pick\?$/gm)).toHaveLength(1);
  });
});

describe("what the writer got nearly right is put right in code", () => {
  it("a table whose delimiter row is short is given one cell a column", () => {
    const table = "The plans differ.\n\n| Plan | Built for | Seats |\n| --- |\n| Starter | A small team | Few |";
    expect(page(pageParts(table)).markdown).toContain("| Plan | Built for | Seats |\n| --- | --- | --- |\n| Starter");
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
    // The handed passage stands as a quotation, with the page it was read from.
    expect(tidy(body, { ...TIDY, sources: [{ passage: GROUNDED.passage, url: GROUNDED.url }] })).toBe(
      [
        "The plan is flat. It is simple.",
        `> ${GROUNDED.passage} ([example.com](${GROUNDED.url}))`,
        "Count the seats.",
      ].join("\n\n")
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
  const { markdown, missing } = page();

  it.each([
    ["fact_label", markdown.replace("Read the people", "Read [F3] the people")],
    ["answer_box", markdown.replace(/^:::answer\n.*\n:::\n\n/, "")],
    ["takeaways", markdown.replace(/(:::takeaways\n- [^\n]*\n)- [^\n]*\n- [^\n]*\n/, "$1")],
    ["sections", markdown.replace(/## Seats: can outside guests join without paying\?[\s\S]*?(?=## Seats: what happens after)/, "")],
    ["question_headings", markdown.replace("join without paying?", "join without paying")],
    ["section_opening", markdown.replace("join without paying?\n\n", "join without paying?\n\n- ")],
    ["business_section", markdown.replace(/https:\/\/example\.com/g, "https://other.test")],
    ["closing", markdown.replace(/\n\n\[Count your seats[^\n]*$/, "\n\nCount your seats.")],
  ])("%s", (block, broken) => {
    expect(broken).not.toBe(markdown);
    expect(missing(broken)).toBe(block);
  });

  it("a self-promoting page's verdict names a rival, or the page is stopped for its verdict (D52)", () => {
    const compared: Template = {
      ...TEMPLATES.qa,
      sections: [
        { ...TEMPLATES.qa.sections[0]!, repeat: { min: 5, max: 5 } },
        TEMPLATES.listicle.sections.find((slot) => slot.key === "which_to_choose")!,
        TEMPLATES.qa.sections[1]!,
      ],
    };
    const parts = pageParts();
    const verdict = (body: string) =>
      page({ ...parts, sections: parts.sections.map((s, index) => (index === 5 ? { ...s, key: "which_to_choose", body: `${body}\n\n${s.body}` } : s)) }, compared);
    const check = (built: ReturnType<typeof page>) =>
      missingBlock({ markdown: built.markdown, title: "A title", blocks: { ...built.blocks, rivals: ["Globex", "Initech"] } });
    expect(check(verdict("Pick Acme where a small team wants one plan."))).toBe("verdict");
    expect(check(verdict("Pick Acme for one plan; a team that needs single sign-on is better served by Globex."))).toBeNull();
  });

  it("a page under its template's floor is stopped for its length, and one inside it is not", () => {
    const short = page(pageParts(CLEAN_MARKDOWN, { sections: pageParts().sections.map((s) => ({ ...s, body: s.body.slice(0, 200) })) }));
    expect(bodyWords(short.markdown)).toBeLessThan(short.blocks.length!.floor);
    expect(short.missing()).toBe("length");
        expect(missing()).toBeNull();
  });

  it("a page with fewer questions than its template asks is stopped for its sections", () => {
    const parts = pageParts();
    expect(page({ ...parts, sections: parts.sections.slice(3) }).missing()).toBe("sections");
  });

  /** A how-to with `count` numbered steps, long enough for its floor. */
  function howTo(count: number) {
    const steps = Array.from({ length: count }, (_, index) => `${index + 1}. ${prose("steps", index, 1)}`).join("\n");
    const section = (key: string, nth: string, body: string) => ({ key, heading: `Steps: what is the ${nth} thing to do?`, body });
    return page(
      pageParts(CLEAN_MARKDOWN, {
        sections: [
          section("what_you_need", "first", prose("steps", 0, 60)),
          section("steps", "second", `${prose("steps", 60, 30)}\n\n${steps}`),
          section("check", "third", prose("steps", 90, 60)),
          section("mistakes", "fourth", prose("steps", 150, 60)),
          section("next_step", "fifth", `${prose("steps", 210, 14)} It is on [the product page](https://example.com/product).`),
        ],
        faq: ["first", "second", "third"].map((nth) => ({ question: `What is the ${nth} thing to ask?`, answer: "Count the seats." })),
      }),
      TEMPLATES.how_to
    );
  }

  it("a how-to with two steps is stopped for its steps, and one with three is not", () => {
    expect(howTo(2).missing()).toBe("steps");
    expect(howTo(3).missing()).toBeNull();
  });

  it("a Sources list is the one heading that is not a question", () => {
    const closing = "[Count your seats before you choose a plan.](https://example.com/)";
    const sourced = markdown.replace(closing, `## Sources\n\n- [A study](https://study.test/a), read 2026-10-01\n\n${closing}`);
    expect(missing(sourced)).toBeNull();
  });
});

describe("the title, the H1 and the description are laid out in code (D51)", () => {
  it("an update keeps its live title, and its year moves only where a section changed", () => {
    const live = { title: "7 best seat planners for small teams (2025)", markdown: "", year: 2026 };
    const parts = pageParts(CLEAN_MARKDOWN, { title: "A new title the writer preferred", heading: "Another heading" });
    const changed = layoutPage(parts, TEMPLATES.qa, { ...TIDY, live });
    expect(changed.body.title).toBe("7 best seat planners for small teams (2026)");
    expect(changed.body.heading).toBe(changed.body.title);
    const same = layoutPage(parts, TEMPLATES.qa, { ...TIDY, live: { ...live, markdown: changed.body.bodyMarkdown } });
    expect(same.body.title).toBe(live.title);
  });

  it("a description over 155 characters keeps the whole sentences that fit", () => {
    const first = "A small team picks project management software by seat count, then compares what each plan costs for that many seats in a year.";
    const { body } = page(pageParts(CLEAN_MARKDOWN, { description: `${first} After that it is worth a second look at support hours.` }));
    expect(body.description).toBe(first);
  });
});
