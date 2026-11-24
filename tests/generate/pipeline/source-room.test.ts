// SPEC §7 *Two pools of facts*: in production a list of alternatives cited 24 of 24 claims off the rivals' own pages, 0 independent.
import { describe, expect, it } from "vitest";
import type { MarketFact } from "../../../src/lib/generate/pipeline/research";
import { byTier, citedIndependent, credibleAt, tiered, withRoom } from "../../../src/lib/generate/pipeline/source-tier";

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

describe("a directory and a vendor's blog are never original for a method word elsewhere on the page", () => {
  it("tiers the directory review, the reported finding second-hand, undated and other, and counts no cited independent site", () => {
    const dir = "https://slashdot.org/software/comparison/Otterly.AI-vs-Profound", blog = "https://www.scalenut.com/blogs/trends-in-generative-engine-optimization";
    const stars = "OtterlyAI 4.5 out of 5 stars", ahrefs = "In its own brand analysis, Ahrefs reported that up to 89% of AI answers rely on third-party pages.";
    const read = [{ url: dir, text: `Otterly AI vs Profound. ${stars}. ${"x ".repeat(400)}Our methodology` }, { url: blog, text: `${ahrefs} ${"y ".repeat(400)}Research methodology` }];
    const facts = tiered([{ ...fact(dir, 0), passage: stars }, { ...fact(blog, 0), passage: ahrefs, publishedAt: "2026-10-19", ageAt: "2026-10-19" }], { rivals: [], products: rivals, names: [{ domain: "otterly.ai", name: "Otterly AI" }, { domain: "tryprofound.com", name: "Profound" }], language: "en", pages: read, capped: new Set() });
    expect(facts.map((each) => [each.tier, each.secondHand, each.ageAt, each.publishedAt])).toEqual([["review", undefined, undefined, undefined], ["other", true, undefined, undefined]]);
    expect(citedIndependent(facts, (url) => url === blog)).toBe(0);
  });
});

describe("a study page is credible by its host, never by a tier one passage earned", () => {
  it("passes a publication and not a vendor's blog, and tiers the publication's own claim publication", () => {
    const press = "https://searchengineland.com/ai-search-study-1234";
    expect([press, "https://www.scalenut.com/blogs/trends-in-generative-engine-optimization"].map((url) => credibleAt(url, "en"))).toEqual([true, false]);
    expect(tiered([fact(press, 0)], { rivals, products: rivals, language: "en", pages: [{ url: press, text: "claim 0" }], capped: new Set() })[0]?.tier).toBe("publication");
  });
});
