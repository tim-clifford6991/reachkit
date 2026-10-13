// tests/generate/voice/register.test.ts — SPEC §7 (owner, 2026-10-10; issue
// 1390): a page's voice is chosen from the site's voice text, its kind of
// business and the question, and the customer's own choice stands.
import { describe, expect, it } from "vitest";
import { chooseVoice, voiceLength, voiceRules } from "../../../src/lib/generate/voice/register";

const base = { setting: null, voiceText: null, category: "restaurant", question: "how to book a table for ten", type: "how_to", language: "en" } as const;

describe("the page's voice", () => {
  it("is the business's own, as we, unless the business is one that is written for formally", () => {
    expect(chooseVoice(base)).toEqual({ voice: "ours", person: "we", chosen: "automatic" });
    expect(chooseVoice({ ...base, category: "chartered accountants and tax advisers" })).toMatchObject({ voice: "guide", person: "third" });
    expect(chooseVoice({ ...base, category: "Zahnarztpraxis", language: "de" })).toMatchObject({ voice: "guide" });
    expect(chooseVoice({ ...base, category: "design agency", voiceText: "Formal and reserved, never chatty." })).toMatchObject({ voice: "guide" });
    expect(chooseVoice({ ...base, category: "design agency", voiceText: "Informal, first person plural." })).toMatchObject({ voice: "ours" });
  });

  it("is a short answer for a simple question on a page a short answer suits, in either language", () => {
    const short = chooseVoice({ ...base, type: "qa", question: "is sourdough gluten free" });
    expect(short).toMatchObject({ voice: "short", person: "we" });
    expect(voiceLength(short)).toEqual({ floor: 600, ceiling: 900 });
    expect(voiceRules(short).join(" ")).toContain("600 to 900 words");
    expect(chooseVoice({ ...base, type: "qa", language: "de", question: "was kostet eine Zahnreinigung", category: "Zahnarzt" })).toMatchObject({ voice: "short", person: "third" });
    // A choice among options, a task and a comparison page are not short answers.
    expect(chooseVoice({ ...base, type: "qa", question: "what is the best scheduling app" }).voice).toBe("ours");
    expect(chooseVoice({ ...base, type: "how_to", question: "is sourdough gluten free" }).voice).toBe("ours");
    expect(voiceLength(chooseVoice(base))).toBeNull();
  });

  it("is the customer's where they fixed one, and a comparison is never cut to a short answer", () => {
    expect(chooseVoice({ ...base, setting: "guide" })).toEqual({ voice: "guide", person: "third", chosen: "customer" });
    expect(chooseVoice({ ...base, setting: "ours", category: "law firm" })).toMatchObject({ voice: "ours", person: "we" });
    expect(chooseVoice({ ...base, setting: "short", type: "listicle" })).toMatchObject({ voice: "ours", chosen: "customer" });
    expect(chooseVoice({ ...base, setting: "short", type: "documentation" })).toMatchObject({ voice: "short" });
  });
});
