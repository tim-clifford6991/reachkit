// tests/generate/claims/fit-title.test.ts — the fit check and the title rule.
//
// What a founder would notice if it broke: every comparison page they are
// owed stops on `fit_claim`, because the title the title rule makes name
// them ("ReachKit vs Seobility") is read as a claim of fit.
import "../env";
import { describe, expect, it, vi } from "vitest";
import { AT, CLEAN_MARKDOWN, GROUNDED, SOURCE_TEXT, emptyComparison, fakeCost, siteInputs } from "../fixtures";

const { llmMock } = vi.hoisted(() => ({ llmMock: vi.fn() }));
vi.mock("@/lib/llm", () => ({ llm: llmMock }));

import { brandSentences } from "../../../src/lib/generate/claims/fit";
import { runHardRules } from "../../../src/lib/generate/rules";
import type { TitleRuleInputs } from "../../../src/lib/generate/rules/title";
import { renderOf } from "../../../src/lib/generate/rules/text";
import type { PromptKnowledge } from "../../../src/lib/generate/voice/profile-block";

const SITE = { businessName: "ReachKit", domain: "reachkit.app" };
const TITLE = "ReachKit vs Seobility";
const CLAIM = "ReachKit is the best local SEO software.";

describe("a title the title rule makes name the business is not a fit claim", () => {
  it("the battery sends no fit check for a comparison whose only naming line is its required title", async () => {
    llmMock.mockReset();
    llmMock.mockResolvedValue({ kind: "measured", value: { unsupported: [{ index: 0, claims: "comparison" }] }, at: AT });
    const titleRule = {
      type: "comparison", terms: [], follow: [], asks: false, rivals: ["Seobility"], places: [], holds: "",
      year: 2026, titles: [], description: "", business: ["ReachKit"],
    } as unknown as TitleRuleInputs;
    const outcome = await runHardRules(fakeCost(), {
      markdown: CLEAN_MARKDOWN,
      title: TITLE,
      rendered: renderOf(CLEAN_MARKDOWN),
      pageType: "answer",
      site: siteInputs(SITE),
      comparison: emptyComparison(),
      grounded: GROUNDED,
      sourceText: SOURCE_TEXT,
      brief: { facts: [GROUNDED.passage], queries: [] },
      knowledge: { offerings: [], differentiators: [], byline: null } as unknown as PromptKnowledge,
      titleRule,
    });
    expect(outcome.passed === false && outcome.failed.map((failure) => failure.rule)).not.toContain("fit_claim");
    expect(llmMock.mock.calls.map(([, call]) => call.site)).not.toContain("generate.fit_check");
  });

  it("leaves the required title out, and still sends a body sentence that names the business", () => {
    expect(brandSentences({ ...SITE, title: TITLE, markdown: `Both tools audit pages.\n\n${CLAIM}`, titleOwed: true })).toEqual([CLAIM]);
  });

  it("still reads a title the title rule does not make name the business", () => {
    expect(brandSentences({ ...SITE, title: "ReachKit: the best local SEO software", markdown: CLAIM })).toEqual([
      "ReachKit: the best local SEO software",
      CLAIM,
    ]);
  });
});
