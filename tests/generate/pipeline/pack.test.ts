// tests/generate/pipeline/pack.test.ts — SPEC §7 (D41 stage 2): the context
// pack is held against its template's *pack must hold* line in code, and a
// pack short of it names what is missing.
import "../env";
import { describe, expect, it } from "vitest";
import { buildPack, missingFrom, packAdds, readPack, type PackInputs } from "../../../src/lib/generate/pipeline/pack";
import type { PromptProfile } from "../../../src/lib/generate/voice/profile-block";
import { AT, FACTS, GROUNDED, opportunity, report } from "../fixtures";

const PROFILE: PromptProfile = {
  job: "plans projects for small teams",
  products: ["Acme"],
  audience: ["small teams"],
  promises: [],
  vocabulary: [],
  knowledge: {
    offerings: [{ name: "Acme", features: ["boards"], prices: ["$12 a seat"], uses: [], from: "https://example.com/" }],
    audience: [],
    problems: [],
    proof: [],
    questions: [],
    integrations: [],
    places: [],
    differentiators: [{ text: "One flat fee for the whole team.", from: "https://example.com/pricing", rival: null }],
    byline: null,
  },
};

const rival = (domain: string) => ({ domain, pages: [`https://${domain}/pricing`] });
/** What a rival's own pricing page was read to say. */
const claimOf = (domain: string) => ({
  url: `https://${domain}/pricing`,
  title: domain,
  readAt: AT,
  passage: `Plans at ${domain} start at $20 a month.`,
  kind: "rival_pricing" as const,
  product: domain,
});
const RESEARCHED = { facts: [claimOf("rival.example"), claimOf("other.example")], products: [rival("rival.example"), rival("other.example")] };

function inputs(over: Partial<PackInputs> = {}): PackInputs {
  return {
    type: "listicle",
    opportunity: opportunity(),
    site: { businessName: "Acme", domain: "example.com", doNotClaim: ["HIPAA compliant"], rivals: ["rival.example"] },
    category: "project management software",
    byline: null,
    voice: null,
    profile: PROFILE,
    facts: FACTS,
    research: RESEARCHED,
    report: report(),
    sitePages: [],
    links: [],
    now: AT,
    ...over,
  };
}

describe("a pack is held against what its template must hold", () => {
  it("a comparison with two researched rivals, the business's price and a point of difference is short of nothing", () => {
    const pack = buildPack(inputs());
    expect(pack.missing).toEqual([]);
    expect(pack).toMatchObject({ type: "listicle", neverClaim: ["HIPAA compliant"], facts: [{ passage: GROUNDED.passage }] });
  });

  it("with fewer than two rivals that have a fact it is written as a Q&A, from the same reads (D47)", () => {
    const one = buildPack(inputs({ research: { facts: [claimOf("rival.example")], products: [rival("rival.example")] } }));
    expect(one.type).toBe("qa");
    // A rival that was read and yielded nothing is not an option either.
    expect(buildPack(inputs({ research: { ...RESEARCHED, facts: [claimOf("rival.example")] } })).type).toBe("qa");
  });

  it("a business with no knowledge base is missing its point of difference too; its price is read off its own page", () => {
    const bare = buildPack(inputs({ profile: null }));
    // No price of its own is no row of its own, so no table either — and
    // that stops the page rather than turning it into a Q&A.
    expect(bare).toMatchObject({ type: "listicle", missing: ["options", "own_price", "difference"] });
    // The same answer whenever it is asked of the stored pack.
    expect(missingFrom(bare)).toEqual(bare.missing);
    const priced = { fact: { ...GROUNDED, passage: "The starter plan costs $12 a seat." }, sourceText: "The starter plan costs $12 a seat." };
    expect(buildPack(inputs({ profile: null, facts: [priced] })).missing).toEqual(["difference"]);
  });
});

describe("what a new page adds is counted over the pack (D12)", () => {
  const facts = ["One.", "Two.", "Three."].map((word) => ({ passage: `${word} A fact of the business's own.`, url: GROUNDED.url, readAt: AT.toISOString() }));

  it("a fact the top results already state adds nothing, and a new page short of three is short", () => {
    const topResults = [{ url: "https://top.example/", text: `As everyone says: ${facts[0]!.passage}` }];
    expect(packAdds({ facts, claims: [], topResults: [], newPage: true })).toMatchObject({ short: false });
    const restated = packAdds({ facts, claims: [], topResults, newPage: true });
    expect(restated.claims.map((claim) => claim.claim)).toEqual([facts[1]!.passage, facts[2]!.passage]);
    expect(restated.short).toBe(true);
    // An update is held to no bar of its own.
    expect(packAdds({ facts, claims: [], topResults, newPage: false }).short).toBe(false);
  });
});

describe("the pack is read back off the row it was stored with", () => {
  it("a stored pack is returned, and a row written before the pack reads as none", () => {
    const pack = buildPack(inputs());
    expect(readPack({ pack: JSON.parse(JSON.stringify(pack)) })?.type).toBe("listicle");
    expect(readPack({ description: "An older row." })).toBeNull();
    expect(readPack(null)).toBeNull();
  });
});
