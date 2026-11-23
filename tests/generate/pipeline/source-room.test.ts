// SPEC §7 *Two pools of facts*: in production a list of alternatives cited 24 of 24 claims off the rivals' own pages, 0 independent.
import { describe, expect, it } from "vitest";
import type { MarketFact } from "../../../src/lib/generate/pipeline/research";
import { byTier, tiered, withRoom } from "../../../src/lib/generate/pipeline/source-tier";

const rivals = ["otterly.ai", "peec.ai", "tryprofound.com", "tryanalyze.ai"];
const fact = (url: string, at: number, product?: string) => ({ url, passage: `claim ${at}`, kind: product === undefined ? "study" : "rival_pricing", ...(product === undefined ? {} : { product }) }) as unknown as MarketFact;
const own = rivals.flatMap((domain) => Array.from({ length: 8 }, (_, at) => fact(`https://${domain}/pricing`, at, domain)));
const review = "https://www.g2.com/compare/otterly-vs-peec", wire = "https://markets.chroniclejournal.com/article/getnews-2026-2-17-top-agencies";
const pages = [{ url: review, text: "Otterly AI and Peec AI compared by users" }, { url: wire, text: "Top agencies ranked" }];

describe("a list of alternatives keeps room for independent sources", () => {
  it("tiers a review site above the rivals, a wire last, and keeps room in the 24", () => {
    const facts = tiered([...own, fact(review, 0), fact(wire, 0)], { rivals, products: rivals, names: [{ domain: "otterly.ai", name: "Otterly AI" }, { domain: "peec.ai", name: "Peec AI" }], language: "en", pages, capped: new Set() });
    expect(facts.slice(-2).map((each) => each.tier)).toEqual(["review", "wire"]);
    const dealt = withRoom(byTier(facts), 24, 6);
    expect(dealt.filter((each) => each.tier === "vendor")).toHaveLength(23);
    expect(dealt[0]?.url).toBe(review);
  });
});
