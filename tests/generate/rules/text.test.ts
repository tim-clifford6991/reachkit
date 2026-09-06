// tests/generate/rules/text.test.ts — BUILD §8's one derivation from a
// draft's Markdown to the words a reader meets, and its one notion of "the
// same sentence".
//
// Two derivations of "the reader's words" would let a rule pass on one and
// fail on the other; two notions of "the same sentence" would let a figure
// be sourced by a link that is not beside it. Both live in `text.ts`, and
// this suite is what says so.
import "../env";
import { describe, expect, it } from "vitest";
import { blocksOf, hasLink, renderOf, sentencesOf } from "../../../src/lib/generate/rules/text";

describe("renderOf — Markdown becomes the words a reader meets", () => {
  it("a link becomes its label, and the address is gone", () => {
    const rendered = renderOf("See [the pricing page](https://example.com/pricing) for the plans.");
    expect(rendered).toContain("the pricing page");
    expect(rendered).not.toContain("https://example.com/pricing");
  });

  it("headings, list markers, emphasis and code fences leave no syntax behind", () => {
    const rendered = renderOf(
      ["# A heading", "", "- **bold** item", "- _emphasised_ item", "", "`inline code`"].join("\n")
    );
    expect(rendered).not.toMatch(/[#*_`]/);
    expect(rendered).toContain("A heading");
    expect(rendered).toContain("bold item");
    expect(rendered).toContain("inline code");
  });

  it("an HTML comment is not words a reader meets", () => {
    expect(renderOf("Before <!-- a note to nobody --> after")).not.toContain("a note to nobody");
  });

  it("an image contributes nothing to the flow and leaves no stray marker", () => {
    expect(renderOf("Look: ![a chart of seats](chart.png) here").trim()).toBe("Look:  here".trim());
  });
});

describe("hasLink — whether a fragment carries an address a reader can open", () => {
  it("a Markdown link, a bare address and an HTML anchor each count", () => {
    expect(hasLink("[label](https://example.com)")).toBe(true);
    expect(hasLink("see https://example.com for more")).toBe(true);
    expect(hasLink('<a href="https://example.com">label</a>')).toBe(true);
  });

  it("plain prose does not", () => {
    expect(hasLink("Rivals charge more than we do.")).toBe(false);
  });
});

describe("sentencesOf — the scope of the sourcing rules", () => {
  it("splits a paragraph at sentence terminators and keeps each piece's own address", () => {
    const sentences = sentencesOf(
      "Rival grew 40% last year, per [their report](https://rival.example/ar). We did not."
    );
    expect(sentences).toHaveLength(2);
    expect(sentences[0]?.hasLink).toBe(true);
    expect(sentences[1]?.hasLink).toBe(false);
  });

  it("a link in the next sentence does not source the one before it — the scope is the sentence, not the paragraph", () => {
    const sentences = sentencesOf(
      "Rival grew 40% last year. The figures are in [their report](https://rival.example/ar)."
    );
    expect(sentences[0]?.hasLink).toBe(false);
    expect(sentences[0]?.text).toContain("40%");
  });

  it("a sentence never spans a block boundary", () => {
    const sentences = sentencesOf(["First block", "", "Second block"].join("\n"));
    expect(sentences.map((sentence) => sentence.text)).toEqual(["First block", "Second block"]);
  });
});

describe("blocksOf — the scope of the people rules", () => {
  it("a block quote is one block and is marked as quoted", () => {
    const blocks = blocksOf(["Intro paragraph.", "", "> A remark someone made.", "", "After."].join("\n"));
    expect(blocks.map((block) => block.quoted)).toEqual([false, true, false]);
    expect(blocks[1]?.text).toBe("A remark someone made.");
  });

  it("each list item is its own block, so a link on one item does not source another", () => {
    const blocks = blocksOf(["- first item", "- second item [source](https://example.com)"].join("\n"));
    expect(blocks).toHaveLength(2);
    expect(blocks[0]?.hasLink).toBe(false);
    expect(blocks[1]?.hasLink).toBe(true);
  });

  it("a heading is its own block", () => {
    const blocks = blocksOf(["## A heading", "Body text under it."].join("\n"));
    expect(blocks.map((block) => block.text)).toEqual(["A heading", "Body text under it."]);
  });
});
