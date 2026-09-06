// tests/generate/rules/sourcing.test.ts — BUILD §8 hard rules 1 and 6, and
// the private-figure register beside them.
//
// One promise, three checks: every figure a reader meets on the published
// page is one they can open a source for. The page's own fact is grounded
// in the customer's live page; a rival's figure links the public page it
// was read from; a figure only ReachKit holds is not stated at all.
import "../env";
import { describe, expect, it } from "vitest";
import { checkGrounding } from "../../../src/lib/generate/rules/grounding";
import {
  buildPrivateFigureRegister,
  checkPrivateFigure,
} from "../../../src/lib/generate/rules/figures";
import { checkRivalSource } from "../../../src/lib/generate/rules/rivals";
import { AT, GROUNDED, SOURCE_TEXT, opportunity, report } from "../fixtures";

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

describe("§8 — the private-figure register", () => {
  it("registers the figures an opportunity's evidence carries", () => {
    const register = buildPrivateFigureRegister({
      report: report(),
      opportunities: [opportunity()],
    });
    expect(register).toContain("1900");
  });

  it("does not register single digits — an ordinal is not a figure a reader could trace to us", () => {
    const register = buildPrivateFigureRegister({
      report: report(),
      opportunities: [
        opportunity({
          evidence: {
            family: "write",
            query: "q",
            volume: { kind: "measured", value: 3, at: AT },
            rival: {
              domain: "rival.example",
              url: { kind: "measured", value: "https://rival.example", at: AT },
              position: { kind: "measured", value: 3, at: AT },
            },
          },
        }),
      ],
    });
    expect(register).not.toContain("3");
  });

  it("an unmeasured figure is registered as nothing — there is no number to state", () => {
    const register = buildPrivateFigureRegister({
      report: report(),
      opportunities: [
        opportunity({ volume: { kind: "unmeasured", reason: "not_attempted", at: AT } }),
      ],
    });
    expect(register).not.toContain("NaN");
  });

  it("a registered figure stated without a link in the same sentence fails, carrying the numeral as it appears", () => {
    const failure = checkPrivateFigure({
      markdown: "That search is looked up 1,900 times a month.",
      register: ["1900"],
    });
    expect(failure?.rule).toBe("no_private_figure");
    expect(failure?.detail).toEqual({ rule: "no_private_figure", figure: "1,900" });
  });

  it("the same figure with a link in the same sentence passes — the reader can open a source for it", () => {
    expect(
      checkPrivateFigure({
        markdown: "That search is looked up 1,900 times a month, per [the tool](https://example.org/kw).",
        register: ["1900"],
      })
    ).toBeNull();
  });

  it("a figure the register does not hold passes", () => {
    expect(checkPrivateFigure({ markdown: "There are 42 fields.", register: ["1900"] })).toBeNull();
  });

  it("an empty register fails nothing", () => {
    expect(checkPrivateFigure({ markdown: "There are 1,900 fields.", register: [] })).toBeNull();
  });

  it("a coincidence still fails — it is a register, not a judgement, and stopping the page is the safe direction", () => {
    expect(
      checkPrivateFigure({ markdown: "The founders met in 1900.", register: ["1900"] })?.rule
    ).toBe("no_private_figure");
  });
});
