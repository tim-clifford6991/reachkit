// SPEC §6 *Topics by business fit* (owner, 2026-09-29 and 2026-10-03; issue
// 1134): what a founder's calendar is filled from once a pass has judged fit.
import "../env";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeCost } from "../cost";
import { toolUseMessage } from "../../llm/fixtures";
import { measured } from "../../../src/lib/measure/measured";
import type { MarketConclusion } from "../../../src/lib/market/infer/types";
import { setOpportunityStore } from "../../../src/lib/opportunities/store";
import { eligible, type ReadinessContext } from "../../../src/lib/opportunities/readiness";
import type { Opportunity } from "../../../src/lib/opportunities/types";
import { memoryStore, newMemoryState, type MemoryState } from "../memory-store";
import { AT, PROFILE, SCAN_ID, SITE_ID, defaultReport, question, reportOf, search, serp, smallCounts } from "../fixtures";

/** The site's own name as a search carries it. */
const OWN = PROFILE.brandTokens[0]!.toLowerCase();

const { createMock } = vi.hoisted(() => ({ createMock: vi.fn() }));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = { create: createMock };
  },
}));

const { deriveOpportunities } = await import("../../../src/lib/opportunities/derive");
const { boundTopFit, topFitAllowance, FIT_CALL_SITE } = await import("../../../src/lib/opportunities/derive/fit");
const { BUYER_SEARCHES_CALL_SITE, TYPED_CALL_SITE } = await import("../../../src/lib/opportunities/derive/buyer-searches");
const { clusterKey } = await import("../../../src/lib/opportunities/cluster");
const { proposedTopics } = await import("../../../src/lib/opportunities/derive/topics");

const MARKET: MarketConclusion = {
  buyer: "SaaS product teams",
  job: "Get new users to their first success",
  category: "user onboarding software",
  synonyms: ["product tour software"],
  differentiators: [],
  notOurMarket: ["employee onboarding"],
  categoryReason: "",
  rivals: [{ domain: "appcues.com", name: "Appcues", basis: "ranks", reason: "", volume: 5400 }],
  // D50: both brands are searched, so each may be a comparison's subject.
  demand: { at: "2026-10-05T00:00:00.000Z", own: 880, brands: { appcues: 5400 } },
};

let state: MemoryState;

beforeEach(() => {
  createMock.mockReset();
  state = newMemoryState();
  setOpportunityStore(memoryStore(state));
});

afterEach(() => setOpportunityStore(null));

/** Answers the fit call from `fitOf`; the buyer's searches are `written`,
 *  and a buyer types every search `typed` does not refuse. */
function judgeWith(
  fitOf: (search: string) => number,
  buyer: { written?: string[]; typed?: (search: string) => boolean } = {}
): void {
  createMock.mockImplementation(async (request: { messages: { content: string }[]; tools?: { name: string }[] }) => {
    const input = JSON.parse(request.messages[0]!.content) as { searches?: { i: number; search: string }[] };
    const site = request.tools?.[0]?.name;
    if (site === BUYER_SEARCHES_CALL_SITE) {
      return toolUseMessage({ problems: buyer.written ?? [], solutions: [] }, 300, 100, BUYER_SEARCHES_CALL_SITE);
    }
    if (site === TYPED_CALL_SITE && input.searches !== undefined) {
      const typed = input.searches.filter(({ search }) => buyer.typed?.(search) ?? true).map(({ i }) => i);
      return toolUseMessage({ typed }, 300, 50, TYPED_CALL_SITE);
    }
    if (site !== FIT_CALL_SITE || input.searches === undefined) throw new Error("no model for this call");
    const scores = input.searches.map(({ i, search }) => {
      const fit = fitOf(search);
      return { i, fit, title: fit >= 2 ? `The angle for ${search}` : "" };
    });
    return toolUseMessage(
      { scores, strongest: scores.filter((score) => score.fit === 3).map((score) => score.i) },
      900,
      300,
      FIT_CALL_SITE
    );
  });
}

const input = () => ({
  siteId: SITE_ID,
  scanId: SCAN_ID,
  report: defaultReport(),
  ownRanked: measured(0, AT),
  rankedCounts: smallCounts(),
  market: MARKET,
});

describe("a pass writes targets from the market's own vocabulary at fit 3", () => {
  it("a rival's alternatives and the category for its buyer become write targets with no measured volume; a fit-2 proposal does not", async () => {
    judgeWith((search) => (search === "appcues alternatives" || search.endsWith("for saas product teams") ? 3 : 2));
    const { ctx } = fakeCost();
    await deriveOpportunities(ctx, input());

    const proposed = state.rows.filter((row) => row.source === "product" && row.business_fit === 3);
    expect(proposed.map((row) => row.target_query)).toEqual(
      expect.arrayContaining(["appcues alternatives", "user onboarding software for saas product teams"])
    );
    expect(state.rows.map((row) => row.target_query)).not.toContain("user onboarding software pricing");
    // Nothing measured is claimed for a proposal: no volume, no AI-answer gap.
    const alternatives = state.rows.find((row) => row.target_query === "appcues alternatives")!;
    expect(alternatives.volume).toBeNull();
    expect(alternatives.type).toBe("comparison_page");
    expect(alternatives.title).toBe("The angle for appcues alternatives");
    expect(state.rows.filter((row) => row.source === "ai_gap").every((row) => row.volume !== null)).toBe(true);
  });

  it("a measured target the business is not the answer to is stored with its fit and never fills a day", async () => {
    judgeWith(() => 1);
    const { ctx } = fakeCost();
    const { created } = await deriveOpportunities(ctx, input());

    expect(created).toHaveLength(1);
    expect(created[0]!.businessFit).toBe(1);
    expect(eligible(created[0]!, READY)).toBe("low_fit");
  });

  it("no judgement is no proposal: the pass derives what it measured and nothing else", async () => {
    createMock.mockRejectedValue(new Error("model unavailable"));
    const { ctx } = fakeCost();
    const { created } = await deriveOpportunities(ctx, input());

    expect(created.map((row) => row.targetQuery)).toEqual(["best user onboarding software"]);
    expect(created[0]!.businessFit ?? null).toBeNull();
  });
});

describe("write targets are the words a buyer types (issue 1208)", () => {
  const LABEL = "user onboarding software pricing";
  const HOW_TO = "how to stop new users dropping off after signup";

  it("a problem in the buyer's words is written at fit 3; the market's own label a buyer would not type is not", async () => {
    judgeWith((search) => (search === HOW_TO || search === LABEL ? 3 : 2), { written: [HOW_TO], typed: (search) => search !== LABEL });
    const { ctx } = fakeCost();
    await deriveOpportunities(ctx, input());

    const written = state.rows.find((row) => row.target_query === HOW_TO)!;
    expect(written).toMatchObject({ source: "problem", business_fit: 3, volume: null });
    expect(state.rows.map((row) => row.target_query)).not.toContain(LABEL);
  });

  it("a label an earlier pass wrote down is dismissed once a buyer is found not to type it", async () => {
    const fit = (search: string) => (search === LABEL || search === "appcues alternatives" ? 3 : 2);
    judgeWith(fit);
    const { ctx } = fakeCost();
    await deriveOpportunities(ctx, input());
    expect(state.rows.find((row) => row.target_query === LABEL)!.status).toBe("open");

    judgeWith(fit, { typed: (search) => search !== LABEL });
    await deriveOpportunities(ctx, input());
    expect(state.rows.find((row) => row.target_query === LABEL)!.status).toBe("dismissed");
    expect(state.rows.find((row) => row.target_query === "appcues alternatives")!.status).toBe("open");
  });

  it("with no check, nothing unmeasured is proposed", async () => {
    judgeWith(() => 3, { typed: () => { throw new Error("model unavailable"); } });
    const { ctx } = fakeCost();
    await deriveOpportunities(ctx, input());
    expect(state.rows.map((row) => row.target_query)).toEqual(["best user onboarding software"]);
  });

  it("a rival's own price is never a page about the rival: it becomes the product against that rival's price", async () => {
    judgeWith((search) => (search.endsWith("vs appcues pricing") ? 3 : 2));
    const { ctx } = fakeCost();
    const report = reportOf({
      questions: [question({ search: search({ keyword: "appcues pricing" }) }), question({ id: "q2", search: search({ keyword: "appcues cost" }) })],
      serps: [serp(), serp()],
    });
    await deriveOpportunities(ctx, { ...input(), report });

    const targets = state.rows.map((row) => row.target_query);
    expect(targets).not.toContain("appcues pricing");
    expect(targets).not.toContain("appcues cost");
    expect(targets.filter((target) => /appcues pricing$/.test(target ?? ""))).toEqual([`${OWN} vs appcues pricing`]);
    expect(state.rows.find((row) => row.target_query === `${OWN} vs appcues pricing`)!.type).toBe("comparison_page");
  });

  it("one price asked two ways is one topic by its words", () => {
    expect(clusterKey("meltwater pricing", [])).toBe(clusterKey("meltwater cost", []));
    expect(clusterKey("meltwater pricing", [])).not.toBe(clusterKey("meltwater alternatives", []));
  });
});

describe("the top fit is bounded", () => {
  it("at most a quarter of the searches keep a 3, in the order the judgement ranked them", () => {
    const scores = Array.from({ length: 20 }, (_, i) => ({ i, fit: 3, title: `t${i}` }));
    const bound = boundTopFit(scores, [19, 18, 17, 16, 15], 20);

    expect(topFitAllowance(20)).toBe(5);
    expect([...bound].filter(([, judged]) => judged.fit === 3).map(([i]) => i).sort((a, b) => a - b)).toEqual([15, 16, 17, 18, 19]);
    expect(bound.get(0)!.fit).toBe(2);
  });

  it("a score for a search it was not shown does not count", () => {
    expect(boundTopFit([{ i: 7, fit: 3, title: "x" }], [7], 3).size).toBe(0);
  });
});

const READY: ReadinessContext = {
  now: AT,
  grounded: true,
  earnGrounding: { comparison_table: true, integration_page: true, original_data_page: true },
  suppression: { clusters: new Set(), retiredUrls: new Set() },
  profile: PROFILE,
  ownRanks: () => false,
  canUpdate: () => true,
  coveredBy: () => null,
};

function row(over: Partial<Opportunity>): Opportunity {
  return {
    id: "o",
    siteId: SITE_ID,
    scanId: SCAN_ID,
    type: "keyword_page",
    family: "write",
    targetQuery: "how to get new users to their first success",
    targetRef: "ref",
    title: null,
    volume: measured(0, AT),
    evidence: { family: "write" } as Opportunity["evidence"],
    acceptance: { form: "top20", query: "" },
    fitBand: "winnable",
    effort: 0.3,
    status: "open",
    clusterKey: null,
    absorbedQueries: [],
    ready: false,
    unreadyReason: "not_assessed",
    createdAt: AT,
    ...over,
  };
}

describe("readiness reads the stored fit", () => {
  it("a zero-volume how-to at fit 3 fills a day; the same search at fit 2 is held by the keyword gate", () => {
    expect(eligible(row({ businessFit: 3 }), READY)).toBeNull();
    expect(eligible(row({ businessFit: 2 }), READY)).toBe("no_intent");
  });

  it("an update of a page at fit 1 is low_fit too", () => {
    expect(eligible(row({ family: "improve", type: "refresh_page", businessFit: 1 }), READY)).toBe("low_fit");
  });
});

describe("comparisons target names buyers search for (D50, issue 1271)", () => {
  const rivals = [
    { domain: "maxonboard.com", name: "MaxOnboard", basis: "ai_answer" as const, reason: "", volume: 0 },
    { domain: "appcues.com", name: "Appcues", basis: "ranks" as const, reason: "", volume: 5400 },
    { domain: "userpilot.com", name: "Userpilot", basis: "same_job" as const, reason: "", volume: 2400 },
  ];
  const unknownBrand: MarketConclusion = {
    ...MARKET,
    rivals,
    demand: { at: "2026-10-05T00:00:00.000Z", own: 0, brands: { appcues: 5400, userpilot: 2400, maxonboard: 0 } },
  };

  it("a business nobody searches for is never one side: the targets are a searched rival's alternatives and searched rivals against each other", () => {
    const targets = proposedTopics({ report: defaultReport(), market: unknownBrand, taken: [], ownRanked: 0, max: 40 }).map((t) => t.query);
    expect(targets).toEqual(expect.arrayContaining(["appcues alternatives", "userpilot alternatives", "appcues vs userpilot"]));
    expect(targets.filter((target) => target.includes(OWN))).toEqual([]);
    expect(targets.filter((target) => target.includes("maxonboard"))).toEqual([]);
  });

  it("a business's name keeps its letters in the topics that name it (issue 1314)", () => {
    const report = defaultReport();
    if (report.market.kind === "unmeasured") throw new Error("the fixture report holds a market");
    const profile = { ...report.market.value.profile, brandTokens: ["Zuni Café"] };
    const accented = { ...report, market: { ...report.market, value: { ...report.market.value, profile } } };
    const searched: MarketConclusion = { ...unknownBrand, demand: { ...unknownBrand.demand!, own: 49500 } };
    const targets = proposedTopics({ report: accented, market: searched, taken: [], ownRanked: 0, max: 40 }).map((t) => t.query);
    expect(targets).toContain("zuni café vs appcues");
    expect(targets.filter((target) => target.includes("zuni caf "))).toEqual([]);
  });

  it("a comparison an earlier pass queued against a rival nobody searches is dismissed once the volumes are read", async () => {
    const fit = (search: string) => (search === `${OWN} vs maxonboard` ? 3 : 2);
    judgeWith(fit);
    const { ctx } = fakeCost();
    await deriveOpportunities(ctx, { ...input(), market: { ...MARKET, rivals } });
    expect(state.rows.find((row) => row.target_query === `${OWN} vs maxonboard`)!.status).toBe("open");

    judgeWith(fit);
    await deriveOpportunities(ctx, { ...input(), market: unknownBrand });
    expect(state.rows.find((row) => row.target_query === `${OWN} vs maxonboard`)!.status).toBe("dismissed");
  });

  it("D59: an open topic naming a searched product that is no longer a rival is dismissed; one a page was drafted from is not", async () => {
    judgeWith(() => 3);
    const { ctx } = fakeCost();
    await deriveOpportunities(ctx, { ...input(), market: unknownBrand });
    const topic = (query: string) => state.rows.find((row) => row.target_query === query)!;
    expect([topic("appcues alternatives").status, topic("userpilot alternatives").status]).toEqual(["open", "open"]);

    // Both are searched, so D50 keeps their topics; both have left the rivals.
    const moved: MarketConclusion = { ...unknownBrand, rivals: rivals.filter((rival) => rival.name === "MaxOnboard") };
    state.drafted = [{ date: "2026-10-05", state: "needs_attention", title: null, row: topic("appcues alternatives") }];
    judgeWith(() => 3);
    await deriveOpportunities(ctx, { ...input(), market: moved });
    expect(topic("userpilot alternatives").status).toBe("dismissed");
    expect(topic("appcues alternatives").status).toBe("open");
    expect(topic("best user onboarding software").status).toBe("open");
  });
});

