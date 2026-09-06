// BUILD §7 — deriveOpportunities end to end: de-duplication, persistence,
// the rejection counts, and empty as a success state.
import "../env";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AI_READER_AGENTS } from "../../../src/lib/config/constants";
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

// No model in this suite: every derivation below is the deterministic one,
// so a count that moves is a rule that moved and never a stubbed label.
vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = { create: () => Promise.reject(new Error("no model in this suite")) };
  },
}));

let state: MemoryState;

beforeEach(() => {
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
    expect(state.rows[0]!.volume).toBe(1900);
    expect(result.created[0]!.volume).toEqual({ kind: "measured", value: 1900, at: AT });
  });

  it("only a Write target proposes a slug", async () => {
    const { ctx } = fakeCost();
    await deriveOpportunities(ctx, input());
    expect(state.rows[0]!.proposed_slug).toBe("best-user-onboarding-software");
  });
});

describe("the counts add up, and every rejection lands in exactly one counter", () => {
  it("a market of large rivals is counted as not_yet and creates nothing", async () => {
    const { ctx } = fakeCost();
    const result = await deriveOpportunities(ctx, { ...input(), rankedCounts: bigCounts() });
    expect(result.created).toEqual([]);
    // Every target looked at, across the three families: the one search,
    // plus the two access gates the Fix derivation examined and found
    // clear.
    expect(result.assessed).toBe(3);
    expect(result.rejected).toEqual({ not_yet: 1, unmeasured_top10: 0, duplicate_open: 0 });
  });

  it("a market we could not size is counted separately", async () => {
    const { ctx } = fakeCost();
    const result = await deriveOpportunities(ctx, { ...input(), rankedCounts: unreadableCounts() });
    expect(result.rejected).toEqual({ not_yet: 0, unmeasured_top10: 1, duplicate_open: 0 });
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

  it("a target whose earlier page is done may be proposed again", async () => {
    const { ctx } = fakeCost();
    const first = await deriveOpportunities(ctx, input());
    setStatus(state, first.created[0]!.id, "done", new Date("2026-09-07T09:00:00.000Z"));

    const second = await deriveOpportunities(ctx, input());
    expect(second.created).toHaveLength(1);
    expect(second.rejected.duplicate_open).toBe(0);
  });
});

describe("§2.5: empty is a success state", () => {
  it("a report yielding nothing returns created: [] with counts and does not throw", async () => {
    const { ctx } = fakeCost();
    const nothing = reportOf({ questions: [], serps: [] }, { blockedAgents: [] });
    const result = await deriveOpportunities(ctx, { ...input(), report: nothing });
    expect(result.created).toEqual([]);
    expect(result.rejected).toEqual({ not_yet: 0, unmeasured_top10: 0, duplicate_open: 0 });
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
  it("no vendor call is made other than the one typing call site", async () => {
    const { ctx, sources } = fakeCost();
    await deriveOpportunities(ctx, input());
    expect(new Set(sources)).toEqual(new Set(["opportunity-typing"]));
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
      acceptance: created.acceptance,
      evidence: created.evidence,
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
