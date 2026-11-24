// tests/generate/pipeline/repair.test.ts — #1178: a page stopped by a
// mechanical rule is repaired in code, and the rule's own check then passes
// it; the next attempt is told which sentences broke which rule.
import "../env";
import { describe, expect, it } from "vitest";
import {
  checkFirstBlockAnswers,
  checkInventedProvenance,
  checkTraceableNumerals,
  type BriefRuleInputs,
} from "../../../src/lib/generate/rules/brief";
import { fixNotes, repairMechanical } from "../../../src/lib/generate/pipeline/repair";

const BRIEF: BriefRuleInputs = {
  facts: ["Teams on the starter plan get 25 seats and unlimited projects for a flat monthly fee."],
  queries: ["best tools for small teams"],
};
const OPENING = "Pick the tool whose plan covers every person who opens it daily, then check the limits.";
const SOURCES = [{ url: "https://acme.test/pricing", text: "Acme is trusted by 1,200 teams across Europe." }];

describe("repairMechanical", () => {
  it("links a figure to the customer's page that states it, and drops one no page states", () => {
    const markdown = `${OPENING}\n\n## What decides it\n\nAcme serves 1,200 teams. It once won 47 awards. Seats matter most.`;
    const repaired = repairMechanical(markdown, ["traceable_numerals"], { brief: BRIEF, sources: SOURCES });
    // Issue 1391: the link takes in the words the figure counts.
    expect(repaired).toContain("[1,200 teams](https://acme.test/pricing).");
    expect(repaired).not.toContain("47 awards");
    expect(repaired).toContain("Seats matter most.");
    expect(checkTraceableNumerals({ markdown: repaired, brief: BRIEF })).toBeNull();
  });

  it("drops a provenance sentence, keeping the rest of the page", () => {
    const markdown = `${OPENING} A case study proves it.\n\n## Why does this matter?\n\nSeats decide the price.`;
    const repaired = repairMechanical(markdown, ["nothing_invented"], { brief: BRIEF, sources: [] });
    expect(repaired).toBe(`${OPENING}\n\n## Why does this matter?\n\nSeats decide the price.`);
    expect(checkInventedProvenance({ markdown: repaired, brief: BRIEF })).toBeNull();
  });

  it("joins an opening list into a paragraph and splits an over-long opening", () => {
    const listed = "- Count the people who open it daily\n- Check the plan's seat limit\n\n## What decides it\n\nText.";
    const joined = repairMechanical(listed, ["first_block_answers"], { brief: BRIEF, sources: [] });
    expect(joined.startsWith("Count the people who open it daily. Check the plan's seat limit.\n\n")).toBe(true);
    expect(checkFirstBlockAnswers({ markdown: joined })).toBeNull();

    const long = `${OPENING} ${OPENING} ${OPENING} ${OPENING}`;
    const split = repairMechanical(long, ["first_block_answers"], { brief: BRIEF, sources: [] });
    expect(checkFirstBlockAnswers({ markdown: split })).toBeNull();
    expect(split.replace(/\s+/g, " ")).toBe(long);
  });

  it("links a rival's figure only to a page stating it as the sentence does, the rival's own first", () => {
    const sources = [{ url: "https://reachkit.app/compare/moz", text: "Moz shows 14 of 20 rows, is SOC 2 Type II, and costs 3 credits." }, { url: "https://otterly.ai/pricing", text: "Lite: 4 of 7 AI engines. SOC 2 Type II." }];
    sources.unshift({ url: "https://content.reachkit.app/otterly", text: "Otterly bills 3 credits a Claude answer." });
    const markdown = `${OPENING}\n\n## Otterly\n\nOtterly's Lite plan covers 4 of 7 AI engines. Otterly holds SOC 2 Type II. On Otterly each Claude answer counts as 3 credits.`;
    const repaired = repairMechanical(markdown, ["rival_claim"], { brief: BRIEF, sources, rivals: ["otterly.ai"], domain: "reachkit.app" });
    expect(repaired).toContain("covers [4](https://otterly.ai/pricing) of 7 AI engines");
    expect(repaired).not.toContain("reachkit.app");
  });
});

describe("fixNotes", () => {
  it("names the sentences that broke each rule", () => {
    const markdown = `${OPENING}\n\nIt once won 47 awards. Seats matter most.`;
    const failed = checkTraceableNumerals({ markdown, brief: BRIEF })!;
    expect(fixNotes(markdown, [failed, { rule: "honest_row" }], BRIEF)).toEqual([
      { rule: "traceable_numerals", sentences: ["It once won 47 awards."] },
      { rule: "honest_row", sentences: [] },
    ]);
  });
});
