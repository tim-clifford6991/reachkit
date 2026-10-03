// tests/generate/rules/sourcing.test.ts — BUILD §8 hard rules 1 and 6.
//
// One promise, two checks: every figure a reader meets on the published
// page is one they can open a source for. The page's own fact is grounded
// in the customer's live page; a rival's figure links the public page it
// was read from. A number no fact holds is `traceable_numerals`'
// (`brief-rules.test.ts`).
import "../env";
import { describe, expect, it } from "vitest";
import { checkGrounding } from "../../../src/lib/generate/rules/grounding";
import { checkRivalSource } from "../../../src/lib/generate/rules/rivals";
import { GROUNDED, SOURCE_TEXT } from "../fixtures";

describe("§8 hard rule 1 — grounded in the customer's own live page", () => {
  it("a passage present word for word in the page passes", () => {
    expect(checkGrounding({ grounded: GROUNDED, sourceText: SOURCE_TEXT })).toBeNull();
  });

  it("no grounded fact at all fails", () => {
    expect(checkGrounding({ grounded: null, sourceText: SOURCE_TEXT })).toEqual({ rule: "grounding" });
  });

  it("a passage altered by one character fails — the promise is that it can still be read against", () => {
    const altered = { ...GROUNDED, passage: GROUNDED.passage.replace("25 seats", "26 seats") };
    expect(checkGrounding({ grounded: altered, sourceText: SOURCE_TEXT })).toEqual({ rule: "grounding" });
  });

  it("whitespace wrapped differently is not a different passage", () => {
    const wrapped = { ...GROUNDED, passage: GROUNDED.passage.replace(/ /g, "\n  ") };
    expect(checkGrounding({ grounded: wrapped, sourceText: SOURCE_TEXT })).toBeNull();
  });

  it("a passage found nowhere in the page fails — there is no fallback source", () => {
    const elsewhere = { ...GROUNDED, passage: "A fact the report holds and the page does not." };
    expect(checkGrounding({ grounded: elsewhere, sourceText: SOURCE_TEXT })).toEqual({
      rule: "grounding",
    });
  });

  it("an empty passage is not a fact", () => {
    expect(checkGrounding({ grounded: { ...GROUNDED, passage: "   " }, sourceText: SOURCE_TEXT })).toEqual({
      rule: "grounding",
    });
  });
});

describe("§8 hard rule 6 — every rival claim links its public source", () => {
  const rivals = ["rival.example", "Northwind"];

  it("a rival figure with a link in the same sentence passes", () => {
    const markdown = "Rival.example serves 400 teams, per [their own page](https://rival.example/about).";
    expect(checkRivalSource({ markdown, rivals })).toBeNull();
  });

  it("the same figure with the link in the next sentence fails — one sourced figure must not legitimise an unsourced one", () => {
    const markdown =
      "Rival.example serves 400 teams. The number is on [their about page](https://rival.example/about).";
    const failure = checkRivalSource({ markdown, rivals });
    expect(failure?.rule).toBe("rival_source");
    expect(failure?.detail).toEqual({ rule: "rival_source", figure: "400" });
  });

  it("a rival named by its name, not its domain, is still a rival", () => {
    expect(checkRivalSource({ markdown: "Northwind charges 30% more.", rivals })?.rule).toBe(
      "rival_source"
    );
  });

  it("a rival named without a figure passes — the rule is about metrics, not mentions", () => {
    expect(checkRivalSource({ markdown: "Northwind is the obvious alternative.", rivals })).toBeNull();
  });

  it("a figure with no rival in the sentence passes", () => {
    expect(checkRivalSource({ markdown: "There are 12 steps to setting this up.", rivals })).toBeNull();
  });

  it("a site with no recorded rivals has no rival claim to check", () => {
    expect(checkRivalSource({ markdown: "Northwind charges 30% more.", rivals: [] })).toBeNull();
  });
});
