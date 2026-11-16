// tests/generate/rules/description-trim.test.ts — SPEC §7 (D51; owner R-A
// 2026-10-31): code fits a meta description to a complete thought, and its
// length never stops a page.
import "../env";
import { describe, expect, it } from "vitest";
import fixture from "../fixtures/dogfood-stopped-2026-10.json";
import stored from "../fixtures/dogfood-drafts-2026-10.min.json";
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

const storedDescriptions = stored.drafts.map((draft) => (draft.meta as { description?: string }).description ?? "");

describe("a meta description is fitted in code (R-A)", () => {
  it("cuts each real over-long description to a complete thought ending in a full stop, adding nothing else, and the page passes", () => {
    const over = [...fixture.descriptions.over, ...storedDescriptions].filter((written) => [...written].length > 155);
    expect(over.length).toBeGreaterThan(5);
    for (const written of over) {
      const fitted = fitDescription(written, "");
      expect([...fitted].length).toBeLessThanOrEqual(155);
      expect(fitted).toMatch(/[.!?]$/);
      // Whole sentences, or a cut at a clause mark: never a bare word.
      if (!written.startsWith(fitted)) expect(written.slice(fitted.length - 1)).toMatch(/^\s?[,;:–—]\s/u);
      expect(checkTitle({ title: TITLE, rule: rule(fitted) })).toBeNull();
    }
  });

  it("b03e044f ends on its last whole sentence", () => {
    const b03 = stored.drafts.find((draft) => draft.id.startsWith("b03e044f"))!;
    expect(fitDescription((b03.meta as { description: string }).description, "")).toBe(
      "The best AI visibility tools for small businesses show where AI answers send buyers to rivals, then help fix it."
    );
  });

  it("one long sentence is cut at a clause, never on a function word", () => {
    const written =
      "AI visibility tools show whether ChatGPT, Gemini and Perplexity name your business, which rivals they name instead, and how a page a week written for your searches wins back the answers buyers read.";
    const fitted = fitDescription(written, "");
    expect(fitted).toBe("AI visibility tools show whether ChatGPT, Gemini and Perplexity name your business, which rivals they name instead.");
  });

  it("a German description is cut at its last clause mark or kept to whole sentences (de)", () => {
    const clause =
      "Sichtbarkeit in KI-Antworten zeigt, ob ChatGPT, Gemini und Perplexity Ihren Betrieb nennen, welche Mitbewerber stattdessen genannt werden und wie Sie mit eigenen Seiten für Ihre Suchen dagegenhalten.";
    expect(fitDescription(clause, "")).toBe("Sichtbarkeit in KI-Antworten zeigt, ob ChatGPT, Gemini und Perplexity Ihren Betrieb nennen.");
    const first = "Vier Anbieter für KI-Sichtbarkeit im Vergleich, mit Preisen und Grenzen für kleine Betriebe.";
    expect(fitDescription(`${first} Dazu zeigt die Übersicht, welche Mitbewerber ChatGPT und Gemini stattdessen nennen und wie Sie dagegenhalten.`, "")).toBe(first);
  });

  it("a cut that would end inside a clause takes the short answer's first sentence that fits (how-to-rank-on-chatgpt)", () => {
    const written =
      "Ranking on ChatGPT means getting named in its answers to buyer questions, which you do by measuring who it cites now and publishing pages that give it facts to cite.";
    const answer =
      "Ranking on ChatGPT means being one of the handful of companies it names when someone asks what to use. You get there by finding the questions your buyers ask.";
    expect(fitDescription(written, answer)).toBe("Ranking on ChatGPT means being one of the handful of companies it names when someone asks what to use.");
  });

  it("keeps whole sentences even where they come to under 120 characters (R-A)", () => {
    const first = "AI visibility tools track whether ChatGPT, Google AI and Perplexity name your business, and which rivals they name instead.";
    expect(fitDescription(`${first} Four tools are compared on price.`, "")).toBe(first);
  });

  it("leaves a description at or under 155 characters byte for byte", () => {
    for (const written of [...fixture.descriptions.within, "Four AI visibility tools compared on price"]) expect(fitDescription(written, "")).toBe(written);
  });

  it("publishes a short description rather than stopping it", () => {
    const short = fitDescription("Four AI visibility tools compared on price.", "");
    expect(short).toBe("Four AI visibility tools compared on price.");
    expect(checkTitle({ title: TITLE, rule: rule(short) })).toBeNull();
  });
});
