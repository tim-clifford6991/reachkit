// SPEC §6 (issue 1520, the SEO master's gap review of 2026-10-18, B3; owner
// 2026-10-18: "follow seo master") — a comparison, alternatives or composed
// search is a topic only on observed demand. The customer panel's stored
// runs and reachkit.app's rows of 18 October are the fixtures.
import "./env";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { MarketConclusion } from "../../src/lib/market/infer/types";
import { readPromptAnswer } from "../../src/lib/market/prompts/answer";
import { measured } from "../../src/lib/measure/measured";
import { comparisonBrands, composedSearch, proposedTopics, type MeasuredAnswer } from "../../src/lib/opportunities/derive/topics";
import { liveTopicFailure, type LiveTopicPage, type LiveTopicSite } from "../../src/lib/opportunities/live-topics";
import { eligible, type ReadinessContext } from "../../src/lib/opportunities/readiness";
import { readOpportunity, type OpportunityRow } from "../../src/lib/opportunities/store";
import type { Opportunity } from "../../src/lib/opportunities/types";
import stored from "./fixtures/live-topics-1506.json";
import { AT, PROFILE, reportOf } from "./fixtures";

interface StoredSite {
  site: { domain: string };
  siteName: string | null;
  market: MarketConclusion;
  topics: { query: string; status: string; ready?: boolean | null; volume: number | null }[];
  prompts?: { kind: string; text: string }[];
}

/** One site of a stored panel run. */
function panelSite(run: string, domain: string): StoredSite {
  const sites = (JSON.parse(readFileSync(`docs/walk/panel/${run}.json`, "utf8")) as { sites: StoredSite[] }).sites;
  return sites.find((held) => held.site.domain === domain)!;
}

const brandsOf = (site: StoredSite) => {
  const read = comparisonBrands({ report: null, market: site.market });
  return { ...read, own: [...new Set([...read.own, (site.siteName ?? "").toLowerCase()])].filter((name) => name.length > 2) };
};

const CTX: ReadinessContext = {
  now: AT,
  grounded: true,
  earnGrounding: { comparison_table: true, integration_page: true, original_data_page: true },
  suppression: { clusters: new Set(), retiredUrls: new Set() },
  profile: PROFILE,
  ownRanks: () => false,
  canUpdate: () => true,
  coveredBy: () => null,
  // A first pass has no tracked prompts yet, so D60's own rule holds nothing.
  prompts: [],
};

const B = readOpportunity(stored.pages.find((page) => page.name === "B")!.row as unknown as OpportunityRow);

/** An open Write row for `query`, unmeasured, at the top fit. */
function row(query: string, over: Partial<Opportunity> = {}): Opportunity {
  return { ...B, id: query, targetQuery: query, clusterKey: null, family: "write", ...over };
}

function withVolume(value: number): Partial<Opportunity> {
  const volume = measured(value, AT);
  return { volume, evidence: { ...B.evidence, volume } as Opportunity["evidence"] };
}

describe("a rival's alternatives is ready only on observed demand (condition 1)", () => {
  const fixtures = [
    ["2026-10-09", "zunicafe.com"],
    ["2026-10-09", "austinplumbery.com"],
    ["2026-10-09", "alexander.co.uk"],
    ["2026-10-10-1374", "baeckerei-hinkel.de"],
    ["2026-10-11", "clearleft.com"],
  ] as const;

  it.each(fixtures)("panel %s, %s: no unmeasured \"{rival} alternatives\" is ready", (run, domain) => {
    const site = panelSite(run, domain);
    const alternatives = site.topics.filter((topic) => topic.status === "open" && /alternative/.test(topic.query) && topic.ready === true);
    expect(alternatives.length).toBeGreaterThan(0);
    const ctx = { ...CTX, brands: brandsOf(site) };
    expect(alternatives.map((topic) => [topic.query, eligible(row(topic.query, { type: "comparison_page" }), ctx)])).toEqual(
      alternatives.map((topic) => [topic.query, "no_intent"])
    );
  });

  const market = stored.market as unknown as MarketConclusion;
  const ctx = { ...CTX, brands: { ...comparisonBrands({ report: null, market }), own: stored.own } };
  const asked = (term: string, peopleAlsoAsk: string[], related: string[] = []) => [{ term, peopleAlsoAsk, related }];

  it("its own measured volume, or buyers seen asking it beside another search, makes it ready", () => {
    expect(eligible(row("profound alternatives"), ctx)).toBe("no_intent");
    expect(eligible(row("profound alternatives", withVolume(210)), ctx)).toBeNull();
    expect(eligible(row("profound alternatives", withVolume(0)), ctx)).toBe("no_intent");
    expect(eligible(row("profound alternatives"), { ...ctx, asked: asked("geo tools", [], ["profound alternatives"]) })).toBeNull();
    expect(eligible(row("profound alternatives"), { ...ctx, asked: asked("geo tools", ["What are the best Profound alternatives?"]) })).toBeNull();
  });

  it("a measured answer counts only where it names the rival and cites an address that holds \"alternative\"", () => {
    const answer = (over: Partial<MeasuredAnswer>): MeasuredAnswer[] => [
      { promptId: "8089172d", named: false, linked: false, rivals: ["tryprofound.com"], ...over },
    ];
    const cited = ["https://www.example.org/blog/profound-alternatives"];
    expect(eligible(row("profound alternatives"), { ...ctx, answers: answer({ alternatives: cited }) })).toBeNull();
    expect(eligible(row("profound alternatives"), { ...ctx, answers: answer({}) })).toBe("no_intent");
    expect(eligible(row("profound alternatives"), { ...ctx, answers: answer({ rivals: ["peec.ai"], alternatives: cited }) })).toBe("no_intent");
  });

  it("reads the addresses an answer cited that hold \"alternative\", in English and German", () => {
    const reading = readPromptAnswer({
      text: "Profound is one option.",
      citedDomains: ["example.org", "beispiel.de", "example.net"],
      citedUrls: [
        "https://example.org/profound-alternatives?utm_source=chatgpt.com",
        "https://beispiel.de/profound-alternativen",
        "https://example.net/pricing",
      ],
      ownDomain: "reachkit.app",
      siteName: "ReachKit",
      rivals: [{ name: "Profound", domain: "tryprofound.com" }],
    });
    expect(reading.alternatives).toEqual(["https://example.org/profound-alternatives", "https://beispiel.de/profound-alternativen"]);
  });
});

describe("a tracked prompt counts for a \"vs\" only where its measured answer names both sides (condition 2)", () => {
  const site = panelSite("2026-10-14-1423", "savvycal.com");
  const prompt = { id: "p-acuity", text: "Acuity Scheduling or Koalendar: which is the better choice for online scheduling?" };
  const ctx = { ...CTX, brands: brandsOf(site), prompts: [prompt] };
  const query = "savvycal vs acuity scheduling";

  it("a prompt that names Acuity only, answered without SavvyCal, is not demand for it", () => {
    const answers: MeasuredAnswer[] = [{ promptId: prompt.id, named: false, linked: false, rivals: ["acuityscheduling.com", "koalendar.com"] }];
    expect(eligible(row(query, { type: "comparison_page" }), { ...ctx, answers })).toBe("no_intent");
    expect(eligible(row(query, { type: "comparison_page" }), ctx)).toBe("no_intent");
  });

  it("its measured answer naming SavvyCal and Acuity is", () => {
    const answers: MeasuredAnswer[] = [{ promptId: prompt.id, named: true, linked: false, rivals: ["acuityscheduling.com"] }];
    expect(eligible(row(query, { type: "comparison_page" }), { ...ctx, answers })).toBeNull();
    // An answer to another prompt says nothing of this one.
    expect(eligible(row(query, { type: "comparison_page" }), { ...ctx, answers: [{ ...answers[0]!, promptId: "other" }] })).toBe("no_intent");
  });
});

describe("a search ReachKit composed needs the same evidence (condition 3)", () => {
  const site = panelSite("2026-10-12-1414", "wesbos.com");
  const ctx = { ...CTX, brands: brandsOf(site), composed: (query: string) => composedSearch(query, site.market) };

  it("wesbos.com: \"javascript tutorial pricing\", composed from the synonym \"JavaScript tutorials\", is not ready", () => {
    expect(eligible(row("javascript tutorial pricing", { type: "keyword_page", businessFit: 3 }), ctx)).toBe("no_intent");
    expect(eligible(row("javascript tutorial pricing", { type: "keyword_page", businessFit: 3, ...withVolume(90) }), ctx)).toBeNull();
  });

  it("a row the pass marked composed is held whatever the market says now; a search nobody composed is not judged", () => {
    const marked = row("full stack web development course pricing", { type: "keyword_page", businessFit: 3 });
    const composed = { ...marked, evidence: { ...marked.evidence, composed: true } as Opportunity["evidence"] };
    expect(eligible(marked, ctx)).toBeNull();
    expect(eligible(composed, ctx)).toBe("no_intent");
    expect(eligible(composed, { ...ctx, asked: [{ term: "web development courses", peopleAlsoAsk: [], related: ["full stack web development course pricing"] }] })).toBeNull();
  });
});

describe("a site that serves one place is never proposed a rival's alternatives without that evidence (condition 4)", () => {
  const market: MarketConclusion = {
    buyer: "Homeowners in Austin",
    job: "Get a leak fixed",
    category: "plumber",
    synonyms: [],
    differentiators: [],
    notOurMarket: [],
    categoryReason: "",
    kind: "local-service",
    serves: { name: "Austin", region: "Texas" },
    rivals: [{ domain: "radiantplumbing.com", name: "Radiant Plumbing", basis: "ranks", reason: "", searchNames: ["radiant plumbing"], volume: 1900 }],
    demand: { at: "2026-10-05T00:00:00.000Z", own: 0, brands: { "radiant plumbing": 1900 } },
  };
  const alternatives = (a: { market: MarketConclusion; seen?: { term: string; peopleAlsoAsk: string[]; related: string[]; at: Date }[] }) =>
    proposedTopics({ report: reportOf({ questions: [], serps: [] }), market: a.market, taken: [], ownRanked: 0, max: 80, ...(a.seen === undefined ? {} : { seen: a.seen }) })
      .map((topic) => topic.query)
      .filter((query) => query.includes("alternative"));

  it("one place: none, unless its volume was read or buyers were seen asking it", () => {
    expect(alternatives({ market })).toEqual([]);
    const searched = { ...market, demand: { ...market.demand!, searches: { "radiant plumbing alternatives": 40 } } };
    expect(alternatives({ market: searched })).toEqual(["radiant plumbing alternatives"]);
    const seen = [{ term: "plumber austin", peopleAlsoAsk: [], related: ["radiant plumbing alternatives"], at: AT }];
    expect(alternatives({ market, seen })).toEqual(["radiant plumbing alternatives"]);
    // A business that sells everywhere is still proposed it, and readiness judges it.
    expect(alternatives({ market: { ...market, serves: null } })).toEqual(["radiant plumbing alternatives"]);
  });
});

describe("live pages are judged by the hourly recheck as today", () => {
  const market = stored.market as unknown as MarketConclusion;
  const c = stored.pages.find((page) => page.name === "C")!;
  const page: LiveTopicPage = {
    draftId: c.draft_id,
    publicationId: c.publication_id,
    hosted: true,
    liveUrl: "https://content.reachkit.app/profound-alternatives",
    opportunity: row("profound alternatives"),
    signals: { firstLive: AT, publishedAt: AT, verdicts: [], ranked: false, reads: 0 },
  };
  const site: LiveTopicSite = {
    domain: stored.domain,
    brands: { ...comparisonBrands({ report: null, market }), own: stored.own },
    prompts: stored.prompts,
    asked: [],
    business: { kind: market.kind ?? null, serves: null },
    topTen: () => null,
    open: [],
    pages: [page],
  };

  it("a live \"{rival} alternatives\" page with no observed demand fails, and one with it passes", () => {
    expect(liveTopicFailure(page, site)).toEqual({ rule: "no_demand" });
    expect(liveTopicFailure({ ...page, opportunity: row("profound alternatives", withVolume(210)) }, site)).toBeNull();
  });
});
