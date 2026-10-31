// tests/generate/rules/description-trim.test.ts — SPEC §7 (D51; owner R-A
// 2026-10-31): code fits a meta description to a complete thought, and its
// length never stops a page.
import "../env";
import { describe, expect, it } from "vitest";
import fixture from "../fixtures/dogfood-stopped-2026-10.json";
import stored from "../fixtures/dogfood-drafts-2026-10.min.json";
import { fitDescription } from "../../../src/lib/generate/pipeline/compose";
import { LANGUAGE_PACKS, languagePack } from "../../../src/lib/locale/language";
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

const tailOf = (packs = LANGUAGE_PACKS): Set<string> => new Set(packs.flatMap((pack) => [...pack.stopWords, ...pack.descriptionTail]));
const lastWord = (text: string): string => text.split(/\s+/).at(-1)!.toLowerCase().replace(/[^\p{L}\p{N}]+$/u, "");
const storedDescriptions = stored.drafts.map((draft) => (draft.meta as { description?: string }).description ?? "");

describe("a meta description is fitted in code (R-A)", () => {
  it("cuts each real over-long description to a complete thought ending in a full stop, adding nothing else, and the page passes", () => {
    const over = [...fixture.descriptions.over, ...storedDescriptions].filter((written) => [...written].length > 155);
    expect(over.length).toBeGreaterThan(5);
    for (const written of over) {
      // Stored rows carry no locale, so every language's function words count, as on the recheck.
      const fitted = fitDescription(written, undefined);
      expect([...fitted].length).toBeLessThanOrEqual(155);
      expect(fitted).toMatch(/[.!?]$/);
      // A run of whole sentences is a complete thought however it ends ("…then help fix it."); a cut is held to its last word.
      if (!written.startsWith(fitted)) expect([written.startsWith(fitted.slice(0, -1)), tailOf().has(lastWord(fitted))]).toEqual([true, false]);
      expect(checkTitle({ title: TITLE, rule: rule(fitted) })).toBeNull();
    }
  });

  it("b03e044f ends on its last whole sentence", () => {
    const b03 = stored.drafts.find((draft) => draft.id.startsWith("b03e044f"))!;
    expect(fitDescription((b03.meta as { description: string }).description, "en")).toBe(
      "The best AI visibility tools for small businesses show where AI answers send buyers to rivals, then help fix it."
    );
  });

  it("one long sentence is cut at a clause, never on a function word", () => {
    const written =
      "AI visibility tools show whether ChatGPT, Gemini and Perplexity name your business, which rivals they name instead, and how a page a week written for your searches wins back the answers buyers read.";
    const fitted = fitDescription(written, "en");
    expect(fitted).toBe("AI visibility tools show whether ChatGPT, Gemini and Perplexity name your business, which rivals they name instead.");
    expect(["and", "the", "with", "of"]).not.toContain(lastWord(fitted));
  });

  it("a German description ends on a content word (de)", () => {
    const de = tailOf([languagePack("de")]);
    const clause =
      "Sichtbarkeit in KI-Antworten zeigt, ob ChatGPT, Gemini und Perplexity Ihren Betrieb nennen, welche Mitbewerber stattdessen genannt werden und wie Sie mit eigenen Seiten für Ihre Suchen dagegenhalten.";
    expect(fitDescription(clause, "de")).toBe("Sichtbarkeit in KI-Antworten zeigt, ob ChatGPT, Gemini und Perplexity Ihren Betrieb nennen.");
    // No clause boundary fits, and the word cut lands on "und".
    const words =
      "Diese Übersicht vergleicht vier Anbieter für Betriebe nach Preis und Umfang und zeigt Schritt für Schritt wie Ihr Betrieb in KI-Antworten genannt wird und mit eigenen Seiten für Ihre Suchen gefunden wird.";
    const fitted = fitDescription(words, "de");
    expect(fitted).toBe("Diese Übersicht vergleicht vier Anbieter für Betriebe nach Preis und Umfang und zeigt Schritt für Schritt wie Ihr Betrieb in KI-Antworten genannt.");
    expect(de.has(lastWord(fitted))).toBe(false);
    const first = "Vier Anbieter für KI-Sichtbarkeit im Vergleich, mit Preisen und Grenzen für kleine Betriebe.";
    expect(fitDescription(`${first} Dazu zeigt die Übersicht, welche Mitbewerber ChatGPT und Gemini stattdessen nennen und wie Sie dagegenhalten.`, "de")).toBe(first);
  });

  it("keeps whole sentences even where they come to under 120 characters (R-A)", () => {
    const first = "AI visibility tools track whether ChatGPT, Google AI and Perplexity name your business, and which rivals they name instead.";
    expect(fitDescription(`${first} Four tools are compared on price.`, "en")).toBe(first);
  });

  it("leaves a description at or under 155 characters byte for byte", () => {
    for (const written of [...fixture.descriptions.within, "Four AI visibility tools compared on price"]) expect(fitDescription(written, "en")).toBe(written);
  });

  it("publishes a short description rather than stopping it", () => {
    const short = fitDescription("Four AI visibility tools compared on price.", "en");
    expect(short).toBe("Four AI visibility tools compared on price.");
    expect(checkTitle({ title: TITLE, rule: rule(short) })).toBeNull();
  });
});
