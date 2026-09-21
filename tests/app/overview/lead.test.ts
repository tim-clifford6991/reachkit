// tests/app/overview/lead.test.ts — SPEC §4 (2026-09-20), the small view of
// the page as readers will see it.
//
// The customer-observable promise is that the card shows the *page*, not its
// source: a reader of the Overview must not meet `**bold**` or a link's
// address as characters, and must not be shown a paragraph long enough to
// push the three tiles off the screen.
import { describe, expect, it } from "vitest";
import { leadOf, LEAD_MAX_CHARS } from "@/app/(account)/app/_overview/lead";

describe("the lead is the page's opening, as a reader meets it", () => {
  it("takes the first paragraph, not the title above it", () => {
    expect(leadOf("# How much does a bike service cost?\n\nA basic service costs $60.")).toBe(
      "A basic service costs $60."
    );
  });

  it("resolves the markup rather than printing it", () => {
    expect(leadOf("A **full** service runs [more](https://example.com/prices).")).toBe(
      "A full service runs more."
    );
  });

  it("folds the line breaks inside a paragraph into single spaces", () => {
    expect(leadOf("One line\nand the next.")).toBe("One line and the next.");
  });

  it("a page with no body has no lead, and the card shows its title alone", () => {
    expect(leadOf(null)).toBe("");
    expect(leadOf("   ")).toBe("");
  });

  it("a body that is only a heading has no paragraph to lead with", () => {
    expect(leadOf("## Just a heading")).toBe("");
  });
});

describe("it is a preview, so it is cut", () => {
  const long = `${"word ".repeat(120)}end.`;

  it("stops at or before the limit", () => {
    expect(leadOf(long).length).toBeLessThanOrEqual(LEAD_MAX_CHARS + 1);
  });

  it("cuts on a word, and says it was cut", () => {
    const lead = leadOf(long);
    expect(lead.endsWith("…")).toBe(true);
    expect(lead).not.toMatch(/wo…$/);
  });

  it("a paragraph inside the limit is shown whole, with no ellipsis", () => {
    const short = "A basic bike service costs between $60 and $100.";
    expect(leadOf(short)).toBe(short);
  });
});
