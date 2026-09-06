// tests/app/draft/markdown.test.ts — BUILD §4.6, §9, REQ-045 criteria 5 and 12
//
// The one renderer. The claim this file exists to hold is the archived
// BP-044 decision 3's: what the customer copies and what publishes are the
// same bytes, because there is one parse and one serialiser and the screen's
// own styling is a class map handed to that same serialiser — never a second
// element tree.
import { describe, expect, it } from "vitest";
import {
  escapeHtml,
  markPassage,
  parseInline,
  parseMarkdown,
  renderMarkdownHtml,
  toHtml,
  type HtmlClasses,
} from "@/app/(account)/app/draft/[draftId]/markdown";
import { BODY_CLASSES } from "@/app/(account)/app/draft/[draftId]/present";

const CLASS_ATTR = / class="[^"]*"/g;

describe("the block grammar is closed, and every line lands in exactly one block", () => {
  it("headings carry their level and their inline content", () => {
    expect(parseMarkdown("# One\n\n### Three")).toEqual([
      { kind: "heading", level: 1, children: [{ kind: "text", text: "One" }] },
      { kind: "heading", level: 3, children: [{ kind: "text", text: "Three" }] },
    ]);
  });

  it("consecutive lines are one paragraph and a blank line ends it", () => {
    expect(toHtml(parseMarkdown("a\nb\n\nc"))).toBe("<p>a b</p>\n<p>c</p>");
  });

  it("bullets and numbers are two lists, never one", () => {
    expect(toHtml(parseMarkdown("- a\n- b"))).toBe("<ul><li>a</li><li>b</li></ul>");
    expect(toHtml(parseMarkdown("1. a\n2. b"))).toBe("<ol><li>a</li><li>b</li></ol>");
  });

  it("a quote, a rule and a fenced block each render as themselves", () => {
    expect(toHtml(parseMarkdown("> said"))).toBe("<blockquote>said</blockquote>");
    expect(toHtml(parseMarkdown("---"))).toBe("<hr>");
    expect(toHtml(parseMarkdown("```\nx = 1\n```"))).toBe("<pre><code>x = 1</code></pre>");
  });

  it("a fenced block is verbatim: nothing inside it is parsed as Markdown", () => {
    expect(toHtml(parseMarkdown("```\n# not a heading\n- not a list\n```"))).toBe(
      "<pre><code># not a heading\n- not a list</code></pre>"
    );
  });

  it("inline emphasis, code and links parse; a construct it does not know renders as its own text", () => {
    expect(toHtml(parseMarkdown("**b** *i* `c` [t](https://e.com)"))).toBe(
      '<p><strong>b</strong> <em>i</em> <code>c</code> <a href="https://e.com">t</a></p>'
    );
    expect(toHtml(parseMarkdown("a | b ~~c~~"))).toBe("<p>a | b ~~c~~</p>");
  });
});

describe("nothing a body contains can become markup", () => {
  it("every text node is escaped", () => {
    expect(toHtml(parseMarkdown('<script>alert("x")</script>'))).toBe(
      "<p>&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;</p>"
    );
  });

  it("escapeHtml closes the five characters that can change meaning", () => {
    expect(escapeHtml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#39;");
  });

  it("a link's address is escaped in the attribute it lands in", () => {
    expect(toHtml(parseMarkdown('[t](https://e.com/?a="b")'))).toContain(
      'href="https://e.com/?a=&quot;b&quot;"'
    );
  });

  it("the four addressable schemes become links", () => {
    for (const href of ["https://e.com", "http://e.com", "mailto:a@e.com", "/app/calendar"]) {
      expect(toHtml(parseMarkdown(`[t](${href})`))).toBe(`<p><a href="${href}">t</a></p>`);
    }
  });

  it("anything else keeps its text and loses its address — no href is emitted for it", () => {
    for (const href of ["javascript:alert(1", "data:text/html,x", "vbscript:x", "ftp://e.com"]) {
      const html = toHtml(parseMarkdown(`[click](${href})`));
      expect(html).not.toContain("href");
      expect(html).toContain("click");
    }
  });

  it("parseInline is the same grammar the blocks are built from", () => {
    expect(parseInline("plain")).toEqual([{ kind: "text", text: "plain" }]);
    expect(parseInline("`c`")).toEqual([{ kind: "code", text: "c" }]);
  });
});

describe("BP-044 decision 3 — one renderer, so the copied HTML and the published HTML cannot differ", () => {
  const source = "# H\n\ntext with **bold**\n\n- one\n- two\n\n> quote\n\n---\n\n```\ncode\n```";

  it("renderMarkdownHtml is toHtml over parseMarkdown, with no class attribute at all", () => {
    expect(renderMarkdownHtml(source)).toBe(toHtml(parseMarkdown(source)));
    expect(renderMarkdownHtml(source)).not.toContain("class=");
  });

  it("the screen's render differs from the copied bytes by class attributes and by nothing else", () => {
    const onScreen = toHtml(parseMarkdown(source), BODY_CLASSES);
    expect(onScreen.replace(CLASS_ATTR, "")).toBe(renderMarkdownHtml(source));
    expect(onScreen).toContain("class=");
  });

  it("a class map cannot introduce or drop an element — the structure is the parse's, not the map's", () => {
    const sparse: HtmlClasses = { p: "x" };
    const dense: HtmlClasses = BODY_CLASSES;
    expect(toHtml(parseMarkdown(source), sparse).replace(CLASS_ATTR, "")).toBe(
      toHtml(parseMarkdown(source), dense).replace(CLASS_ATTR, "")
    );
  });

  it("the class map's own values are escaped where they land", () => {
    expect(toHtml(parseMarkdown("a"), { p: 'x"y' })).toBe('<p class="x&quot;y">a</p>');
  });
});

describe("REQ-045 c2 — the grounded passage is marked within the text, verbatim and at most once", () => {
  const md = "Some lead-in. The fact itself. Some trailing text.\n\nThe fact itself.";

  it("the passage is wrapped where it occurs, and the surrounding text is untouched", () => {
    const { blocks, marked } = markPassage(parseMarkdown(md), "The fact itself.");
    expect(marked).toBe(true);
    expect(toHtml(blocks)).toBe(
      "<p>Some lead-in. <mark>The fact itself.</mark> Some trailing text.</p>\n<p>The fact itself.</p>"
    );
  });

  it("a passage the body no longer contains marks nothing, and the body still renders whole", () => {
    const { blocks, marked } = markPassage(parseMarkdown(md), "a fact that was removed");
    expect(marked).toBe(false);
    expect(toHtml(blocks)).toBe(toHtml(parseMarkdown(md)));
  });

  it("an empty passage marks nothing — a page grounded in nothing gets no highlight", () => {
    expect(markPassage(parseMarkdown(md), "   ").marked).toBe(false);
  });

  it("the parser mints no mark of its own: only markPassage can produce one", () => {
    expect(toHtml(parseMarkdown("<mark>x</mark>"))).not.toContain("<mark>");
    expect(toHtml(parseMarkdown(md))).not.toContain("<mark>");
  });

  it("marking changes nothing but the one span — strip the mark and the render is identical", () => {
    const { blocks } = markPassage(parseMarkdown(md), "The fact itself.");
    expect(toHtml(blocks).replace(/<\/?mark>/g, "")).toBe(toHtml(parseMarkdown(md)));
  });
});
