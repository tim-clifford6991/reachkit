// Issue 1287 (D58, D59) — every measurement checks its own health, and
// context stays relevant. Each check is shown passing and failing, then the
// dry run: reachkit.app as production stored it after scan 17f5bbff, through
// the product's own functions. Nothing is bought and nothing is written.
import "../generate/env.ts";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { byDemand } from "../../src/lib/market/infer/demand.ts";
import { parseStoredMarket } from "../../src/lib/market/infer/stored.ts";
import { spokenMarket } from "../../src/lib/market/infer/terms.ts";
import type { MarketConclusion } from "../../src/lib/market/infer/types.ts";
import { generatePrompts } from "../../src/lib/market/prompts/generate.ts";
import type { PromptSample } from "../../src/lib/market/prompts/rate.ts";
import { parsePromptSet, promptId } from "../../src/lib/market/prompts/set.ts";
import { noLongerRelevant } from "../../src/lib/opportunities/derive/topics.ts";
import { checkHealth, failingChecks, parseHealth, type HealthInput } from "../../src/lib/scan/health.ts";

const AT = new Date("2026-10-06T11:26:00Z");
const MARKET: MarketConclusion = {
  buyer: "Website owners",
  job: "Count visitors without cookies.",
  category: "privacy-friendly web analytics",
  synonyms: [],
  differentiators: [],
  notOurMarket: ["Session replay software"],
  categoryReason: "",
  termsAt: "2026-10-01T00:00:00.000Z",
  searchTerm: "privacy-friendly web analytics",
  terms: [{ term: "privacy-friendly web analytics", volume: 1900 }],
  rivals: [
    { domain: "matomo.org", name: "Matomo", basis: "ranks", reason: "", searchNames: ["matomo"], volume: 9900 },
    { domain: "usefathom.com", name: "Fathom", basis: "ai_answer", reason: "", searchNames: ["fathom analytics"], volume: 1300 },
    { domain: "simpleanalytics.com", name: "Simple Analytics", basis: "ranks", reason: "", searchNames: ["simple analytics"], volume: 880 },
  ],
  demand: {
    at: "2026-10-01T00:00:00.000Z",
    own: 2400,
    brands: { plausible: 2400, matomo: 9900, fathom: 49500, "fathom analytics": 1300, "simple analytics": 880, pirsch: 390 },
  },
};
const sample = (named: boolean): PromptSample => ({ promptId: "p", kind: "category", named, linked: false, ownUrls: [], rivals: [] });
const promptsOf = (market: MarketConclusion) => generatePrompts(spokenMarket(market), "Plausible");
const asked = (market: MarketConclusion) => promptsOf(market).map((prompt) => ({ id: promptId(prompt.text), kind: prompt.kind, text: prompt.text }));

function input(over: Partial<HealthInput> = {}): HealthInput {
  return {
    market: MARKET,
    ownNames: ["plausible"],
    asked: [],
    generated: promptsOf(MARKET),
    samples: [sample(true), sample(false), sample(false)],
    at: AT,
    ...over,
  };
}
const failed = (over: Partial<HealthInput> = {}) => failingChecks(checkHealth(input(over))).map((result) => result.check);

describe("the four checks, each passing and failing", () => {
  it("a pass with clean volumes, current prompts, a searched term and a stated sample is healthy", () => {
    const health = checkHealth(input());
    expect(health.checks.map((result) => [result.check, result.pass])).toEqual([
      ["brand_volume", true],
      ["prompt_rivals", true],
      ["market_terms", true],
      ["mention_rate", true],
      ["serp_timeouts", true],
    ]);
    expect(health.checks[3]!.detail).toBe("1 of 3 answers, 6–79%");
    // What the row keeps reads back as it was written.
    expect(parseHealth(JSON.parse(JSON.stringify(health)))).toEqual(health);
    expect(failingChecks(parseHealth(null))).toEqual([]);
  });

  it("brand_volume fails where a rival is stored at more than its own keywords hold", () => {
    const rivals = MARKET.rivals.map((rival) => (rival.name === "Fathom" ? { ...rival, volume: 49500 } : rival));
    const health = checkHealth(input({ market: { ...MARKET, rivals } }));
    expect(failingChecks(health)).toMatchObject([{ check: "brand_volume", items: ['Fathom: stored 49500, "fathom analytics" has 1300'] }]);
  });

  it("prompt_rivals fails where a prompt names a rival the market no longer holds", () => {
    const before = { ...MARKET, rivals: [{ domain: "pirsch.io", name: "Pirsch", basis: "ranks" as const, reason: "" }, ...MARKET.rivals.slice(0, 2)] };
    expect(failed({ asked: asked(MARKET) })).toEqual([]);
    const health = checkHealth(input({ asked: asked(before) }));
    expect(failingChecks(health).map((result) => result.check)).toEqual(["prompt_rivals"]);
    expect(failingChecks(health)[0]!.items.every((text) => text.includes("Pirsch") || text.includes("Matomo") || text.includes("Fathom"))).toBe(true);
    expect(failingChecks(health)[0]!.items.some((text) => text.includes("Pirsch"))).toBe(true);
  });

  it("market_terms fails where no term is searched, or the only searched one means something else", () => {
    expect(failed({ market: { ...MARKET, terms: [{ term: "cookieless counting", volume: 0 }] } })).toEqual(["market_terms"]);
    expect(failed({ market: { ...MARKET, terms: [{ term: "analytics", volume: 90000, polluted: true }] } })).toEqual(["market_terms"]);
  });

  it("mention_rate fails where a pass that asks the prompts read no answer; a pass that asks none states none", () => {
    expect(failed({ samples: [] })).toEqual(["mention_rate"]);
    expect(failed({ samples: [{ ...sample(true), kind: "branded" }] })).toEqual(["mention_rate"]);
    expect(failed({ samples: null })).toEqual([]);
  });
});

describe("D63 (issue 1298): serp_timeouts", () => {
  it("fails a pass that lost more than a fifth of its SERP reads to the clock, and no pass at a fifth or under", () => {
    expect(failed({ serp: { reads: 12, timeouts: 3 } })).toEqual(["serp_timeouts"]);
    expect(failed({ serp: { reads: 10, timeouts: 2 } })).toEqual([]);
    expect(failed({ serp: { reads: 12, timeouts: 0 } })).toEqual([]);
    expect(failingChecks(checkHealth(input({ serp: { reads: 12, timeouts: 3 } })))[0]).toMatchObject({
      detail: "3 of 12 SERP reads timed out",
      items: ["3 of 12 SERP reads timed out"],
    });
  });

  it("a pass that made no read, or whose reads could not be counted, is not called unhealthy", () => {
    expect(failed({ serp: { reads: 0, timeouts: 0 } })).toEqual([]);
    expect(failed({ serp: null })).toEqual([]);
  });

  it("the dry run: production's 08:00 UTC hour of 2026-10-07, 7 of 9 reads timed out, fails", () => {
    const health = checkHealth(input({ serp: { reads: 9, timeouts: 7 } }));
    expect(failingChecks(health).map((result) => [result.check, result.detail])).toEqual([["serp_timeouts", "7 of 9 SERP reads timed out"]]);
    // 2026-10-03's whole day, 1 of 16, would not.
    expect(failed({ serp: { reads: 16, timeouts: 1 } })).toEqual([]);
  });
});

describe("the dry run on scan 17f5bbff's stored rows", () => {
  const stored = JSON.parse(readFileSync("tests/market/fixtures/reachkit-scan-17f5bbff.json", "utf8")) as {
    siteName: string;
    founderBuyers: string;
    market: unknown;
    trackedPrompts: unknown;
    rows: { staleComparison: string; retarget: string };
    pass: { unbrandedAnswers: number; unbrandedMentions: number };
  };
  const market = parseStoredMarket(stored.market).current!;
  const set = parsePromptSet(stored.trackedPrompts);
  const samples = Array.from({ length: stored.pass.unbrandedAnswers }, (_, i) => sample(i < stored.pass.unbrandedMentions));
  const run = (m: MarketConclusion) =>
    checkHealth({
      market: m,
      ownNames: ["reachkit"],
      asked: set.prompts,
      generated: generatePrompts(spokenMarket(m, stored.founderBuyers), stored.siteName),
      samples,
      at: AT,
    });

  it("reports the failures the pass had: Brandi's polluted volume and the prompts naming old rivals", () => {
    const health = run(market);
    expect(health.checks.map((result) => [result.check, result.pass])).toEqual([
      ["brand_volume", false],
      ["prompt_rivals", false],
      ["market_terms", true],
      ["mention_rate", true],
      ["serp_timeouts", true],
    ]);
    const [volume, prompts, terms, rate] = health.checks;
    expect(volume!.items).toEqual(['Brandi: stored 22200, "brandi ai" has 260']);
    // Five, as the stored report holds them: the four comparisons and the
    // branded prompt that named AEO Engine, MaxAEO or Meltwater.
    expect(prompts!.detail).toBe("5 of 25 prompts name a rival that is not current");
    expect(prompts!.items.every((text) => /AEO Engine|MaxAEO|Meltwater/.test(text))).toBe(true);
    expect(terms!.detail).toBe('4 searched terms; "generative engine optimization" has 4400');
    expect(rate!.detail).toBe("0 of 88 answers, 0–4%");
  });

  it("the same market after issue 1285's fixes fails only on the prompts that pass asked", () => {
    const fixed = { ...market, rivals: byDemand(market.rivals, market.demand!) };
    expect(failingChecks(run(fixed)).map((result) => result.check)).toEqual(["prompt_rivals"]);
  });

  it("D59: the prune dismisses \"aeo engine alternatives\" and leaves the current rivals' topics and the retarget", () => {
    const a = { market, own: ["reachkit"] };
    expect(noLongerRelevant(stored.rows.staleComparison, a)).toBe("former_rival");
    expect(noLongerRelevant("reachkit vs maxaeo", a)).toBe("former_rival");
    expect(noLongerRelevant("best seo content writing tools", a)).toBe("not_our_market");
    for (const kept of ["profound alternatives", "otterly alternatives", "brandi ai pricing", "geo vs seo", stored.rows.retarget]) {
      expect(noLongerRelevant(kept, a)).toBeNull();
    }
    // Where the brands' volumes were never read, nobody is a former rival.
    expect(noLongerRelevant(stored.rows.staleComparison, { market: { ...market, demand: undefined }, own: ["reachkit"] })).toBeNull();
  });
});
