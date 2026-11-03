// Issue 2341: a title stopped as `banned` for saying a word twice is told
// which word, and a candidate free of the fault is the one picked. The
// stored case is ecf4f99d's title; the same holds for a local service and a
// seller of the customer panel. 0¢: code only.
import "../env";
import { describe, expect, it } from "vitest";
import { titleRuleFor } from "../../../src/lib/generate/pipeline/title";
import { pickTitle, titleNotes } from "../../../src/lib/generate/rules/title";
import { pack } from "../fixtures";

const CASES = [
  {
    kind: "SaaS (stored, ecf4f99d)",
    search: "generative engine optimization examples",
    language: "en" as const,
    stopped: "Generative engine optimization examples: 4 AI engines compared",
    word: "engine",
    passing: "Generative engine optimization examples from ChatGPT to Perplexity",
  },
  {
    kind: "local service",
    search: "self assessment tax return deadline",
    language: "en" as const,
    stopped: "Self assessment tax return deadline: 3 HMRC deadlines to know",
    word: "deadline",
    passing: "Self assessment tax return deadline: 31 January and 3 HMRC fines",
  },
  {
    kind: "seller",
    search: "sauerteigbrot düsseldorf",
    language: "de" as const,
    stopped: "Sauerteigbrot Düsseldorf: Brot backen, Brot kaufen in Bilk",
    word: "brot",
    passing: "Sauerteigbrot Düsseldorf: 3 Sorten aus der Backstube in Bilk",
  },
];

describe.each(CASES)("a title that says a word twice, $kind", ({ search, language, stopped, word, passing }) => {
  const rule = titleRuleFor(
    pack({ type: "listicle", target: { question: search, searches: [search] }, ...(language === "en" ? {} : { locale: { country: "DE", language } }) }),
    { description: "x".repeat(140) }
  );

  it("is `banned`, and the fix note names the word said twice", () => {
    const [candidate] = pickTitle([stopped], rule).candidates;
    expect(candidate?.faults).toContain("banned");
    expect(titleNotes(stopped, rule, ["banned"]).join(" ")).toContain(`"${word}" twice`);
  });

  it("is never picked over a candidate that is free of it", () => {
    const { chosen, candidates } = pickTitle([stopped, passing], rule);
    expect(candidates.find((each) => each.title === passing)?.faults).not.toContain("banned");
    expect(chosen).toBe(passing);
  });
});
