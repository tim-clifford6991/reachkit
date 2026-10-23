// tests/publish/render/markdown.test.ts — BUILD §9, §4.6, REQ-045 criteria
// 5 and 12
//
// The one renderer. The claim this file exists to hold is the archived
// BP-044 decision 3's: what the customer copies and what publishes are the
// same bytes, because there is one parse and one serialiser and the screen's
// own styling is a class map handed to that same serialiser — never a second
// element tree.
//
// It moved here with the module (issue #158): the renderer now lives under
// `src/lib/publish/` because that is the only side of the fence both the
// draft screen and a destination adapter can reach, and a test that imports
// it belongs beside it. The rows below are unchanged — this file's subject
// did not move, only its address.
import { describe, expect, it } from "vitest";
import {
  escapeHtml,
  guidesBlock,
  markPassage,
  parseInline,
  parseMarkdown,
  renderMarkdownHtml,
  toHtml,
  withHeadingIds,
  withLinksMoved,
  withoutLinksTo,
  type HtmlClasses,
} from "@/lib/publish/render/markdown";
import { DRAFT_BODY_CLASSES, MARK_CLASS } from "@/app/(account)/app/draft/[draftId]/present";
import { COPY } from "@/lib/presentation/copy";
import { codeOf } from "../../mail/leads/source";

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
    expect(toHtml(parseMarkdown("- a\n- b"))).toBe('<ul role="list"><li>a</li><li>b</li></ul>');
    expect(toHtml(parseMarkdown("1. a\n2. b"))).toBe('<ol role="list"><li>a</li><li>b</li></ol>');
  });

  it("a quote, a rule and a fenced block each render as themselves", () => {
    expect(toHtml(parseMarkdown("> said"))).toBe("<blockquote>said</blockquote>");
    expect(toHtml(parseMarkdown("---"))).toBe("<hr>");
    // The fence's box scrolls, so it is focusable (owner, PR #973).
    expect(toHtml(parseMarkdown("```\nx = 1\n```"))).toBe(
      '<pre tabindex="0"><code>x = 1</code></pre>'
    );
  });

  it("a fenced block is verbatim: nothing inside it is parsed as Markdown", () => {
    expect(toHtml(parseMarkdown("```\n# not a heading\n- not a list\n```"))).toBe(
      '<pre tabindex="0"><code># not a heading\n- not a list</code></pre>'
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
    for (const href of ["https://e.com", "http://e.com", "mailto:a@e.example", "/app/calendar"]) {
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
    const onScreen = toHtml(parseMarkdown(source), DRAFT_BODY_CLASSES);
    expect(onScreen.replace(CLASS_ATTR, "")).toBe(renderMarkdownHtml(source));
    expect(onScreen).toContain("class=");
  });

  it("a class map cannot introduce or drop an element — the structure is the parse's, not the map's", () => {
    const sparse: HtmlClasses = { p: "x" };
    const dense: HtmlClasses = DRAFT_BODY_CLASSES;
    expect(toHtml(parseMarkdown(source), sparse).replace(CLASS_ATTR, "")).toBe(
      toHtml(parseMarkdown(source), dense).replace(CLASS_ATTR, "")
    );
  });

  it("the class map's own values are escaped where they land", () => {
    expect(toHtml(parseMarkdown("a"), { p: 'x"y' })).toBe('<p class="x&quot;y">a</p>');
  });
});

describe("issue #414 — the grounded mark is the mint the approved set draws", () => {
  // The set draws one rule for it, on S16's body and S19's alike:
  // `.mark{background:var(--ok-bg);box-shadow:0 0 0 1px var(--ok-line);…;
  // color:var(--color-base-content)}`. This block holds the three things that were wrong
  // or could go wrong again: the family, the pair of tokens it is drawn
  // from, and the fact that one map dresses both surfaces.
  const DRAFT = "src/app/(account)/app/draft/[draftId]/RenderedBody.tsx";
  // Issue 929 moved the hosted page's class map out of its `page.tsx`:
  // a page file is one Next reads exports off, not a place to hang a
  // constant a proof or a suite needs to import.
  const HOSTED = "src/app/(hosted)/hosted-page/body-classes.ts";
  const PRESENT = "src/app/(account)/app/draft/[draftId]/present.ts";

  it("the tint is the ok family's own pair, and no warn value is left", () => {
    expect(MARK_CLASS).toContain("var(--ok-bg)");
    expect(MARK_CLASS).toContain("var(--ok-line)");
    expect(MARK_CLASS).not.toContain("warning");
  });

  it("the tokens are read by name, never restated: no colour literal reaches the class", () => {
    // `--ok-bg` and `--ok-line` reach no daisyUI slot (§2.1 maps `success`
    // to `--color-success` and stops), so the map names them — a reference, not a
    // second copy of the value, which still lives once in `theme.css`.
    expect(MARK_CLASS).not.toMatch(/#[0-9a-fA-F]{3,8}|rgba?\(|hsla?\(/);
  });

  it("the mark states its ink: nothing resets `mark`, so the UA's would stand", () => {
    // Left to the UA a `<mark>` is near-black `MarkText` — legible on the
    // light tint and not on the dark one. The set writes `color:var(--color-base-content)`,
    // which is §2.1's `base-content` slot.
    expect(MARK_CLASS).toContain("text-base-content");
  });

  it("one class, both surfaces: neither consumer dresses the grounded fact its own way", () => {
    // Issue 929 gave the hosted page its own map — `prose` plus the few
    // things `prose` has no opinion about — so the two surfaces no longer
    // share a whole class table. What they still share, and must, is this
    // one class: a grounded fact is the same mint wherever it is read.
    //
    // So the rule is stated where it can be broken. **No surface writes a
    // mark class**, anywhere on either path:
    for (const file of [DRAFT, HOSTED, PRESENT]) {
      expect(codeOf(file), `${file} must not write a mark class of its own`).not.toMatch(
        /mark:\s*"/
      );
    }
    // and **every map that carries one takes it from `MARK_CLASS`**:
    for (const file of [HOSTED, PRESENT]) {
      expect(codeOf(file), `${file} must take the mark from MARK_CLASS`).toContain("MARK_CLASS");
    }
    expect(DRAFT_BODY_CLASSES.mark).toBe(MARK_CLASS);
  });
});

describe("SPEC §7 (2026-09-20, issue 929) — the three blocks the published subset gained", () => {
  const TABLE = "| Plan | Price |\n| --- | ---: |\n| Basic | **$85** |\n| Full | $220 |";

  it("a GFM table is a table: a head, a body, and each column set as its delimiter row declared", () => {
    const html = renderMarkdownHtml(TABLE);
    expect(html).toBe(
      `<div tabindex="0" role="group" aria-label="${COPY["body.table.label"]}">` +
        '<table><thead><tr><th>Plan</th><th class="text-right">Price</th></tr></thead>' +
        '<tbody><tr><td>Basic</td><td class="text-right"><strong>$85</strong></td></tr>' +
        '<tr><td>Full</td><td class="text-right">$220</td></tr></tbody></table></div>'
    );
  });

  it("a table scrolls inside its own box, and the box is the wrapper the caller names", () => {
    // `docs/DESIGN.md`'s no-overflow rule and §2.2's own: a wide table moves
    // rather than taking the page sideways with it. The wrapper is the one
    // scroll container `tests/ui/layout/checks.ts` allow-lists.
    const html = toHtml(parseMarkdown(TABLE), { tableWrap: "overflow-x-auto" });
    expect(
      html.startsWith(
        `<div tabindex="0" role="group" aria-label="${COPY["body.table.label"]}" class="overflow-x-auto"><table>`
      )
    ).toBe(true);
  });

  it("a cell holds inline content and every character of it is escaped", () => {
    const html = renderMarkdownHtml("| a |\n| --- |\n| <script>x</script> |");
    expect(html).toContain("<td>&lt;script&gt;x&lt;/script&gt;</td>");
    expect(html).not.toContain("<script>");
  });

  it("`a | b` is still a paragraph — a table needs its delimiter row", () => {
    expect(renderMarkdownHtml("a | b")).toBe("<p>a | b</p>");
  });

  it(":::answer is the short-answer box, with the registry's eyebrow over it", () => {
    const html = renderMarkdownHtml(":::answer\nA service costs $60 to $280.\n:::");
    expect(html).toBe(
      `<div><p>${COPY["body.answer.heading"]}</p><p>A service costs $60 to $280.</p></div>`
    );
    // The eyebrow is the registry's, not this module's.
    expect(COPY["body.answer.heading"]).toBe("The short answer");
  });

  it("a box inside a box says nothing: a nested :::answer is its own text", () => {
    const html = renderMarkdownHtml(":::answer\n:::answer\ninner\n:::\n:::");
    expect(html).toContain(":::answer");
  });

  it("**a body cannot mint related guides** — :::guides is literal text", () => {
    // SPEC §7 (2026-09-20): the links come from what ReachKit already
    // published, "chosen in code, never by the model". `guidesBlock` is the
    // only way to make one, so a model that writes the directive gets the
    // directive back as text.
    const html = renderMarkdownHtml(":::guides\n- [One](https://e.com/a)\n:::");
    expect(html).toContain(":::guides");
    expect(html).not.toContain("<a ");
  });

  it("guidesBlock is the mint, and it drops an address this product would not publish", () => {
    const block = guidesBlock({
      publisher: "Harbour Bike Repair",
      items: [
        { href: "https://e.com/a", label: "How often should you service a bike?" },
        { href: "javascript:alert(1)", label: "Not a guide" },
      ],
    });
    const html = toHtml([block]);
    expect(html).toContain(COPY["body.guides.heading"].replace("{publisher}", "Harbour Bike Repair"));
    expect(html).toContain('<a href="https://e.com/a">How often should you service a bike?</a>');
    // The dropped one leaves nothing at all — not a label without a link.
    expect(html).not.toContain("Not a guide");
  });

  it("an empty guides block renders nothing rather than an empty heading", () => {
    expect(toHtml([guidesBlock({ publisher: "Harbour Bike Repair", items: [] })])).toBe("");
  });
});

describe("issue 929 — the parser is standard, and the closed set is still the rule", () => {
  it("a construct the serialiser has no element for renders as its own source text", () => {
    // The rule the hand-written grammar took for a construct it did not
    // know, now true of every node micromark can produce.
    expect(renderMarkdownHtml("![alt](https://e.com/i.png)")).toBe(
      "<p>![alt](https://e.com/i.png)</p>"
    );
    expect(renderMarkdownHtml("Text with <b>bold</b> inline.")).toBe(
      "<p>Text with &lt;b&gt;bold&lt;/b&gt; inline.</p>"
    );
  });

  it("no image is ever emitted — SPEC §7 (2026-09-20): 'No images'", () => {
    expect(renderMarkdownHtml("![alt](https://e.com/i.png)")).not.toContain("<img");
  });

  it("the six blocks it always had render the bytes they always did", () => {
    // The engine changed and the output did not: what is already published
    // for a body of paragraphs is what this module still produces for it.
    expect(renderMarkdownHtml("a\nb\n\nc")).toBe("<p>a b</p>\n<p>c</p>");
    expect(renderMarkdownHtml("> said")).toBe("<blockquote>said</blockquote>");
    expect(renderMarkdownHtml("- a\n- b")).toBe('<ul role="list"><li>a</li><li>b</li></ul>');
    expect(renderMarkdownHtml("1. a\n2. b")).toBe('<ol role="list"><li>a</li><li>b</li></ol>');
    expect(renderMarkdownHtml("---")).toBe("<hr>");
    expect(renderMarkdownHtml("```\nx = 1\n```")).toBe('<pre tabindex="0"><code>x = 1</code></pre>');
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

describe("SPEC §7 (2026-09-29, issue 1140) — heading ids are minted here, from the heading's text", () => {
  it("an id is the heading's letters and digits, and a repeat is numbered", () => {
    const { blocks, headings } = withHeadingIds(
      parseMarkdown("## What it *costs* — in 2026?\n\nText.\n\n## What it costs in 2026\n\n### Größe")
    );
    expect(headings.map((h) => h.id)).toEqual(["what-it-costs-in-2026", "what-it-costs-in-2026-2", "größe"]);
    expect(toHtml(blocks)).toContain('<h2 id="what-it-costs-in-2026">What it <em>costs</em> — in 2026?</h2>');
  });

  it("a heading cannot write its own attribute, and the parser mints no id", () => {
    const md = '## "><script>alert(1)</script> onclick="x"';
    const html = toHtml(withHeadingIds(parseMarkdown(md)).blocks);
    expect(html).toMatch(/^<h2 id="[\p{L}\p{N}-]+">/u);
    expect(html).not.toContain("<script");
    expect(renderMarkdownHtml("## Plain")).toBe("<h2>Plain</h2>");
  });
});

describe("a link to an address that answers 410 shows its words without the link (issue 1506)", () => {
  const GONE = "https://content.example.com/reachkit-vs-aeo-engine";
  const gone = (href: string) => href === GONE;

  it("in a paragraph, a list, a table and inside emphasis; every other link stays", () => {
    const body = [
      `See [the old comparison](${GONE}) and [the guide](https://content.example.com/guide).`,
      "",
      `- **[bold old](${GONE})**`,
      "",
      "| Page | Link |",
      "| --- | --- |",
      `| Old | [here](${GONE}) |`,
    ].join("\n");
    const html = toHtml(withoutLinksTo(parseMarkdown(body), gone)).replace(CLASS_ATTR, "");
    expect(html).not.toContain(GONE);
    expect(html).toContain("See the old comparison and");
    expect(html).toContain('href="https://content.example.com/guide"');
    expect(html).toContain("<strong>bold old</strong>");
    expect(html).toContain("<td>here</td>");
  });
});

describe("a link to an address that moved is drawn at its address now (issue 1511)", () => {
  const OLD = "https://content.example.com/tools-to-track-ai";
  const NEW = "https://content.example.com/how-to-rank-on-chatgpt";
  const finalOf = (href: string) => (href === OLD ? NEW : null);

  it("in a paragraph, a list, a table, a box and inside emphasis; every other link stays", () => {
    const body = [
      `See [the old guide](${OLD}) and [pricing](https://example.com/pricing).`,
      "",
      `- **[bold old](${OLD})**`,
      "",
      "| Page | Link |",
      "| --- | --- |",
      `| Old | [here](${OLD}) |`,
    ].join("\n");
    const html = toHtml(withLinksMoved(parseMarkdown(body), finalOf)).replace(CLASS_ATTR, "");
    expect(html).not.toContain(OLD);
    expect(html.match(new RegExp(`href="${NEW}"`, "g"))).toHaveLength(3);
    expect(html).toContain('href="https://example.com/pricing"');
    expect(html).toContain("the old guide");
  });
});
