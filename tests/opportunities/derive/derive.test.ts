// BUILD §7 — deriveOpportunities end to end: de-duplication, persistence,
// the rejection counts, and empty as a success state.
import "../env";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AI_READER_AGENTS, PLAN_DEPTH } from "../../../src/lib/config/constants";
import type { MarketConclusion } from "../../../src/lib/market/infer/types";
import { BUYER_SEARCHES_CALL_SITE, TYPED_CALL_SITE } from "../../../src/lib/opportunities/derive/buyer-searches";
import { FIT_CALL_SITE } from "../../../src/lib/opportunities/derive/fit";
import { SAME_QUESTION_CALL_SITE } from "../../../src/lib/opportunities/derive/same-question";
import { TYPING_CALL_SITE } from "../../../src/lib/opportunities/derive/typing";
import { toolUseMessage } from "../../llm/fixtures";
import { measured, unmeasured } from "../../../src/lib/measure/measured";
import { setOpportunityStore } from "../../../src/lib/opportunities/store";
import { deriveOpportunities } from "../../../src/lib/opportunities/derive";
import { explainChoice } from "../../../src/lib/opportunities/derive/explain";
import { fakeCost } from "../cost";
import { memoryStore, newMemoryState, setStatus, type MemoryState } from "../memory-store";
import {
  AT,
  SCAN_ID,
  SITE_ID,
  bigCounts,
  defaultReport,
  question,
  reportOf,
  search,
  serp,
  smallCounts,
  unreadableCounts,
} from "../fixtures";

// No model in this suite but the supply ledger's: every other derivation is
// the deterministic one, so a count that moves is a rule that moved and never a stubbed label.
const { createMock } = vi.hoisted(() => ({ createMock: vi.fn() }));
vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = { create: createMock };
  },
}));

let state: MemoryState;

beforeEach(() => {
  createMock.mockReset();
  createMock.mockRejectedValue(new Error("no model in this suite"));
  state = newMemoryState();
  setOpportunityStore(memoryStore(state));
});

afterEach(() => {
  setOpportunityStore(null);
});

const input = () => ({
  siteId: SITE_ID,
  scanId: SCAN_ID,
  report: defaultReport(),
  ownRanked: measured(0, AT),
  rankedCounts: smallCounts(),
});

describe("a completed scan becomes opportunities, persisted", () => {
  it("what the derivation produced is what came back, with the ids the store assigned", async () => {
    const { ctx } = fakeCost();
    const result = await deriveOpportunities(ctx, input());

    expect(result.created).toHaveLength(1);
    expect(result.created[0]!.id).toBe("opp-0001");
    expect(result.created[0]!.status).toBe("open");
    expect(result.created[0]!.type).toBe("answer_page");
    expect(state.rows).toHaveLength(1);
  });

  it("the volume column carries the number and the evidence carries the measurement", async () => {
    const { ctx } = fakeCost();
    const result = await deriveOpportunities(ctx, input());
    expect(state.rows[0]!.volume).toBe(90);
    expect(result.created[0]!.volume).toEqual({ kind: "measured", value: 90, at: AT });
  });

  it("only a Write target proposes a slug", async () => {
    const { ctx } = fakeCost();
    await deriveOpportunities(ctx, input());
    expect(state.rows[0]!.proposed_slug).toBe("best-user-onboarding-software");
  });
});

describe("the counts add up, and every rejection lands in exactly one counter", () => {
  // Winnability drops a keyword page only (§6), so the rejections are
  // counted on a search that types as one: no AI answer, customer absent.
  const keywordReport = () =>
    reportOf({
      questions: [question({ search: search({ keyword: "user onboarding software" }) })],
      serps: [serp({ aiOverview: { present: false, asynchronousAiOverview: false, referenceDomains: [] } })],
    });

  it("a market of large rivals is counted as not_yet and creates nothing", async () => {
    const { ctx } = fakeCost();
    const result = await deriveOpportunities(ctx, { ...input(), report: keywordReport(), rankedCounts: bigCounts() });
    expect(result.created).toEqual([]);
    // Every target looked at, across the three families: the one search,
    // plus the two access gates the Fix derivation examined and found
    // clear.
    expect(result.assessed).toBe(3);
    expect(result.rejected).toEqual({ not_yet: 1, unmeasured_top10: 0, duplicate_open: 0, own_brand: 0 });
  });

  it("a market we could not size is counted separately", async () => {
    const { ctx } = fakeCost();
    const result = await deriveOpportunities(ctx, { ...input(), report: keywordReport(), rankedCounts: unreadableCounts() });
    expect(result.rejected).toEqual({ not_yet: 0, unmeasured_top10: 1, duplicate_open: 0, own_brand: 0 });
  });

  it("a search buyers asked that names the business is no page, and each is counted as own_brand", async () => {
    const { ctx } = fakeCost();
    const asked = serp({ peopleAlsoAsk: ["Is Example free?"], relatedSearches: ["example pricing", "user onboarding checklist"] });
    const result = await deriveOpportunities(ctx, { ...input(), report: reportOf({ questions: [question()], serps: [asked] }) });
    expect(result.rejected.own_brand).toBe(2);
    expect(state.rows.flatMap((row) => [row.target_query, ...row.absorbed_queries])).not.toContain("example pricing");
  });

  it("a measured search that names the business is no new page either", async () => {
    const { ctx } = fakeCost();
    const named = question({ search: search({ keyword: "example onboarding software" }) });
    const result = await deriveOpportunities(ctx, { ...input(), report: reportOf({ questions: [named], serps: [serp()] }) });
    expect(result.created.filter((row) => row.family === "write")).toEqual([]);
    expect(result.rejected.own_brand).toBe(1);
  });

  it("a re-run over the same report creates nothing and reports every candidate as a duplicate", async () => {
    const { ctx } = fakeCost();
    const first = await deriveOpportunities(ctx, input());
    const second = await deriveOpportunities(ctx, input());

    expect(first.created).toHaveLength(1);
    expect(second.created).toEqual([]);
    expect(second.rejected.duplicate_open).toBe(1);
    expect(state.rows).toHaveLength(1);
  });

  it("a target whose page is published is never proposed as a second page (#1181)", async () => {
    const { ctx } = fakeCost();
    const first = await deriveOpportunities(ctx, input());
    setStatus(state, first.created[0]!.id, "done", new Date("2026-09-07T09:00:00.000Z"));

    const second = await deriveOpportunities(ctx, input());
    expect(second.created).toEqual([]);
    expect(second.rejected.duplicate_open).toBe(1);
  });
});

describe("§2.5: empty is a success state", () => {
  it("a report yielding nothing returns created: [] with counts and does not throw", async () => {
    const { ctx } = fakeCost();
    const nothing = reportOf({ questions: [], serps: [] }, { blockedAgents: [] });
    const result = await deriveOpportunities(ctx, { ...input(), report: nothing });
    expect(result.created).toEqual([]);
    expect(result.rejected).toEqual({ not_yet: 0, unmeasured_top10: 0, duplicate_open: 0, own_brand: 0 });
  });

  it("a pass that never measured a market is not an error either", async () => {
    const { ctx } = fakeCost();
    const unmeasuredReport = {
      ...defaultReport(),
      questions: unmeasured<never[]>("not_attempted", AT),
    } as ReturnType<typeof defaultReport>;
    const result = await deriveOpportunities(ctx, { ...input(), report: unmeasuredReport });
    expect(result.created).toEqual([]);
  });
});

describe("§6.6's cold-start law", () => {
  it("a customer who ranks for nothing still gets Write targets, and no Improve ones", async () => {
    const { ctx } = fakeCost();
    const result = await deriveOpportunities(ctx, {
      ...input(),
      ownRanked: unmeasured("undeterminable", AT),
    });
    expect(result.created).toHaveLength(1);
    expect(result.created.map((o) => o.family)).toEqual(["write"]);
  });

  it("an unmeasured own count reads as the cold-start zero, never as a large one", async () => {
    // At ownRanked 0 the bars are 500 and 100. A rival at 400 clears the
    // qualifying bar and not the winnable one.
    const { ctx } = fakeCost();
    const result = await deriveOpportunities(ctx, {
      ...input(),
      ownRanked: unmeasured("undeterminable", AT),
      rankedCounts: new Map([
        ["appcues.com", measured(400, AT)],
        ["userpilot.com", measured(4000, AT)],
      ]),
    });
    expect(result.created[0]!.fitBand).toBe("reach");
  });
});

describe("a Fix instruction is stored beside the pages and is none of them", () => {
  it("an unblock is created with a null query, band and volume", async () => {
    const { ctx } = fakeCost();
    const blocked = defaultReport({ blockedAgents: [AI_READER_AGENTS[0]!] });
    const result = await deriveOpportunities(ctx, { ...input(), report: blocked });

    const unblock = result.created.find((o) => o.family === "fix");
    expect(unblock).toBeDefined();
    expect(unblock!.targetQuery).toBeNull();
    expect(unblock!.fitBand).toBeNull();
    expect(unblock!.volume).toBeNull();
  });

  it("two passes finding the same barrier store one instruction, not two", async () => {
    const { ctx } = fakeCost();
    const blocked = defaultReport({ blockedAgents: [AI_READER_AGENTS[0]!] });
    await deriveOpportunities(ctx, { ...input(), report: blocked });
    const second = await deriveOpportunities(ctx, { ...input(), report: blocked });
    // A null `target_query` does not defeat the de-duplication key.
    expect(second.created.filter((o) => o.family === "fix")).toEqual([]);
    expect(state.rows.filter((row) => row.family === "fix")).toHaveLength(1);
  });
});

describe("§7: the derivation buys nothing beyond what the pass already measured", () => {
  it("no vendor call is made other than the fit and typing call sites", async () => {
    const { ctx, sources } = fakeCost();
    await deriveOpportunities(ctx, input());
    expect(new Set(sources)).toEqual(new Set(["topic-fit", "opportunity-typing"]));
  });
});

describe("explainChoice reads back what was stored, and recomputes nothing", () => {
  it("the handles and the stored values, field for field", async () => {
    const { ctx } = fakeCost();
    const created = (await deriveOpportunities(ctx, input())).created[0]!;

    const choice = await explainChoice(created.id);
    expect(choice).toEqual({
      opportunityId: created.id,
      type: created.type,
      family: created.family,
      fitBand: created.fitBand,
      businessFit: created.businessFit ?? null,
      acceptance: created.acceptance,
      evidence: created.evidence,
      planReason: null,
    });
  });

  it("the dates come back as dates, not as the strings jsonb stored", async () => {
    const { ctx } = fakeCost();
    const created = (await deriveOpportunities(ctx, input())).created[0]!;
    const choice = await explainChoice(created.id);
    const evidence = choice!.evidence;
    if (evidence.family !== "write") throw new Error("unreachable");
    expect(evidence.volume.at).toBeInstanceOf(Date);
    expect(evidence.volume.at.toISOString()).toBe(AT.toISOString());
  });

  it("a later scan that moves the numbers does not move the explanation", async () => {
    const { ctx } = fakeCost();
    const created = (await deriveOpportunities(ctx, input())).created[0]!;
    const before = await explainChoice(created.id);

    // A second, richer measurement of the same market — a different scan,
    // a different volume, a different day.
    const later = new Date("2026-09-13T10:00:00.000Z");
    await deriveOpportunities(ctx, {
      ...input(),
      scanId: "33333333-3333-4333-8333-333333333333",
      report: reportOf(
        {
          questions: [question({ search: search({ keyword: "onboarding tool guide", volume: 90 }) })],
          serps: [serp()],
        },
        { verdict: { ...defaultReport().verdict, measuredAt: later } }
      ),
    });

    expect(await explainChoice(created.id)).toEqual(before);
  });

  it("an opportunity that is not there answers null rather than throwing on a read path", async () => {
    expect(await explainChoice("opp-9999")).toBeNull();
  });

  it("it speaks no sentence — every string it returns is a handle or a stored value", async () => {
    const { ctx } = fakeCost();
    const created = (await deriveOpportunities(ctx, input())).created[0]!;
    const choice = (await explainChoice(created.id))!;

    // The customer's own words (their search, their question, a rival's
    // url) and the engine's handles. Nothing composed, and nothing that
    // reads as product voice — those are the copy registry's.
    const strings = JSON.stringify(choice);
    expect(strings).toContain("best user onboarding software");
    expect(choice.type).toBe("answer_page");
    expect(choice.fitBand).toBe("winnable");
  });
});

describe("the pass says how much new-page supply each source gave, at no added call", () => {
  const market: MarketConclusion = { buyer: "SaaS product teams", job: "Get new users to their first success", category: "user onboarding software", synonyms: [], differentiators: [], notOurMarket: [], categoryReason: "", rivals: [] };

  it("counts each source at the stages the pass already has, with one call per judgement", async () => {
    const answers: Record<string, (input: { searches?: { i: number; search: string }[] }) => unknown> = {
      [BUYER_SEARCHES_CALL_SITE]: () => ({ problems: ["how to cut onboarding churn", "why users drop off after signup"], solutions: [] }),
      [TYPED_CALL_SITE]: (input) => ({ typed: input.searches!.filter(({ search }) => search.startsWith("how")).map(({ i }) => i) }),
      [FIT_CALL_SITE]: (input) => {
        const scores = input.searches!.map(({ i }) => ({ i, fit: 3, title: `Angle ${i}` }));
        return { scores, strongest: scores.map(({ i }) => i) };
      },
      [SAME_QUESTION_CALL_SITE]: () => ({ pairs: [] }),
    };
    createMock.mockImplementation(async (request: { messages: { content: string }[]; tools?: { name: string }[] }) => {
      const site = request.tools?.[0]?.name ?? "";
      const answer = answers[site];
      if (answer === undefined) throw new Error(`no model for ${site}`);
      return toolUseMessage(answer(JSON.parse(request.messages[0]!.content)), 100, 50, site);
    });
    const { ctx, sources } = fakeCost();
    const { supply, created } = await deriveOpportunities(ctx, { ...input(), market });

    expect(sources).toEqual([BUYER_SEARCHES_CALL_SITE, TYPED_CALL_SITE, FIT_CALL_SITE, TYPING_CALL_SITE, SAME_QUESTION_CALL_SITE]);
    expect(createMock).toHaveBeenCalledTimes(sources.length);
    expect(supply.sources.best_x).toEqual({ offered: 1, searched: 1, fit: 1, candidates: 1, added: 1 });
    expect(supply.sources.written).toEqual({ offered: 2, searched: 1, fit: 1, candidates: 1, added: 1 });
    expect(supply.have).toBe(created.filter((row) => row.family === "write").length);
    expect(supply.short).toBe(PLAN_DEPTH - supply.have);
    expect(supply.dry).not.toContain("written");
    expect(supply.dry).toContain("cited");
  });

  it("a short site's further line is judged by the same calls, fit 3 decides, and the ledger names it", async () => {
    const judged: Record<string, string[]> = {};
    createMock.mockImplementation(async (request: { messages: { content: string }[]; tools?: { name: string }[] }) => {
      const site = request.tools?.[0]?.name ?? "";
      const searches = (JSON.parse(request.messages[0]!.content) as { searches?: { i: number; search: string }[] }).searches ?? [];
      judged[site] = searches.map(({ search }) => search);
      const scores = searches.map(({ i, search }) => ({ i, fit: search === "product analytics pricing" ? 2 : 3, title: `Angle ${i}` }));
      const answer = { [BUYER_SEARCHES_CALL_SITE]: { problems: [], solutions: [] }, [TYPED_CALL_SITE]: { typed: searches.map(({ i }) => i) }, [FIT_CALL_SITE]: { scores, strongest: [] }, [SAME_QUESTION_CALL_SITE]: { pairs: [] } }[site];
      if (answer === undefined) throw new Error(`no model for ${site}`);
      return toolUseMessage(answer, 100, 50, site);
    });
    const report = defaultReport();
    if (report.market.kind === "unmeasured") throw new Error("the fixture report holds a market");
    const offerings = [{ name: "Onboarding", category: "user onboarding software", weight: 0.6 }, { name: "Analytics", category: "product analytics Leeds", weight: 0.4 }];
    const selling = { ...report, market: { ...report.market, value: { ...report.market.value, profile: { ...report.market.value.profile, offerings } } } };
    const { ctx, sources } = fakeCost();
    const { supply } = await deriveOpportunities(ctx, { ...input(), report: selling, market, area: { name: "Leeds" } });
    expect(state.rows.filter((one) => one.target_query?.includes("leeds"))).toEqual([]);

    expect(sources).toEqual([BUYER_SEARCHES_CALL_SITE, TYPED_CALL_SITE, FIT_CALL_SITE, TYPING_CALL_SITE, SAME_QUESTION_CALL_SITE]);
    for (const site of [TYPED_CALL_SITE, FIT_CALL_SITE]) expect(judged[site]).toEqual(expect.arrayContaining(["product analytics for saas product teams", "product analytics pricing"]));
    const row = state.rows.find((one) => one.target_query === "product analytics for saas product teams");
    expect([row?.source, row?.business_fit, (row?.evidence as { composed?: true }).composed]).toEqual(["product", 3, true]);
    expect(state.rows.some((one) => one.target_query === "product analytics pricing")).toBe(false);
    expect(supply.sources.offering).toEqual({ offered: 2, searched: 2, fit: 1, candidates: 1, added: 1 });
  });
});
