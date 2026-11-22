// SPEC §6 (owner D69 and D67 of 2026-10-07, issue 1318) — the tracked
// prompts are a buyer of that kind of business's own questions, a local
// business's name its place, and a stored set is rebuilt for its kind once.
import { describe, expect, it } from "vitest";
import { TRACKED_PROMPTS } from "../../../src/lib/config/constants.ts";
import { LANGUAGES, type Language } from "../../../src/lib/locale/locales.ts";
import { BUSINESS_KIND_NAMES } from "../../../src/lib/market/kinds.ts";
import { buyerPrompts } from "../../../src/lib/market/questions/buyer-prompts.ts";
import { generatePrompts, promptTemplateOf, type PromptMarket } from "../../../src/lib/market/prompts/generate.ts";
import { nextPromptSet } from "../../../src/lib/market/prompts/set.ts";

const PLUMBER: PromptMarket = {
  category: "emergency plumber austin",
  synonyms: ["plumber austin tx", "drain cleaning austin", "water heater repair austin"],
  buyer: "Homeowners and landlords in Austin needing a repair today",
  rivals: [
    { name: "Radiant Plumbing", domain: "radiantplumbing.example" },
    { name: "Stan's Pipes", domain: "stanspipes.example" },
    { name: "Abacus", domain: "abacusplumbing.example" },
  ],
  kind: "local-service",
};
const AUSTIN = { name: "Austin", region: "Texas" };
const SOFTWARE_WORDS = /\b(tools?|software|platforms?|free trial|engineering team|anbieter|testphase)\b/i;

describe("each kind of business asks its own buyers' questions", () => {
  it("every kind yields the owner's 25 in 5/7/4/4/3/2, in both languages, each from a template", () => {
    for (const language of Object.keys(LANGUAGES) as Language[]) {
      for (const kind of BUSINESS_KIND_NAMES) {
        const prompts = generatePrompts({ ...PLUMBER, kind }, "Northside Plumbing", language);
        const split = Object.fromEntries(Object.keys(TRACKED_PROMPTS.SPLIT).map((k) => [k, prompts.filter((p) => p.kind === k).length]));
        expect(split, `${kind} in ${language}`).toEqual(TRACKED_PROMPTS.SPLIT);
        expect(prompts.filter((p) => promptTemplateOf(p.text) === null), `${kind} in ${language}`).toEqual([]);
      }
    }
  });

  it("only software is asked about tools, platforms and free trials", () => {
    for (const language of Object.keys(LANGUAGES) as Language[]) {
      for (const kind of BUSINESS_KIND_NAMES.filter((each) => each !== "software")) {
        const odd = generatePrompts({ ...PLUMBER, kind }, "Northside Plumbing", language).filter((p) => SOFTWARE_WORDS.test(p.text));
        expect(odd, `${kind} in ${language}`).toEqual([]);
      }
    }
    expect(generatePrompts({ ...PLUMBER, kind: undefined }, "Northside Plumbing").some((p) => SOFTWARE_WORDS.test(p.text))).toBe(true);
  });

  it("a plumber in Austin is asked about emergencies, cost and trust, in Austin", () => {
    const prompts = generatePrompts(PLUMBER, "Northside Plumbing", "en", AUSTIN);
    const texts = prompts.map((p) => p.text);
    expect(texts).toContain("Looking for the best emergency plumber in Austin. Who would you recommend, and why?");
    expect(texts).toContain("Which drain cleaning in Austin would locals actually recommend?");
    expect(texts).toContain("Which emergency plumber in Austin will give a fixed price before starting?");
    expect(texts).toContain("We are homeowners and landlords. Which emergency plumber in Austin would suit us best?");
    expect(texts).toContain("Looking for the best emergency plumber in Austin: how does Radiant Plumbing compare with Stan's Pipes?");
    const namesMarket = prompts.filter((p) => ["category", "use-case", "persona", "problem"].includes(p.kind));
    expect(namesMarket.filter((p) => !p.text.includes(" in Austin"))).toEqual([]);
    expect(texts.join(" ")).not.toMatch(/austin tx|plumber austin\b/);
  });

  it("a German bakery is asked in German, the market's name first and capitalised", () => {
    const texts = generatePrompts(
      { category: "bäckerei düsseldorf", synonyms: ["brötchen düsseldorf"], buyer: "Familien und Berufstätige, die morgens frische Brötchen holen", rivals: [], kind: "shop" },
      "Bäckerei Hinkel",
      "de",
      { name: "Düsseldorf" }
    ).map((p) => p.text);
    expect(texts).toContain("Bäckerei in Düsseldorf: Wo kaufen Sie am liebsten, und warum?");
    expect(texts).toContain("Brötchen in Düsseldorf: Welche Adressen werden wirklich empfohlen?");
    expect(texts).toContain("Wir sind Familien und Berufstätige. Bäckerei in Düsseldorf: Wo sollten wir kaufen?");
  });

  it("software is bought from anywhere: its prompts never name a place", () => {
    const texts = generatePrompts({ ...PLUMBER, category: "scheduling software", synonyms: [], buyer: "Consultants who book their own meetings", kind: "software" }, "Cal", "en", AUSTIN).map((p) => p.text);
    expect(texts.filter((text) => text.includes("Austin"))).toEqual([]);
  });

  it("the few prompts a deep pass asks beside the twelve follow the kind and the place", () => {
    expect(buyerPrompts({ ...PLUMBER, rivals: [], job: "Fix a leak today" }, 3, "en", AUSTIN)).toEqual([
      "Looking for the best emergency plumber in Austin. Who would you recommend, and why?",
      "Which plumber in Austin would locals actually recommend?",
      "Which drain cleaning in Austin would locals actually recommend?",
    ]);
    expect(buyerPrompts({ ...PLUMBER, rivals: [], kind: undefined, job: "" }, 1)[0]).toBe("What are the best emergency plumber austin tools?");
  });
});

describe("a stored set is rebuilt for its kind once (D54's rule)", () => {
  const then = new Date("2026-10-01T06:00:00Z");
  const now = new Date("2026-10-08T06:00:00Z");
  const asSoftware = nextPromptSet({ prompts: [], rotations: [] }, generatePrompts({ ...PLUMBER, kind: undefined }, "Northside Plumbing"), then);
  const forPlumber = generatePrompts(PLUMBER, "Northside Plumbing", "en", AUSTIN);

  it("a set worded for software is rebuilt whole when the kind is first recorded, and the rate restarts there", () => {
    const rebuilt = nextPromptSet(asSoftware, forPlumber, now, null, "local-service");
    expect(rebuilt.prompts.map((p) => p.text)).toEqual(forPlumber.map((p) => p.text));
    expect(rebuilt).toMatchObject({ kind: "local-service", rebuiltAt: now.toISOString(), rotations: [] });
  });

  it("is rebuilt once: a kind that changes later moves the set at the rotation rate only", () => {
    const rebuilt = nextPromptSet(asSoftware, forPlumber, now, null, "local-service");
    const later = nextPromptSet(rebuilt, generatePrompts({ ...PLUMBER, kind: "shop" }, "Northside Plumbing", "en", AUSTIN), new Date("2026-10-15T06:00:00Z"), null, "shop");
    expect(later.rebuiltAt).toBe(now.toISOString());
    expect(later.kind).toBe("local-service");
    expect(later.prompts.filter((p) => !rebuilt.prompts.some((held) => held.id === p.id)).length).toBeLessThanOrEqual(5);
  });

  it("a software site's set is not rebuilt: its kind is written beside the prompts it has", () => {
    const software = generatePrompts({ ...PLUMBER, kind: "software" }, "Northside Plumbing");
    const kept = nextPromptSet(asSoftware, software, now, null, "software");
    expect(kept.rebuiltAt).toBeUndefined();
    expect(kept.kind).toBe("software");
    expect(kept.prompts).toEqual(asSoftware.prompts);
  });
});
