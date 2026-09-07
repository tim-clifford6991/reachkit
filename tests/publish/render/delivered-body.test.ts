// tests/publish/render/delivered-body.test.ts — issue #158: the conversion
// that stands between a draft's Markdown and what a reader meets on the
// customer's own domain, and the two promises it must not break.
//
// The rows here are about the *seam*, not the grammar — the grammar is
// `markdown.test.ts`'s. What this file holds is that the one renderer's
// output is still the body §9's 24-hour check compares against, and that
// nothing a body can carry becomes markup on somebody else's site.
import { describe, expect, it } from "vitest";
import { bodyCoverage } from "@/lib/publish/verify/coverage";
import { MARKDOWN_LINK_SCHEMES } from "@/lib/config/constants";
import { renderMarkdownHtml } from "@/lib/publish/render/markdown";

const BODY = [
  "# How to choose a kiln",
  "",
  "A **top-loading** kiln fires to cone 6 in about eight hours, and the",
  "[potters' guild](https://example.com/guild) publishes its own schedule.",
  "",
  "## What to look at first",
  "",
  "- The chamber's inside height",
  "- Whether the elements are replaceable",
  "- The controller, and whether anyone still services it",
  "",
  "> A kiln outlives the studio it was bought for.",
  "",
  "1. Measure the doorway",
  "2. Measure the circuit",
  "",
  "```",
  "cone 6 = 1222C",
  "```",
  "",
  "---",
  "",
  "Ask before you buy. See `firing.md` for the rest.",
].join("\n");

describe("the 24-hour check still reads the same body it compares against", () => {
  it("every word of the draft survives the conversion, so a correctly published page reads as complete", () => {
    // What the destination now receives, read back as a live page would be.
    expect(bodyCoverage(renderMarkdownHtml(BODY), BODY)).toBe(1);
  });

  it("it is not worse than sending the Markdown raw — the conversion adds words to no one's page and loses none", () => {
    expect(bodyCoverage(renderMarkdownHtml(BODY), BODY)).toBeGreaterThanOrEqual(
      bodyCoverage(BODY, BODY)
    );
  });

  it("a page that returned none of its words is still nowhere to hide", () => {
    expect(bodyCoverage("<html><body>This domain is for sale.</body></html>", BODY)).toBeLessThan(
      0.2
    );
  });
});

describe("the sanitisation rule is the escaping, and it is total", () => {
  it("markup in a body is text on the page, never markup", () => {
    const html = renderMarkdownHtml('<script>alert(1)</script> and <img onerror="x">');
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("onerror");
  });

  it("an HTML comment in a body cannot smuggle one out", () => {
    expect(renderMarkdownHtml("before <!-- hidden --> after")).not.toContain("<!--");
  });

  it("the elements it can emit are the closed set the serialiser names, and no other", () => {
    const emitted = new Set(
      [...renderMarkdownHtml(BODY).matchAll(/<([a-z][a-z0-9]*)\b/g)].map((m) => m[1])
    );
    expect([...emitted].sort()).toEqual(
      ["a", "blockquote", "code", "em", "h1", "h2", "hr", "li", "ol", "p", "pre", "strong", "ul"].filter(
        (tag) => emitted.has(tag)
      )
    );
    for (const tag of emitted) {
      expect(
        ["a", "blockquote", "code", "em", "h1", "h2", "h3", "h4", "h5", "h6", "hr", "li", "mark", "ol", "p", "pre", "strong", "ul"]
      ).toContain(tag);
    }
  });

  it("the only attributes it writes are href and class", () => {
    const attributes = new Set(
      [...renderMarkdownHtml(BODY).matchAll(/<[a-z][a-z0-9]*\s+([a-z-]+)=/g)].map((m) => m[1])
    );
    for (const attribute of attributes) expect(["href", "class"]).toContain(attribute);
  });
});

describe("the address policy is an allowlist, and it is the pinned one", () => {
  it.each([...MARKDOWN_LINK_SCHEMES])("a %s address becomes a link", (scheme) => {
    const html = renderMarkdownHtml(`[label](${scheme}example.com/x)`);
    expect(html).toContain(`href="${scheme}example.com/x"`);
  });

  it.each(["javascript:", "data:text/html;base64,", "vbscript:", "file://"])(
    "a %s address is not a link at all — the label renders and nothing becomes clickable",
    (scheme) => {
      const html = renderMarkdownHtml(`[label](${scheme}whatever)`);
      expect(html).not.toContain("href");
      expect(html).not.toContain(scheme);
      expect(html).toContain("label");
    }
  );

  it("a scheme is added by editing the pin, not by editing the renderer", () => {
    expect([...MARKDOWN_LINK_SCHEMES]).toEqual(["http://", "https://", "mailto:", "/"]);
  });
});

describe("the conversion is deterministic", () => {
  it("the same body renders to the same bytes, every time", () => {
    expect(renderMarkdownHtml(BODY)).toBe(renderMarkdownHtml(BODY));
  });

  it("a body carrying no Markdown at all is one paragraph and nothing else", () => {
    expect(renderMarkdownHtml("Just a sentence.")).toBe("<p>Just a sentence.</p>");
  });

  it("an empty body renders to nothing rather than to an empty element", () => {
    expect(renderMarkdownHtml("")).toBe("");
  });
});
