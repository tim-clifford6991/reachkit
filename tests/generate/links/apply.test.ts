// tests/generate/links/apply.test.ts — SPEC §7 (2026-09-12): a finished
// body links the chosen pages of the customer's site, and none it guessed,
// in Markdown the one renderer reads back as those links.
import "../env";
import { describe, expect, it } from "vitest";
import { applyLinks } from "../../../src/lib/generate/links/apply";
import type { LinkTarget } from "../../../src/lib/generate/links/select";
import { renderMarkdownHtml } from "../../../src/lib/publish/render/markdown";

const PRICING: LinkTarget = { source: "site", purpose: "pricing", url: "https://example.com/pricing", label: "Plans" };
const ABOUT: LinkTarget = { source: "site", purpose: "about", url: "https://example.com/about", label: "Who we are" };
const EARLIER: LinkTarget = { source: "cluster", url: "https://content.example.com/first-page", label: "The first page" };
const GROUNDED = "https://example.com/docs/seats";

function apply(markdown: string, targets: LinkTarget[] = [PRICING, ABOUT, EARLIER]): string {
  return applyLinks(markdown, { domain: "example.com", targets, groundedUrl: GROUNDED });
}

function hrefs(markdown: string): string[] {
  return [...renderMarkdownHtml(markdown).matchAll(/href="([^"]+)"/g)].map((m) => m[1] ?? "");
}

describe("every chosen page is linked", () => {
  it("keeps the links the model wrote and appends the ones it did not, each once", () => {
    const out = apply("Read [our plans](https://example.com/pricing/) first.\n\nThen decide.");
    expect(hrefs(out).sort()).toEqual(
      ["https://example.com/pricing", "https://example.com/about", "https://content.example.com/first-page"].sort()
    );
    expect(out).toContain("[our plans](https://example.com/pricing)");
    expect(out).toContain("- [Who we are](https://example.com/about)");
    expect(out).toContain("- [The first page](https://content.example.com/first-page)");
  });

  it("appends nothing where the body already links every chosen page", () => {
    const body = "See [plans](https://example.com/pricing), [us](https://example.com/about) and [before](https://content.example.com/first-page).";
    expect(apply(body)).toBe(body);
  });

  it("with no chosen pages, a body with no site links is returned as it was", () => {
    expect(apply("Just text.", [])).toBe("Just text.");
  });
});

describe("no link known to lead nowhere is written", () => {
  it("unwraps a guessed address on the customer's domain to its words", () => {
    const out = apply("See [the careers page](https://example.com/careers).", []);
    expect(out).toBe("See the careers page.");
    expect(hrefs(out)).toEqual([]);
  });

  it("unwraps a guessed site-relative path, and rewrites a chosen one absolute", () => {
    const out = apply("See [pricing](/pricing) and [the team](/team).", [PRICING]);
    expect(out).toBe("See [pricing](https://example.com/pricing) and the team.");
  });

  it("a site with no pricing page publishes with no pricing link, whatever the model wrote", () => {
    const out = apply("Compare [our pricing](https://example.com/pricing).", [ABOUT]);
    expect(hrefs(out)).toEqual(["https://example.com/about"]);
    expect(out).not.toContain("pricing)");
  });

  it("leaves the grounded source, other sites' pages and code spans alone", () => {
    const body = [
      "Per [the seat docs](https://example.com/docs/seats), and [a rival](https://rival.example/pricing).",
      "Type `[x](https://example.com/nope)` to link.",
      "```",
      "[y](https://example.com/nope)",
      "```",
    ].join("\n");
    expect(apply(body, [])).toBe(body);
  });
});

describe("the one serialiser reads the links back", () => {
  it("a label with brackets and an address with a parenthesis still render as one link", () => {
    const odd: LinkTarget = {
      source: "site",
      purpose: "product",
      url: "https://example.com/products/widget_(v2)",
      label: "Widget [v2]",
    };
    const out = apply("Body.", [odd]);
    expect(renderMarkdownHtml(out)).toContain('<a href="https://example.com/products/widget_(v2%29">Widget v2</a>');
  });
});
