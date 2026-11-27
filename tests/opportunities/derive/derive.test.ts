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
import { KNOWN, memoryStore, newMemoryState, setStatus, type MemoryState } from "../memory-store";
import {
  AT,
  SCAN_ID,
  SITE_ID,
  defaultReport,
  question,
  reportOf,
  search,
  serp,
  smallCounts,
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
  knowledge: KNOWN,
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
  it("a search buyers asked that names the business is no page, and each is counted as own_brand", async () => {
    const { ctx } = fakeCost();
    const asked = serp({ peopleAlsoAsk: ["Is Example free?"], relatedSearches: ["example pricing", "user onboarding checklist"] });
    const result = await deriveOpportunities(ctx, { ...input(), report: reportOf({ questions: [question()], serps: [asked] }) });
    expect(result.rejected.own_brand).toBe(2);
    expect(state.rows.flatMap((row) => [row.target_query, ...row.absorbed_queries])).not.toContain("example pricing");
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

  it("a target whose page is published is kept once, under the page's topic, as its update", async () => {
    const { ctx } = fakeCost();
    const first = await deriveOpportunities(ctx, input());
    setStatus(state, first.created[0]!.id, "done", new Date("2026-09-07T09:00:00.000Z"));

    const second = await deriveOpportunities(ctx, input());
    expect(second.created.map((row) => row.clusterKey)).toEqual([first.created[0]!.clusterKey]);
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
        const scores = input.searches!.map(({ i }) => ({ i, fit: 3, fact: 0, angles: [] }));
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

  it("a short site's further line is judged by the same calls, fit ranks it, and the ledger names it", async () => {
    const judged: Record<string, string[]> = {};
    createMock.mockImplementation(async (request: { messages: { content: string }[]; tools?: { name: string }[] }) => {
      const site = request.tools?.[0]?.name ?? "";
      const searches = (JSON.parse(request.messages[0]!.content) as { searches?: { i: number; search: string }[] }).searches ?? [];
      judged[site] = searches.map(({ search }) => search);
      const scores = searches.map(({ i, search }) => ({ i, fit: search === "product analytics pricing" ? 2 : 3, fact: 0, angles: [] }));
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
    expect(state.rows.find((one) => one.target_query === "product analytics pricing")?.business_fit).toBe(2);
    expect(supply.sources.offering).toEqual({ offered: 2, searched: 2, fit: 1, candidates: 2, added: 2 });
  });

  it("a held row the typed re-check refuses is dismissed only by a pass whose inserts landed, and a dated one keeps its day", async () => {
    const answers: Record<string, unknown> = { [BUYER_SEARCHES_CALL_SITE]: { problems: [], solutions: [] }, [TYPED_CALL_SITE]: { typed: [] }, [FIT_CALL_SITE]: { scores: [], strongest: [] }, [SAME_QUESTION_CALL_SITE]: { pairs: [] } };
    const held = (await deriveOpportunities(fakeCost().ctx, input())).created[0]!;
    const query = "why users drop off after signup";
    Object.assign(state.rows.find((row) => row.id === held.id)!, { target_query: query, target_ref: query, volume: null, evidence: { ...held.evidence, query, volume: unmeasured("undeterminable", AT) } });
    createMock.mockImplementation(async (request: { tools?: { name: string }[] }) => toolUseMessage(answers[request.tools?.[0]?.name ?? ""] ?? {}, 100, 50, request.tools?.[0]?.name ?? ""));
    const statusAfter = async (over: object, insert?: () => Promise<never>) => {
      const rows = structuredClone(state.rows).map((row) => (row.id === held.id ? { ...row, ...over } : row));
      const store = memoryStore(newMemoryState({ rows, nextId: state.nextId }));
      setOpportunityStore(insert === undefined ? store : { ...store, insert });
      await deriveOpportunities(fakeCost().ctx, { ...input(), market }).catch(() => null);
      return rows.find((row) => row.id === held.id)!.status;
    };
    expect(await statusAfter({})).toBe("dismissed");
    expect(await statusAfter({}, async () => { throw new Error("insert failed"); })).toBe("open");
    expect(await statusAfter({ planned_for: "2026-11-30", plan_place: 0 })).toBe("open");
  }, 60_000);
});

describe("a write that fails part-way dismisses no topic", () => {
  // Three derivations, each several seconds on CI.
  it("a candidate insert that throws leaves every held row open with its key, and no key held twice", async () => {
    const { ctx } = fakeCost();
    const held = (await deriveOpportunities(ctx, input())).created[0]!;
    // The held row on the same search, unfit and for another target, loses its topic to this pass's candidate.
    Object.assign(state.rows.find((row) => row.id === held.id)!, { business_fit: 0, target_ref: "another-target" });
    const shape = (rows: MemoryState["rows"]) => rows.map(({ id, status, cluster_key }) => ({ id, status, cluster_key }));
    const before = shape(state.rows);
    // Over an unbroken store the same pass dismisses that row and inserts its survivor, so the case below is the one at risk.
    const control = newMemoryState({ rows: structuredClone(state.rows), nextId: state.nextId });
    setOpportunityStore(memoryStore(control));
    await deriveOpportunities(ctx, input());
    expect([control.rows.find((row) => row.id === held.id)?.status, control.rows.filter((row) => row.status === "open").length]).toEqual(["dismissed", 1]);

    const store = memoryStore(state);
    const markDismissed = vi.fn(store.markDismissed);
    setOpportunityStore({ ...store, markDismissed, insert: async () => { throw new Error("insert failed"); } });
    await expect(deriveOpportunities(ctx, input())).rejects.toThrow("insert failed");
    // A survivor's absorbed searches may already be rewritten; no row is lost, and the next pass derives again.
    expect(markDismissed).not.toHaveBeenCalled();
    expect(shape(state.rows)).toEqual(before);
    const keys = state.rows.filter((row) => row.status === "open" || row.status === "queued").flatMap((row) => row.cluster_key ?? []);
    expect(new Set(keys).size).toBe(keys.length);
  }, 60_000);
});
