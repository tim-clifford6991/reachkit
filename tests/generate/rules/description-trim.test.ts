// tests/generate/rules/description-trim.test.ts — SPEC §7 (D51; owner R-A
// 2026-10-31): code fits a meta description, and its length never stops a page.
import "../env";
import { describe, expect, it } from "vitest";
import fixture from "../fixtures/dogfood-stopped-2026-10.json";
import { fitDescription } from "../../../src/lib/generate/pipeline/compose";
import { checkTitle, type TitleRuleInputs } from "../../../src/lib/generate/rules/title";

const TITLE = "7 best AI visibility tools for small businesses (2026)";
const rule = (description: string): TitleRuleInputs => ({
  type: "listicle",
  terms: ["ai visibility tool"],
  follow: [],
  asks: false,
  rivals: ["Profound"],
  places: [],
  holds: "7",
  year: 2026,
  titles: [],
  description,
});

describe("a meta description is fitted in code (R-A)", () => {
  it("cuts each real over-long description at a sentence or word boundary, adding nothing, and the page passes", () => {
    expect(fixture.descriptions.over.length).toBeGreaterThan(0);
    for (const written of fixture.descriptions.over) {
      const fitted = fitDescription(written);
      expect([...fitted].length).toBeLessThanOrEqual(155);
      expect([...fitted].length).toBeGreaterThanOrEqual(120);
      expect(written.startsWith(fitted)).toBe(true);
      expect(written.slice(fitted.length)).toMatch(/^[\s,;:–—-]/u);
      expect(checkTitle({ title: TITLE, rule: rule(fitted) })).toBeNull();
    }
  });

  it("keeps whole sentences where they come to 120 characters or more", () => {
    const first = "AI visibility tools track whether ChatGPT, Google AI and Perplexity name your business, and which rivals they name instead.";
    expect(fitDescription(`${first} Four tools are compared on price.`)).toBe(first);
  });

  it("leaves a description at or under 155 characters byte for byte", () => {
    for (const written of fixture.descriptions.within) expect(fitDescription(written)).toBe(written);
  });

  it("publishes a short description rather than stopping it", () => {
    const short = fitDescription("Four AI visibility tools compared on price.");
    expect(short).toBe("Four AI visibility tools compared on price.");
    expect(checkTitle({ title: TITLE, rule: rule(short) })).toBeNull();
  });
});
