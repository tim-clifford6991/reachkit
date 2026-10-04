// tests/generate/rules/cells-demo.test.ts — SPEC §7 (D41 stage 4): no
// placeholder cell (issue 1250) and no demo or navigation text (issue 1249).
import "../env";
import { describe, expect, it } from "vitest";
import { checkPlaceholderCell } from "../../../src/lib/generate/rules/cells";
import { checkDemoText } from "../../../src/lib/generate/rules/demo";

const table = (cell: string): string =>
  ["Plans compared.", "", "| Product | Price |", "| --- | --- |", "| Acme | $12 a seat |", `| Rival | ${cell} |`].join("\n");

describe("no_placeholder_cell", () => {
  it("a table whose every cell states something passes, a stated no among them", () => {
    expect(checkPlaceholderCell({ markdown: table("No free plan") })).toBeNull();
  });

  it.each(["", "—", "n/a", "Not stated", "not linked to a stated figure", "Unknown"])("a cell that reads “%s” stops the page", (cell) => {
    expect(checkPlaceholderCell({ markdown: table(cell) })).toEqual({
      rule: "no_placeholder_cell",
      detail: { rule: "no_placeholder_cell", cell },
    });
  });
});

describe("no_demo_text", () => {
  const phrases = ["Demo data · An example business", "Pricing", "Sign in"];

  it("a sentence that is one of the site's demo phrases, whole, stops the page", () => {
    const markdown = "The dashboard shows the week.\n\nDemo data: an example business.";
    expect(checkDemoText({ markdown, phrases })).toEqual({
      rule: "no_demo_text",
      detail: { rule: "no_demo_text", sentence: "Demo data: an example business." },
    });
  });

  it("prose that only uses a menu's words passes, and so does a site with no phrases", () => {
    const markdown = "Pricing is on the plans page. Sign in to see the demo data for an example business like yours.";
    expect(checkDemoText({ markdown, phrases })).toBeNull();
    expect(checkDemoText({ markdown: "Demo data: an example business.", phrases: undefined })).toBeNull();
  });
});
