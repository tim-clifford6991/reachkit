// tests/generate/rules/frame.test.ts — SPEC §7 (2026-09-19, issue 900), the
// frame rule.
//
// The two pages under test are the two drafts this product had ever written,
// as the issue records them: their titles, their openings and their shape —
// a category search answered with the seller's own feature list and price.
// They are reconstructions of that shape, not transcripts of the stored
// rows, which is all the rule reads: a title, the headings, and how often the
// words a reader meets name the business whose site it is.
//
// What this suite pins:
//   * both of those pages fail, and a page that answers the category
//     question and names the business once among options passes;
//   * the rule never fires where the search is about the business itself,
//     where no brand is recorded, where no search is known, or on an Improve
//     page — which is the customer's own page being rewritten;
//   * no other rule was asked to do this work: the failure is `page_frame`.
import "../env";
import { describe, expect, it } from "vitest";
import { checkPageFrame, answersMarketQuestion } from "../../../src/lib/generate/rules/frame";
import { renderOf } from "../../../src/lib/generate/rules/text";
import type { OpportunityType } from "../../../src/lib/opportunities/types";

const SITE = { businessName: "ReachKit", domain: "reachkit.app" };

function check(a: {
  title: string;
  markdown: string;
  queries?: readonly string[];
  opportunityType?: OpportunityType | null;
  businessName?: string | null;
  domain?: string;
}) {
  return checkPageFrame({
    title: a.title,
    markdown: a.markdown,
    rendered: renderOf(a.markdown),
    businessName: a.businessName === undefined ? SITE.businessName : a.businessName,
    domain: a.domain ?? SITE.domain,
    opportunityType: a.opportunityType === undefined ? "listed_page" : a.opportunityType,
    queries: a.queries ?? ["best ai seo software"],
  });
}

/** Draft `290d12ba`, "Best SEO Software": a category opening, then the
 *  seller's features and price. The title names no brand — the body is what
 *  makes it a brochure. */
const ADVERT_BODY = [
  "The best SEO software closes the discoverability gap between what buyers ask and",
  "what a site answers. Most teams start by measuring where they already appear.",
  "",
  "## What the best software does",
  "",
  "ReachKit measures where AI answers and Google search send buyers to rivals instead",
  "of you. ReachKit then writes one page a day to change that.",
  "",
  "## What it costs",
  "",
  "ReachKit is one plan, per [the published pricing page](https://reachkit.app/pricing).",
].join("\n");

/** Draft `1aa3e4bb`, "Best AI SEO Software: ReachKit Writes Your Way to
 *  Discovery" — the brand is in the title the reader meets first. */
const ADVERT_TITLE = "Best AI SEO Software: ReachKit Writes Your Way to Discovery";

/** The page the rule is written to let through: the question answered, the
 *  options set out, the customer named once among them. */
const ANSWERS_THE_QUESTION = [
  "The best AI SEO software for a small site is the one that measures where answer",
  "engines already send your buyers and then writes for the gaps it finds, rather than",
  "the one with the longest keyword list.",
  "",
  "## What the options are",
  "",
  "| Tool | What it is for | Who it suits |",
  "| --- | --- | --- |",
  "| A rank tracker | Watching positions you already hold | A site with rankings to defend |",
  "| A content editor | Grading a draft before you publish it | A team that writes its own pages |",
  "| ReachKit | Measuring the gap, then writing a page a day for it | A small site with nobody to write |",
  "",
  "## What distinguishes them",
  "",
  "A tracker tells you where you stand and writes nothing; an editor grades what you",
  "have already written; a writer picks the subject for you. Which suits you follows",
  "from whether the missing thing is the measurement or the writing.",
].join("\n");

describe("the two drafts this product actually wrote do not pass", () => {
  it("fails the one whose title makes the seller the subject", () => {
    expect(check({ title: ADVERT_TITLE, markdown: ANSWERS_THE_QUESTION })).toEqual({ rule: "page_frame" });
  });

  it("fails the one whose body is the seller's features and price", () => {
    expect(check({ title: "Best SEO Software", markdown: ADVERT_BODY, queries: ["best seo software"] })).toEqual({
      rule: "page_frame",
    });
  });

  it("fails a page that names the business in a heading", () => {
    const markdown = ANSWERS_THE_QUESTION.replace("## What the options are", "## Why ReachKit");
    expect(check({ title: "Best AI SEO Software", markdown })).toEqual({ rule: "page_frame" });
  });
});

describe("a page that answers the question and names the customer once among options passes", () => {
  it("returns no failure", () => {
    expect(check({ title: "Best AI SEO Software", markdown: ANSWERS_THE_QUESTION })).toBeNull();
  });

  it("still passes for an `answer_page`, the other type the ruling names", () => {
    expect(
      check({ title: "Best AI SEO Software", markdown: ANSWERS_THE_QUESTION, opportunityType: "answer_page" })
    ).toBeNull();
  });
});

describe("it does not fire where the page is rightly about the business", () => {
  it("a target search that names the brand is the customer's own question", () => {
    expect(check({ title: ADVERT_TITLE, markdown: ADVERT_BODY, queries: ["reachkit pricing"] })).toBeNull();
  });

  it("an absorbed search naming the brand is enough — any of them makes it their question", () => {
    expect(
      check({ title: ADVERT_TITLE, markdown: ADVERT_BODY, queries: ["seo software", "is reachkit any good"] })
    ).toBeNull();
  });

  it("an Improve page is the customer's own page being rewritten", () => {
    expect(check({ title: ADVERT_TITLE, markdown: ADVERT_BODY, opportunityType: "refresh_page" })).toBeNull();
  });
});

describe("a rule that cannot decide fails nothing", () => {
  it("no brand recorded — there is no name to look for, and none is guessed", () => {
    expect(check({ title: ADVERT_TITLE, markdown: ADVERT_BODY, businessName: null, domain: "" })).toBeNull();
  });

  it("no target search known", () => {
    expect(check({ title: ADVERT_TITLE, markdown: ADVERT_BODY, queries: [] })).toBeNull();
  });

  it("no opportunity type — the caller holds no row for the page", () => {
    expect(check({ title: ADVERT_TITLE, markdown: ADVERT_BODY, opportunityType: null })).toBeNull();
  });
});

describe("`answersMarketQuestion` is the one question, asked once", () => {
  it("is true for a Write or Earn page on a search that does not name the brand", () => {
    for (const type of ["answer_page", "keyword_page", "comparison_page", "format_page", "listed_page"] as const) {
      expect(
        answersMarketQuestion({ opportunityType: type, queries: ["best ai seo software"], ...SITE })
      ).toBe(true);
    }
  });

  it("is false for every Improve and Fix type", () => {
    for (const type of ["expand_page", "answerable_page", "refresh_page", "unblock", "fix_page"] as const) {
      expect(
        answersMarketQuestion({ opportunityType: type, queries: ["best ai seo software"], ...SITE })
      ).toBe(false);
    }
  });

  it("reads the label at a word boundary, so an ordinary word inside another is not the brand", () => {
    expect(
      answersMarketQuestion({
        opportunityType: "listed_page",
        queries: ["best seo software for writers"],
        businessName: null,
        domain: "write.app",
      })
    ).toBe(true);
    expect(
      answersMarketQuestion({
        opportunityType: "listed_page",
        queries: ["is write any good"],
        businessName: null,
        domain: "write.app",
      })
    ).toBe(false);
  });

  it("matches the domain's own label, not only the recorded name", () => {
    expect(
      answersMarketQuestion({
        opportunityType: "listed_page",
        queries: ["reachkit alternatives"],
        businessName: null,
        domain: "reachkit.app",
      })
    ).toBe(false);
  });
});
