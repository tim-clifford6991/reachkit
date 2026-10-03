// tests/generate/rules/honest.test.ts — SPEC §7 *honesty by page type*
// (2026-09-29; D20, 2026-10-02; issue 1136).
//
// What a founder would notice if it broke: a page about their product
// stopped for naming them; a "best X" list that crowns them "#1" going out
// under their name; a page that says they are something they are not.
import "../env";
import { describe, expect, it, vi } from "vitest";
import { AT, fakeCost, opportunity } from "../fixtures";

const { llmMock } = vi.hoisted(() => ({ llmMock: vi.fn() }));
vi.mock("@/lib/llm", () => ({ llm: llmMock }));

import { fitCheck } from "../../../src/lib/generate/claims/fit";
import { checkHonestRow } from "../../../src/lib/generate/rules/honest";
import type { PromptKnowledge } from "../../../src/lib/generate/voice/profile-block";
import { pageTypeOf } from "../../../src/lib/opportunities/page-type";

const SITE = { businessName: "ReachKit", domain: "reachkit.app" };

describe("the page's type is read off the row", () => {
  const typed = (over: Parameters<typeof opportunity>[0]) => pageTypeOf(opportunity({ pageType: null, ...over }));

  it("a search anchored on the product is a product page, whatever found it", () => {
    expect(typed({ targetQuery: "reachkit vs meltwater", source: "product" })).toBe("product");
    expect(typed({ targetQuery: "how to get named in ai answers", source: "problem" })).toBe("product");
    expect(typed({ targetQuery: "meltwater alternatives", source: "ai_gap" })).toBe("product");
  });

  it("a best-of list and an unanchored comparison are market comparisons; the rest answer a question", () => {
    expect(typed({ targetQuery: "best ai visibility tools", source: "best_x" })).toBe("market_comparison");
    expect(typed({ type: "comparison_page", targetQuery: "ai visibility tools", source: "category" })).toBe(
      "market_comparison"
    );
    expect(typed({ targetQuery: "what is ai visibility", source: "category" })).toBe("answer");
  });

  it("the stored type wins, and a page that is the customer's own has none", () => {
    expect(pageTypeOf(opportunity({ targetQuery: "best ai visibility tools", pageType: "answer" }))).toBe("answer");
    expect(typed({ type: "refresh_page", family: "improve", targetQuery: "best ai visibility tools" })).toBeNull();
  });
});

describe("the honest row", () => {
  const TABLE = ["| Tool | Writes pages |", "| --- | --- |", "| ReachKit | Yes |", "| Meltwater | No |"].join("\n");
  const check = (markdown: string, over: Partial<Parameters<typeof checkHonestRow>[0]> = {}) =>
    checkHonestRow({ title: "Best AI visibility tools for small teams", markdown, ...SITE, rivals: ["meltwater.com"], pageType: "market_comparison", ...over });

  it("says nothing about a page anchored on the product, however it names the business", () => {
    expect(
      check("ReachKit is the best way to get named in AI answers.", { title: "ReachKit vs Meltwater", pageType: "product" })
    ).toBeNull();
  });

  it("passes a comparison the business leads and is recommended in for a case", () => {
    expect(check(`${TABLE}\n\nReachKit is the best fit for a team with nobody to write.`)).toBeNull();
  });

  it("stops a comparison whose table has no row for the business", () => {
    expect(check("| Tool | Writes pages |\n| --- | --- |\n| Meltwater | No |")?.rule).toBe("honest_row");
    // Whether a page owes a table at all is `required_blocks`' question, and
    // a table of the business's own plans is not the market's comparison.
    expect(check("ReachKit and Meltwater both measure AI answers.")).toBeNull();
    expect(check("| Plan | Built for |\n| --- | --- |\n| Starter | A small team |")).toBeNull();
  });

  it("stops a self-ranked #1 best — in the title, a heading, a sentence or the table", () => {
    expect(check(TABLE, { title: "Best AI visibility tools: ReachKit" })?.rule).toBe("honest_row");
    expect(check(`## 1. ReachKit\n\n${TABLE}`)?.rule).toBe("honest_row");
    expect(check(`${TABLE}\n\nReachKit is the best local SEO software because it writes daily.`)?.rule).toBe("honest_row");
    expect(check(TABLE.replace("| ReachKit | Yes |", "| ReachKit | #1 |"))?.rule).toBe("honest_row");
  });
});

describe("the fit check", () => {
  const KNOWLEDGE = { offerings: [], differentiators: [], byline: null } as unknown as PromptKnowledge;
  const page = {
    title: "Best Local SEO Software",
    markdown: "Local rankings move slowly.\n\nReachKit is the best local SEO software because it writes a page a day.",
    ...SITE,
  };

  it("decides nothing, and spends nothing, without a knowledge base or a sentence naming the business", async () => {
    llmMock.mockReset();
    expect(await fitCheck(fakeCost(), { ...page, knowledge: undefined })).toEqual({ state: "passed" });
    expect(await fitCheck(fakeCost(), { ...page, markdown: "Local rankings move slowly.", knowledge: KNOWLEDGE })).toEqual({
      state: "passed",
    });
    expect(llmMock).not.toHaveBeenCalled();
  });

  it("names back the page's own sentence, never the model's words", async () => {
    llmMock.mockReset();
    llmMock.mockResolvedValue({ kind: "measured", value: { unsupported: [{ index: 0, claims: "local SEO software" }, { index: 7, claims: "" }] }, at: AT });
    expect(await fitCheck(fakeCost(), { ...page, knowledge: KNOWLEDGE })).toEqual({
      state: "failed",
      sentences: ["ReachKit is the best local SEO software because it writes a page a day."],
    });
  });

  it("is unrun, not passed, where the model did not answer", async () => {
    llmMock.mockReset();
    llmMock.mockResolvedValue({ kind: "unmeasured", reason: "vendor_error", at: AT });
    expect(await fitCheck(fakeCost(), { ...page, knowledge: KNOWLEDGE })).toMatchObject({ state: "unrun" });
  });
});
