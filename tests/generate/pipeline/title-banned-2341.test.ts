// Issue 2341: a title `banned` for saying a word twice is told which word, and a candidate free of it is picked.
// ecf4f99d's stored title, and the same for a local service and a seller of the panel. 0¢: code only.
import "../env";
import { describe, expect, it } from "vitest";
import { titleRuleFor } from "../../../src/lib/generate/pipeline/title";
import { pickTitle, titleNotes } from "../../../src/lib/generate/rules/title";
import { pack } from "../fixtures";

describe.each([
  ["generative engine optimization examples", "en", "Generative engine optimization examples: 4 AI engines compared", "engine", "Generative engine optimization examples from ChatGPT to Perplexity"],
  ["self assessment tax return deadline", "en", "Self assessment tax return deadline: 3 HMRC deadlines to know", "deadline", "Self assessment tax return deadline: 31 January and 3 HMRC fines"],
  ["sauerteigbrot düsseldorf", "de", "Sauerteigbrot Düsseldorf: Brot backen, Brot kaufen in Bilk", "brot", "Sauerteigbrot Düsseldorf: 3 Sorten aus der Backstube in Bilk"],
] as const)("%s", (search, language, stopped, word, passing) => {
  it("is `banned`, its note names the word said twice, and a candidate free of it is picked", () => {
    const locale = language === "en" ? {} : { locale: { country: "DE" as const, language } };
    const rule = titleRuleFor(pack({ type: "listicle", target: { question: search, searches: [search] }, ...locale }), { description: "x".repeat(140) });
    expect(pickTitle([stopped], rule).candidates[0]?.faults).toContain("banned");
    expect(titleNotes(stopped, rule, ["banned"]).join(" ")).toContain(`"${word}" twice`);
    expect(pickTitle([stopped, passing], rule).chosen).toBe(passing);
  });
});
