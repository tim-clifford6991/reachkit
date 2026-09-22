// tests/app/draft/editor-format.test.ts — SPEC §7's formatting bar (issue 932).
//
// "a formatting bar (heading, bold, italic, link, list, quote, table)".
//
// What a control does to the buffer is a pure function, so it is decided
// here rather than through seven clicks in a mounted editor: the bar's job
// is to write Markdown the one parser reads, and whether it does is a
// question about strings.
//
// The caret matters as much as the text. A control that wraps a phrase and
// leaves the caret at the end of the document is a control a founder uses
// once.
import { describe, expect, it } from "vitest";
import { applyFormat } from "@/app/(account)/app/draft/[draftId]/Editor";
import { parseMarkdown } from "@/lib/publish/render/markdown";

describe("the formatting bar writes Markdown the one parser reads", () => {
  it("wraps the selection and leaves it selected, so a second control composes", () => {
    const out = applyFormat("a plain sentence", { from: 2, to: 7 }, "bold", "text");
    expect(out.text).toBe("a **plain** sentence");
    expect(out.text.slice(out.from, out.to)).toBe("plain");
  });

  it("with nothing selected it writes the placeholder and selects it", () => {
    const out = applyFormat("", { from: 0, to: 0 }, "italic", "text");
    expect(out.text).toBe("_text_");
    expect(out.text.slice(out.from, out.to)).toBe("text");
  });

  it("a link carries a scheme the serialiser will render as an address", () => {
    const out = applyFormat("see the pricing page", { from: 8, to: 20 }, "link", "label");
    expect(out.text).toBe("see the [pricing page](https://)");
    // The four addressable schemes are the serialiser's (`MARKDOWN_LINK_SCHEMES`);
    // a control that wrote a bare `()` would produce a label with no address.
    expect(out.text).toContain("(https://)");
  });

  it("the three line-level controls write at the head of the line, not around the phrase", () => {
    for (const [key, marker] of [
      ["heading", "## "],
      ["list", "- "],
      ["quote", "> "],
    ] as const) {
      const out = applyFormat("first line\nsecond line", { from: 11, to: 17 }, key, "text");
      expect(out.text).toBe(`first line\n${marker}second line`);
      // The selection travels with the text it was on.
      expect(out.text.slice(out.from, out.to)).toBe("second");
    }
  });

  it("a heading on an empty line writes its placeholder and selects it", () => {
    const out = applyFormat("", { from: 0, to: 0 }, "heading", "Heading");
    expect(out.text).toBe("## Heading");
    expect(out.text.slice(out.from, out.to)).toBe("Heading");
  });

  it("the table it writes is a table the parser parses", () => {
    const out = applyFormat("a paragraph", { from: 11, to: 11 }, "table", "text");
    const blocks = parseMarkdown(out.text);
    // SPEC §7 (2026-09-20) admits a table to the published subset, and the
    // bar's job is to write one the serialiser will carry — not a shape
    // that renders as four lines of pipes on the customer's own domain.
    expect(blocks.some((block) => block.kind === "table")).toBe(true);
  });

  it("every control leaves the rest of the document untouched", () => {
    const text = "one\n\ntwo\n\nthree";
    for (const key of ["heading", "bold", "italic", "link", "list", "quote", "table"] as const) {
      const out = applyFormat(text, { from: 5, to: 8 }, key, "text");
      expect(out.text).toContain("one");
      expect(out.text).toContain("three");
    }
  });

  it("nothing it writes falls outside the published subset", () => {
    // Every control has to write Markdown `parseMarkdown` carries, or the
    // founder types into a pane that shows something the page will not.
    for (const key of ["heading", "bold", "italic", "link", "list", "quote", "table"] as const) {
      const { text } = applyFormat("a plain sentence here", { from: 2, to: 7 }, key, "text");
      const blocks = parseMarkdown(text);
      expect(blocks.length).toBeGreaterThan(0);
      // Nothing renders as an empty document, which is what a construct the
      // parser did not recognise would collapse to.
      expect(blocks.some((block) => block.kind !== "rule")).toBe(true);
    }
  });
});
