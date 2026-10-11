// tests/generate/links/text.test.ts — SPEC §7 (2026-10-10, issue 1391): a
// link's text names what the reader finds at the other end.
import "../env";
import { describe, expect, it } from "vitest";
import { applyLinks } from "../../../src/lib/generate/links/apply";
import type { LinkTarget } from "../../../src/lib/generate/links/select";
import { linkTextProblem, pageName, widenNumberLinks } from "../../../src/lib/generate/links/text";

describe("what cannot stand as a link's text", () => {
  it.each([
    ["1", "number"],
    ["42%", "number"],
    ["click here", "generic"],
    ["Here.", "generic"],
    ["https://example.com/pricing", "address"],
    ["  ", "empty"],
  ])("%s is refused as %s", (label, problem) => {
    expect(linkTextProblem(label)).toBe(problem);
  });

  it("a price, a name and a description stand", () => {
    for (const label of ["€49 a month", "Otterly", "our catering menu"]) expect(linkTextProblem(label)).toBeNull();
  });
});

describe("a bare figure takes in the words it counts", () => {
  it("the page that went live with a link reading \"1\"", () => {
    expect(widenNumberLinks("AI answers cited otterly.ai for [1](https://reachkit.app/) of the 11 buyer questions and others.")).toBe(
      "AI answers cited otterly.ai for [1 of the 11 buyer questions](https://reachkit.app/) and others."
    );
  });

  it("reads back to the words before it where none follow, and leaves a figure alone in a cell", () => {
    expect(widenNumberLinks("Plans start at [49](https://example.com/pricing).")).toBe("[Plans start at 49](https://example.com/pricing).");
    expect(widenNumberLinks("| [11](https://example.com/a) |")).toBe("| [11](https://example.com/a) |");
  });
});

describe("a page's name", () => {
  it("is the heading that says what the address says, in the site's own language", () => {
    expect(pageName({ url: "https://example.de/ueber-uns", title: "Über uns – Firma", h1: "" })).toBe("Über uns");
    expect(pageName({ url: "https://example.com/menu", title: "Blue Door Cafe", h1: "Our menu" })).toBe("Our menu");
  });

  it("is the address's own words where every heading is a slogan", () => {
    expect(pageName({ url: "https://example.com/scans", title: "Every free scan, in the open.", h1: "" })).toBe("Scans");
  });
});

describe("a finished body is held to it", () => {
  const PRICING: LinkTarget = {
    source: "site",
    purpose: "pricing",
    url: "https://example.com/pricing",
    label: "Pricing",
    said: ["One plan. One page a day."],
  };
  const apply = (markdown: string): string =>
    applyLinks(markdown, { domain: "example.com", targets: [PRICING], groundedUrl: "https://example.com/docs" });

  it("a link that rewords the page's slogan is unwrapped, and the page is listed under its name", () => {
    const out = apply("There is [one plan — one page a day](https://example.com/pricing) for everyone.");
    expect(out).toContain("There is one plan — one page a day for everyone.");
    expect(out).toContain("- [Pricing](https://example.com/pricing)");
  });

  it("\"click here\" into the site is unwrapped; elsewhere it is named by its host", () => {
    const out = apply("To see plans [click here](https://example.com/pricing). A study is [here](https://www.study.org/2026).");
    expect(out).toContain("To see plans click here.");
    expect(out).toContain("[study.org](https://www.study.org/2026)");
  });

  it("a described link stands, and nothing is listed for it", () => {
    const body = "See [what each plan costs](https://example.com/pricing).";
    expect(apply(body)).toBe(body);
  });
});
