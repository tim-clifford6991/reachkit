// tests/generate/pipeline/pack.test.ts — SPEC §7 (D41 stage 2): the context
// pack is held against its template's *pack must hold* line in code, and a
// pack short of it names what is missing.
import "../env";
import { describe, expect, it } from "vitest";
import { buildPack, missingFrom, packAdds, questionsHeld, readPack, topicWords, type PackInputs } from "../../../src/lib/generate/pipeline/pack";
import { marketSearches, writingMarket, type WritingMarket } from "../../../src/lib/generate/voice/market";
import { parseStoredMarket } from "../../../src/lib/market/infer/stored";
import type { PromptProfile } from "../../../src/lib/generate/voice/profile-block";
import type { StoredReport } from "../../../src/lib/scan/report";
import { AT, FACTS, GROUNDED, opportunity, report } from "../fixtures";
import stored from "./fixtures/capped-comparison.json";

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

  it("issue 1393: a sign-in, account, checkout or legal address is never a source, a page or a link", () => {
    const from = (url: string) => ({ ...claimOf("rival.example"), url, kind: "rival_features" as const });
    const pack = buildPack(
      inputs({
        facts: [...FACTS, { fact: { ...GROUNDED, url: "https://example.com/signin" }, sourceText: GROUNDED.passage }],
        research: {
          ...RESEARCHED,
          facts: [...RESEARCHED.facts, from("https://rival.example/login"), from("https://rival.example/legal/terms"), from("https://rival.example/checkout")],
        },
        sitePages: [
          { title: "Sign in", question: null, url: "https://example.com/account/signin", kind: null, status: "published" },
          { title: "Pricing", question: null, url: "https://example.com/pricing", kind: null, status: "published" },
        ],
        links: [
          { source: "known", url: "https://example.com/signin", label: "Sign in" },
          { source: "known", url: "https://example.com/pricing", label: "Pricing" },
        ],
      })
    );
    const addresses = [...pack.facts, ...pack.claims, ...pack.pages, ...pack.links].map((each) => each.url);
    expect(addresses.filter((url) => /signin|login|legal|checkout/.test(url ?? ""))).toEqual([]);
    expect(pack.pages.map((page) => page.title)).toEqual(["Pricing"]);
    expect(pack.links.map((link) => link.label)).toEqual(["Pricing"]);
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
  /** What the research step read buyers asking (D61). */
  const asked = (peopleAlsoAsk: string[], related: { search: string; volume: number }[] = []) => ({ peopleAlsoAsk, related });

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
    const stored = reportWith([["How much does Other cost?", "other cost"]]);
    // The last names a rival the founder's own choice left out: nothing was read for it.
    const people = asked(["How does Rival Board compare with Other for project management?", "What are the best alternatives to Rival Board?", "How does Rival Board compare with Dropped?"]);
    const features = { ...claimOf("other.example"), kind: "rival_features" as const, passage: "Other syncs boards with calendars." };
    const read = (facts: (typeof features | ReturnType<typeof claimOf>)[]) => qa({ report: stored, research: { facts, products: [], asked: people } }).questions;
    expect(read([claimOf("rival.example")])).toEqual(["What are the best alternatives to Rival Board?"]);
    expect(read([claimOf("rival.example"), features])).toEqual([
      "How does Rival Board compare with Other for project management?",
      "What are the best alternatives to Rival Board?",
    ]);
    expect(read([claimOf("rival.example"), claimOf("other.example")])).toHaveLength(3);
  });

  it("a question no fact answers is dropped, and fewer than five leaves the pack short (D26 takes the day on)", () => {
    const people = asked(["Which task boards suit a small team?", "Which project management software has an offline mode for field crews?"]);
    const pack = qa({ report: reportWith([]), research: { facts: [], products: [], asked: people } });
    expect(pack.questions).toEqual(["Which task boards suit a small team?"]);
    expect(pack.missing).toContain("buyer_questions");
  });

  it("every new page's pack holds what buyers ask, for its headings, with its voice; an update keeps its live headings (issue 1390)", () => {
    const people = asked(["Do small teams need project boards?", "Which project management software has an offline mode for field crews?"]);
    const read = { report: reportWith([]), research: { facts: [], products: [], asked: people } };
    const howTo = qa({ ...read, type: "how_to" });
    expect(howTo.questions).toEqual(["Do small teams need project boards?"]);
    expect(howTo.voice).toEqual({ voice: "ours", person: "we", chosen: "automatic" });
    expect(qa({ ...read, type: "how_to", writingVoice: "guide" }).voice).toMatchObject({ voice: "guide", chosen: "customer" });
    expect(qa({ ...read, type: "update" }).questions).toEqual([]);
  });

  it("questions come from People also ask, related searches with a volume and measured questions; a tracked prompt is never one (D61)", () => {
    const stored = reportWith(
      [["Which task boards suit a small team?", "task boards for small teams"]],
      // Both are answerable from the pack, and neither is asked on the page.
      ["Which project board tools work on a small budget?", "Which task boards suit a small team?"]
    );
    // Google's list is not held to the market, and a bare name asks nothing.
    const people = asked(
      ["Do small teams need project boards?", "What is the 30% rule for small teams?"],
      [{ search: "how to plan team projects", volume: 90 }, { search: "project boards", volume: 9000 }]
    );
    expect(qa({ report: stored, research: { facts: [], products: [], asked: people } }).questions).toEqual([
      "Do small teams need project boards?",
      "How do I plan team projects?",
    ]);
  });

  it("one question a prompt template is kept, and of two that would make headings alike the first is (D61)", () => {
    const people = asked([
      "Which project board tools work on a small budget?",
      "Which team board tools suit a team of one?",
      "How do small teams run projects on boards day to day?",
      "How do small teams run projects on boards in practice?",
      "Is a task board enough for a small team?",
    ]);
    expect(qa({ report: reportWith([]), research: { facts: [], products: [], asked: people } }).questions).toEqual([
      "Which project board tools work on a small budget?",
      "How do small teams run projects on boards day to day?",
      "Is a task board enough for a small team?",
    ]);
  });

  it("the pack says when a thin SERP has borrowed enough: a Q&A short of five has not, and a comparison asks for none (D62)", () => {
    const own = ["Which task boards suit a small team?", "What is the 30% rule for small teams?"];
    // What the market's searched terms' SERPs added: one is off the market
    // and one repeats a heading, so the filters leave four of the six.
    const borrowed = [
      "Do small teams need project boards?",
      "How do small teams run projects on boards day to day?",
      "How do small teams run projects on boards in practice?",
      "What are the big 3 AI tools?",
      "Is a task board enough for a small team?",
      "Can a team run a project on a task board?",
    ];
    const held = (peopleAlsoAsk: string[]) => questionsHeld(qa({ report: reportWith([]), research: { facts: [], products: [], asked: asked(peopleAlsoAsk) } }));
    expect(held(own)).toEqual({ kept: 1, enough: false });
    expect(held([...own, ...borrowed.slice(0, 4)])).toEqual({ kept: 3, enough: false });
    expect(held([...own, ...borrowed])).toEqual({ kept: 5, enough: true });
    expect(questionsHeld(buildPack(inputs()))).toEqual({ kept: 0, enough: true });
    // The terms are read in the market's own order: its search term, then
    // its other searched terms; a site with no concluded market has none.
    expect(marketSearches(MARKET)).toEqual(["project management software", "task boards"]);
    expect(marketSearches({ ...MARKET, from: "report", market: null })).toEqual([]);
  });

  it("the knowledge base's own recorded questions are not a source", () => {
    const profile = { ...PROFILE, knowledge: { ...PROFILE.knowledge!, questions: [{ text: "What to do next", from: "https://example.com/" }] } };
    expect(qa({ report: reportWith([]), profile }).questions).toEqual([]);
  });
});

describe("issue 1477: a comparison over D52's cap, written as a Q&A, is read on its market", () => {
  // reachkit.app, 17 October 07:00Z: every ready topic was a comparison over
  // the cap, each was written as a Q&A, and both packs stopped on
  // `buyer_questions,facts_on_topic` — from the rows stored for them.
  const rivals = stored.market.rivals.map((rival) => rival.domain);
  const market = writingMarket({ site: { category: stored.market.category, competitors: rivals, stored: parseStoredMarket({ current: stored.market }) }, reportCategory: "" });
  const capped = (target: "peec ai alternatives" | "profound vs otterly", asked: { peopleAlsoAsk: string[]; related: { search: string; volume: number }[] }) =>
    buildPack({
      ...inputs(),
      type: "qa",
      opportunity: opportunity({ targetQuery: target, targetRef: target, title: target, family: "earn" }),
      site: { businessName: "ReachKit", domain: "reachkit.app", doNotClaim: [], rivals },
      category: market.category,
      market: { from: "site", ...market.market },
      writingFor: market,
      profile: { job: stored.job, products: [], audience: [], promises: stored.promises, vocabulary: [], knowledge: stored.knowledge as PromptProfile["knowledge"] },
      facts: stored.facts.map((passage) => ({ fact: { ...GROUNDED, passage, url: "https://reachkit.app/" }, sourceText: passage })),
      research: { facts: stored.claims[target].map((claim) => ({ ...claim, title: claim.product, readAt: AT })) as never, products: [], asked },
    });
  const borrowed = stored.asked["peec ai alternatives"];
  const own = stored.asked["profound vs otterly"];

  it("its facts are on the topic: a rival's name is not a word the business's own facts can state", () => {
    expect(capped("peec ai alternatives", borrowed).missing).not.toContain("facts_on_topic");
    expect(capped("profound vs otterly", own).missing).not.toContain("facts_on_topic");
  });

  it("with the market's borrowed questions it holds five or more, each answered from the pack, and is written", () => {
    const pack = capped("profound vs otterly", { peopleAlsoAsk: [...own.peopleAlsoAsk, ...borrowed.peopleAlsoAsk], related: [...own.related, ...borrowed.related] });
    expect(pack.missing).toEqual([]);
    expect(pack.questions).toEqual(expect.arrayContaining(["What kind of company is profound?", "Which search engine has AI?"]));
    expect(pack.questions.length).toBeGreaterThanOrEqual(5);
    // A topic whose own SERP asked nothing is still short, and says so: the
    // day goes on to the next topic (`tests/jobs/draft-rest.test.ts`).
    expect(capped("peec ai alternatives", borrowed).missing).toEqual(["buyer_questions"]);
  });

  it("a plural is the word it is plural of, for every kind of business", () => {
    // The panel's kinds (docs/walk/panel/sites.json): software, local
    // service, shop, hospitality, professional services, creator.
    const pairs = [["engines", "engine"], ["services", "service"], ["prices", "price"], ["places", "place"], ["practices", "practice"], ["courses", "course"], ["dishes", "dish"], ["boxes", "box"], ["categories", "category"]];
    for (const [plural, word] of pairs) expect([...topicWords(plural!)]).toEqual([...topicWords(word!)]);
  });

  it("a local service's rivals-only comparison is read on its category and job, not its rivals' names", () => {
    const pack = buildPack({
      ...inputs(),
      type: "qa",
      opportunity: opportunity({ targetQuery: "roto-rooter vs mr rooter", targetRef: "roto-rooter-vs-mr-rooter", title: null, family: "write" }),
      site: { businessName: "Dale's Drains", domain: "dalesdrains.example", doNotClaim: [], rivals: ["rotorooter.com", "mrrooter.com"] },
      category: "drain cleaning",
      market: { from: "site", category: "drain cleaning", job: "Clear blocked drains and sewer lines", rivals: [{ name: "Roto-Rooter", domain: "rotorooter.com" }, { name: "Mr. Rooter", domain: "mrrooter.com" }] },
      profile: null,
      facts: ["We clear blocked drains the same day.", "Every drain job is quoted before we start.", "Sewer camera inspection is $95.", "We have cleared drains in Leeds since 2009.", "Our vans carry a jetter on every call."].map((passage) => ({ fact: { ...GROUNDED, passage, url: "https://dalesdrains.example/" }, sourceText: passage })),
    });
    expect(pack.missing).not.toContain("facts_on_topic");
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
