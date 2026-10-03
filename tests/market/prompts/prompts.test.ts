// SPEC §6 (owner, D19 final and D33 of 2026-10-03, issue 1162) — the tracked
// buyer prompts: the set a market yields, how it rotates, what one answer
// says, and the rate with its range.
import { describe, expect, it } from "vitest";
import { TRACKED_PROMPTS } from "../../../src/lib/config/constants.ts";
import { readPromptAnswer } from "../../../src/lib/market/prompts/answer.ts";
import { generatePrompts, type PromptMarket } from "../../../src/lib/market/prompts/generate.ts";
import { measurePrompts, type PromptSample } from "../../../src/lib/market/prompts/rate.ts";
import { EMPTY_PROMPT_SET, nextPromptSet, parsePromptSet, settlePrechecks } from "../../../src/lib/market/prompts/set.ts";

const MARKET: PromptMarket = {
  category: "privacy-friendly web analytics",
  synonyms: ["GDPR-compliant analytics", "privacy-first analytics", "lightweight analytics"],
  buyer: "Website owners and SaaS companies who want numbers without cookies",
  job: "Track their website visitors without compromising visitor privacy, so they stay compliant.",
  rivals: [
    { name: "Matomo", domain: "matomo.org" },
    { name: "Fathom Analytics", domain: "usefathom.com" },
    { name: "Simple Analytics", domain: "simpleanalytics.com" },
  ],
};

describe("the set a market yields", () => {
  it("a full market yields the owner's split: 5, 7, 4, 4, 3 and 2 branded", () => {
    const prompts = generatePrompts(MARKET, "Plausible");
    const byKind = Object.fromEntries(
      Object.keys(TRACKED_PROMPTS.SPLIT).map((kind) => [kind, prompts.filter((p) => p.kind === kind).length])
    );
    expect(byKind).toEqual(TRACKED_PROMPTS.SPLIT);
    expect(new Set(prompts.map((p) => p.text.toLowerCase())).size).toBe(25);
  });

  it("speaks as the buyer: the job in the first person, the buyer without its clause", () => {
    const texts = generatePrompts(MARKET, "Plausible").map((p) => p.text);
    expect(texts).toContain("Which tools help me track my website visitors without compromising visitor privacy on a small budget?");
    expect(texts).toContain("We are website owners and SaaS companies. Which privacy-friendly web analytics tool fits us best?");
    expect(texts).toContain("Is Plausible a good alternative to Matomo for privacy-friendly web analytics?");
  });

  it("a market with one rival invents no second one, and a market with no category yields nothing", () => {
    const one = generatePrompts({ ...MARKET, rivals: MARKET.rivals.slice(0, 1) }, "Plausible");
    expect(one.filter((p) => p.kind === "comparison")).toHaveLength(1);
    expect(generatePrompts({ ...MARKET, category: " " }, "Plausible")).toEqual([]);
  });
});

describe("the stored set and its rotation", () => {
  const now = new Date("2026-10-05T06:00:00Z");
  const first = nextPromptSet(EMPTY_PROMPT_SET, generatePrompts(MARKET, "Plausible"), now);

  it("is built whole the first time, with nothing to pre-check (D33)", () => {
    expect(first.prompts).toHaveLength(25);
    expect(first.prompts.some((p) => p.precheck === true)).toBe(false);
    expect(parsePromptSet(JSON.parse(JSON.stringify(first)))).toEqual(first);
  });

  it("stays the same set while the market does", () => {
    expect(nextPromptSet(first, generatePrompts(MARKET, "Plausible"), new Date("2026-10-12T06:00:00Z"))).toBe(first);
  });

  it("a wholly new market replaces at most a fifth in a quarter, each newcomer marked for its pre-check", () => {
    const moved = generatePrompts(
      { ...MARKET, category: "product analytics", synonyms: ["event analytics"], job: "See what users do in their app.", buyer: "Product teams" },
      "Plausible"
    );
    const week2 = nextPromptSet(first, moved, new Date("2026-10-12T06:00:00Z"));
    const fresh = week2.prompts.filter((p) => p.precheck === true);
    expect(fresh).toHaveLength(5);
    expect(week2.prompts).toHaveLength(25);

    // The quarter's allowance is spent: the next week changes nothing.
    expect(nextPromptSet(week2, moved, new Date("2026-10-19T06:00:00Z"))).toBe(week2);
    // Thirteen weeks on there is room again.
    const later = nextPromptSet(week2, moved, new Date("2027-01-18T06:00:00Z"));
    expect(later.prompts.filter((p) => p.addedAt.startsWith("2027-01-18"))).toHaveLength(5);
  });

  it("a rotated prompt whose answers named no brand leaves; one that named any stays", () => {
    const moved = generatePrompts({ ...MARKET, category: "product analytics" }, "Plausible");
    const rotated = nextPromptSet(first, moved, new Date("2026-10-12T06:00:00Z"));
    const [a, b] = rotated.prompts.filter((p) => p.precheck === true);
    const settled = settlePrechecks(rotated, new Map([[a!.id, "drop"], [b!.id, "keep"]]));
    expect(settled.prompts.some((p) => p.id === a!.id)).toBe(false);
    expect(settled.prompts.find((p) => p.id === b!.id)?.precheck).toBeUndefined();
  });
});

describe("what one answer says", () => {
  const read = (text: string, citedUrls: string[] = []) =>
    readPromptAnswer({
      text,
      citedUrls,
      citedDomains: citedUrls.map((url) => new URL(url).hostname),
      ownDomain: "plausible.io",
      siteName: "Plausible",
      rivals: MARKET.rivals,
    });

  it("named is the site's name in the text; linked is one of its pages among the citations", () => {
    expect(read("Plausible and Matomo are the usual picks.")).toMatchObject({ named: true, linked: false, rivals: ["matomo.org"] });
    const linked = read("Two options stand out.", ["https://plausible.io/privacy?utm_source=chatgpt.com#top", "https://usefathom.com/"]);
    expect(linked).toMatchObject({ named: false, linked: true, rivals: ["usefathom.com"] });
    expect(linked.ownUrls).toEqual(["https://plausible.io/privacy"]);
  });

  it("a word that only contains the name is not a mention", () => {
    expect(read("An implausible claim about analytics.").named).toBe(false);
  });

  it("an answer naming and citing nobody names no brand", () => {
    expect(read("Measure what matters and respect consent.").namesABrand).toBe(false);
  });
});

describe("the rate, its range, share of voice and pages cited", () => {
  const sample = (over: Partial<PromptSample>): PromptSample => ({
    promptId: "p1", kind: "category", named: false, linked: false, ownUrls: [], rivals: [], ...over,
  });

  it("the owner's two baselines: 0 of 92 is 0% (0–4%), 54 of 92 is 59% (48–68%)", () => {
    const none = measurePrompts(Array.from({ length: 92 }, () => sample({})));
    expect(none.rate).toMatchObject({ samples: 92, rate: 0 });
    expect([Math.round(none.rate!.low * 100), Math.round(none.rate!.high * 100)]).toEqual([0, 4]);

    const some = measurePrompts(Array.from({ length: 92 }, (_, i) => sample({ named: i < 54 })));
    expect(Math.round(some.rate!.rate * 100)).toBe(59);
    expect([Math.round(some.rate!.low * 100), Math.round(some.rate!.high * 100)]).toEqual([48, 68]);
  });

  it("branded prompts are counted apart, and a window with no answers has no rate", () => {
    const measure = measurePrompts([sample({ kind: "branded", named: true }), sample({})]);
    expect(measure.rate).toMatchObject({ samples: 1, rate: 0 });
    expect(measure.branded).toMatchObject({ samples: 1, rate: 1 });
    expect(measurePrompts([]).rate).toBeNull();
  });

  it("share of voice is the site's mentions over its own and its rivals'; a page cited twice is one page", () => {
    const page = "https://plausible.io/privacy";
    const measure = measurePrompts([
      sample({ linked: true, ownUrls: [page], rivals: ["matomo.org"] }),
      sample({ promptId: "p2", linked: true, ownUrls: [page] }),
      sample({ rivals: ["matomo.org", "usefathom.com"] }),
    ]);
    expect(measure.shareOfVoice).toBeCloseTo(2 / 5);
    expect(measure.rivals).toEqual([{ domain: "matomo.org", answers: 2 }, { domain: "usefathom.com", answers: 1 }]);
    expect(measure.pages).toEqual([{ url: page, answers: 2, promptIds: ["p1", "p2"] }]);
  });
});
