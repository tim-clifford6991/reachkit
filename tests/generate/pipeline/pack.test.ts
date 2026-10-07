// tests/generate/pipeline/pack.test.ts — SPEC §7 (D41 stage 2): the context
// pack is held against its template's *pack must hold* line in code, and a
// pack short of it names what is missing.
import "../env";
import { describe, expect, it } from "vitest";
import { buildPack, missingFrom, packAdds, readPack, type PackInputs } from "../../../src/lib/generate/pipeline/pack";
import type { WritingMarket } from "../../../src/lib/generate/voice/market";
import type { PromptProfile } from "../../../src/lib/generate/voice/profile-block";
import type { StoredReport } from "../../../src/lib/scan/report";
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

  it("D59: a rival's price read 31 days ago is dropped, and one read 30 days ago stands", () => {
    const daysAgo = (days: number) => new Date(AT.getTime() - days * 86_400_000);
    const old = { ...claimOf("other.example"), readAt: daysAgo(31) };
    const features = { ...claimOf("other.example"), url: "https://other.example/features", kind: "rival_features" as const, readAt: daysAgo(31), passage: "Other has boards." };
    const edge = { ...claimOf("rival.example"), readAt: daysAgo(30) };
    const pack = buildPack(inputs({ research: { facts: [edge, old, features], products: [rival("rival.example"), { domain: "other.example", pages: [old.url, features.url] }] } }));
    expect(pack.claims.map((claim) => [claim.product, claim.kind])).toEqual([
      ["rival.example", "rival_pricing"],
      ["other.example", "rival_features"],
    ]);
    // The page the old price stood on is no longer one the product is read from.
    expect(pack.products).toEqual([rival("rival.example"), { domain: "other.example", pages: [features.url] }]);
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

describe("a Q&A's questions are on the current market, each with a fact that answers it (issue 1263)", () => {
  const MARKET: WritingMarket = {
    category: "project management software",
    from: "site",
    synonyms: ["task boards"],
    unsearched: [],
    concluded: [{ name: "Dropped", domain: "dropped.example" }],
    market: {
      category: "project management software",
      buyer: null,
      job: null,
      rivals: [
        { name: "Rival Board", domain: "rival.example" },
        { name: "Other", domain: "other.example" },
      ],
      notOurMarket: [],
    },
  };
  /** A stored report with these measured questions and tracked prompts. */
  function reportWith(questions: readonly (readonly [text: string, search: string])[], prompts: readonly string[] = []): StoredReport {
    const base = report();
    if (base.questions.kind === "unmeasured") throw new Error("the fixture report measures questions");
    const like = base.questions.value[0]!;
    return {
      ...base,
      questions: {
        ...base.questions,
        value: questions.map(([text, keyword], n) => ({ ...like, id: `q${n + 1}`, text, search: { ...like.search, keyword } })),
      },
      prompts: { siteName: "Acme", asks: 0, answers: [], asked: prompts.map((text, n) => ({ id: `p${n}`, kind: "category" as const, text })) },
    };
  }
  const fact = (passage: string) => ({ fact: { ...GROUNDED, passage }, sourceText: passage });
  const BOARDS = [fact("Acme's task boards show every project a small team runs."), ...FACTS];
  const qa = (over: Partial<PackInputs>) => buildPack(inputs({ type: "qa", writingFor: MARKET, facts: BOARDS, research: { facts: [], products: [] }, ...over }));

  it("a measured question from another market's pool is left out; a site with no concluded market keeps its report's own", () => {
    const stored = reportWith([
      ["Which task boards suit a small team?", "task boards for small teams"],
      ["What SaaS SEO tool should I use?", "saas seo tool"],
      ["How much does SEO software cost?", "seo software cost"],
    ]);
    expect(qa({ report: stored }).questions).toEqual(["Which task boards suit a small team?"]);
    const lead = fact("An SEO tool for SaaS teams, from $9 a month.");
    expect(qa({ report: stored, writingFor: null, facts: [...BOARDS, lead] }).questions).toContain("What SaaS SEO tool should I use?");
  });

  it("a question naming a rival goes in only where that rival's own page yielded a claim, its pricing page for a price", () => {
    const stored = reportWith(
      [["How much does Other cost?", "other cost"]],
      // The last names a rival the founder's own choice left out: nothing was read for it.
      ["How does Rival Board compare with Other for project management?", "What are the best alternatives to Rival Board?", "How does Rival Board compare with Dropped?"]
    );
    const features = { ...claimOf("other.example"), kind: "rival_features" as const, passage: "Other syncs boards with calendars." };
    const read = (facts: (typeof features | ReturnType<typeof claimOf>)[]) => qa({ report: stored, research: { facts, products: [] } }).questions;
    expect(read([claimOf("rival.example")])).toEqual(["What are the best alternatives to Rival Board?"]);
    expect(read([claimOf("rival.example"), features])).toEqual([
      "How does Rival Board compare with Other for project management?",
      "What are the best alternatives to Rival Board?",
    ]);
    expect(read([claimOf("rival.example"), claimOf("other.example")])).toHaveLength(3);
  });

  it("a question no fact answers is dropped, and fewer than five leaves the pack short (D26 takes the day on)", () => {
    const stored = reportWith([], ["Which task boards suit a small team?", "Which project management software has an offline mode for field crews?"]);
    const pack = qa({ report: stored });
    expect(pack.questions).toEqual(["Which task boards suit a small team?"]);
    expect(pack.missing).toContain("buyer_questions");
  });

  it("the knowledge base's own recorded questions are not a source", () => {
    const profile = { ...PROFILE, knowledge: { ...PROFILE.knowledge!, questions: [{ text: "What to do next", from: "https://example.com/" }] } };
    expect(qa({ report: reportWith([]), profile }).questions).toEqual([]);
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
