// SPEC §6 (owner ruling B5 and the SEO review's C4, 2026-10-19): a
// competitor's page that an AI answer links becomes a topic, read from the
// customer panel's stored answers and results pages
// (`scripts/panel/evidence/`), through the same fit, typed and readiness
// gates as any proposal. Either competitor list counts: the search
// competitors the report derives and the business competitors in force. 0¢.
import "../env";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeCost } from "../cost";
import { toolUseMessage } from "../../llm/fixtures";
import { readPromptAnswer } from "../../../src/lib/market/prompts/answer";
import type { MarketConclusion } from "../../../src/lib/market/infer/types";
import { measured } from "../../../src/lib/measure/measured";
import { contentTypeOf } from "../../../src/lib/opportunities/content-type";
import { assessReadiness } from "../../../src/lib/opportunities/readiness";
import { readOpportunity, setOpportunityStore } from "../../../src/lib/opportunities/store";
import type { PromptAnswer } from "../../../src/lib/scan/report";
import { memoryStore, newMemoryState, type MemoryState } from "../memory-store";
import { AT, PROFILE, SCAN_ID, SITE_ID, question, reportOf, serp, smallCounts } from "../fixtures";
import { storedSerps } from "../../golden/plan/panel";

const { createMock } = vi.hoisted(() => ({ createMock: vi.fn() }));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = { create: createMock };
  },
}));

const { deriveOpportunities } = await import("../../../src/lib/opportunities/derive");
const { FIT_CALL_SITE } = await import("../../../src/lib/opportunities/derive/fit");
const { BUYER_SEARCHES_CALL_SITE, TYPED_CALL_SITE } = await import("../../../src/lib/opportunities/derive/buyer-searches");
const { citedTopics } = await import("../../../src/lib/opportunities/derive/topics");

/** The stored answer of a panel site's passes that cited `url`, as the pass reads it. */
function storedAnswer(domain: string, url: string): PromptAnswer {
  const rows: { source: string; payload: unknown }[] = JSON.parse(readFileSync(`scripts/panel/evidence/${domain}.json`, "utf8"));
  const answer = rows
    .filter((row) => /llm_scraper|ai_mode/u.test(row.source) && Array.isArray(row.payload))
    .map((row) => (row.payload as { text: string; citedDomains: string[]; citedUrls?: string[] }[])[0]!)
    .find((each) => each.citedUrls?.includes(url));
  if (answer === undefined) throw new Error(`no stored answer of ${domain} cites ${url}`);
  const reading = readPromptAnswer({ text: answer.text, citedDomains: answer.citedDomains, citedUrls: answer.citedUrls ?? [], ownDomain: domain, siteName: domain, rivals: [] });
  return { promptId: "p1", engine: "chatgpt", run: 1, named: reading.named, linked: reading.linked, ownUrls: reading.ownUrls, rivals: [], cited: reading.cited };
}

const market = (over: Partial<MarketConclusion>): MarketConclusion => ({
  buyer: "",
  job: "",
  category: "",
  synonyms: [],
  differentiators: [],
  notOurMarket: [],
  categoryReason: "",
  rivals: [],
  ...over,
});

const PLUMBER = market({
  buyer: "homeowners in Austin needing plumbing work",
  job: "repair, maintain, and install plumbing systems",
  category: "plumbing repair and maintenance",
  kind: "local-service",
  serves: { name: "Austin", region: "Texas" },
  rivals: [{ domain: "rotorooter.com", name: "Roto-Rooter", basis: "ranks", reason: "", volume: 0 }],
});

const SCHEDULER = market({
  buyer: "teams that need to schedule meetings",
  job: "find a time to meet with multiple people",
  category: "meeting scheduling software",
  kind: "software",
  serves: null,
});

let state: MemoryState;

beforeEach(() => {
  createMock.mockReset();
  state = newMemoryState({ profile: PROFILE, now: AT });
  setOpportunityStore(memoryStore(state));
});

afterEach(() => setOpportunityStore(null));

/** `wanted` is typed by a buyer and judged at fit 3; every other search at 1. */
function judge(wanted: string): void {
  createMock.mockImplementation(async (request: { messages: { content: string }[]; tools?: { name: string }[] }) => {
    const input = JSON.parse(request.messages[0]!.content) as { searches?: { i: number; search: string }[] };
    const site = request.tools?.[0]?.name;
    const searches = input.searches ?? [];
    if (site === BUYER_SEARCHES_CALL_SITE) return toolUseMessage({ problems: [], solutions: [] }, 300, 100, BUYER_SEARCHES_CALL_SITE);
    if (site === TYPED_CALL_SITE) return toolUseMessage({ typed: searches.filter(({ search }) => search === wanted).map(({ i }) => i) }, 300, 50, TYPED_CALL_SITE);
    if (site !== FIT_CALL_SITE) throw new Error("no model for this call");
    const scores = searches.map(({ i, search }) => ({ i, fit: search === wanted ? 3 : 1, title: `The angle for ${search}` }));
    return toolUseMessage({ scores, strongest: scores.filter((score) => score.fit === 3).map((score) => score.i) }, 900, 300, FIT_CALL_SITE);
  });
}

describe("a competitor's page that AI links becomes a topic, for a local business and a SaaS", () => {
  it.each([
    // A business competitor: the plumber's market names Roto-Rooter.
    { domain: "austinplumbery.com", url: "https://www.rotorooter.com/austin/emergency-plumber/?utm_source=chatgpt.com", rival: "rotorooter.com", topic: "emergency plumber", held: PLUMBER, searchRivals: [] as string[] },
    // A search competitor only: the report's results pages name Calendly, the market does not.
    { domain: "savvycal.com", url: "https://calendly.com/scheduling/meeting-polls", rival: "calendly.com", topic: "meeting polls", held: SCHEDULER, searchRivals: ["calendly.com"] },
  ])("$domain: the page $url → $topic", async ({ domain, url, rival, topic, held, searchRivals }) => {
    judge(topic);
    const serps = storedSerps(domain, "every");
    state.asked = [...serps].map(([term, read]) => ({ term, peopleAlsoAsk: [], related: [], at: read.at }));
    const report = reportOf(
      { questions: [question()], serps: [serp()] },
      {
        rivals: measured(searchRivals.map((d) => ({ domain: d, top10Appearances: 1, aiCitations: 1, score: 3 })), AT),
        prompts: { siteName: domain, asked: [{ id: "p1", kind: "category", text: `Who is the best ${topic}?` }], asks: 1, answers: [storedAnswer(domain, url)] },
      }
    );
    const { ctx } = fakeCost();
    await deriveOpportunities(ctx, { siteId: SITE_ID, scanId: SCAN_ID, report, ownRanked: measured(0, AT), rankedCounts: smallCounts(), market: held });

    const row = state.rows.find((each) => each.target_query === topic);
    expect(row?.evidence).toMatchObject({ family: "write", rival: { domain: rival, url: { kind: "measured", value: url.replace("?utm_source=chatgpt.com", "") } } });
  });

  it("the plumber's linked Roto-Rooter page is written as an offering page, by the results page bought for its search", async () => {
    judge("emergency plumber");
    const serps = storedSerps("austinplumbery.com", "every");
    state.asked = [...serps].map(([term, read]) => ({ term, peopleAlsoAsk: [], related: [], at: read.at }));
    state.market = PLUMBER;
    const report = reportOf(
      { questions: [question()], serps: [serp()] },
      { prompts: { siteName: "Austin Plumbery", asked: [{ id: "p1", kind: "category", text: "Who is the best emergency plumber in Austin?" }], asks: 1, answers: [storedAnswer("austinplumbery.com", "https://www.rotorooter.com/austin/emergency-plumber/?utm_source=chatgpt.com")] } }
    );
    const { ctx } = fakeCost();
    await deriveOpportunities(ctx, { siteId: SITE_ID, scanId: SCAN_ID, report, ownRanked: measured(0, AT), rankedCounts: smallCounts(), market: PLUMBER });
    const fresh = new Map([...serps].map(([term, read]) => [term, { ...read, at: AT }]));
    setOpportunityStore({ ...memoryStore(state), topTenRows: async () => fresh });
    await assessReadiness(SITE_ID, { at: AT, now: AT });

    const row = state.rows.find((each) => each.target_query === "emergency plumber");
    expect(row && contentTypeOf(readOpportunity(row))).toBe("offering");
  });
});

describe("which linked pages propose a topic", () => {
  const cited = (answers: string[][], competitors: string[], searched: string[] = []) =>
    citedTopics({ answers: answers.map((pages) => ({ cited: pages })), competitors, searched, language: "en" }).map((topic) => topic.query);

  it("a page on neither competitor list proposes nothing, and a stored search holding every word of the page stands in for it", () => {
    expect(cited([["https://zapier.com/blog/best-meeting-scheduler-apps/"]], ["calendly.com"])).toEqual([]);
    expect(cited([["https://www.rotorooter.com/austin/commercial-plumbing/"]], ["rotorooter.com"], ["commercial plumber austin", "commercial plumbing services"])).toEqual(["commercial plumbing services"]);
    expect(cited([["https://www.rotorooter.com/austin/commercial-plumbing/"]], ["rotorooter.com"])).toEqual(["commercial plumbing"]);
  });

  it("one word, a number, or the same search twice proposes one topic or none", () => {
    expect(cited([["https://www.rotorooter.com/austin/"], ["https://www.rotorooter.com/plumbing/2024-prices/"]], ["rotorooter.com"])).toEqual([]);
    expect(cited([["https://www.rotorooter.com/austin/emergency-plumber/"], ["https://www.rotorooter.com/ashburnva/emergency-plumber/"]], ["rotorooter.com"])).toEqual(["emergency plumber"]);
  });
});
