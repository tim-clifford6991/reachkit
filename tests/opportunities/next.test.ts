// BUILD §7 — the ranked list, and the one opportunity a day fills from.
import "./env";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AI_READER_AGENTS } from "../../src/lib/config/constants";
import { measured } from "../../src/lib/measure/measured";
import { deriveOpportunities } from "../../src/lib/opportunities/derive";
import { nextForDay } from "../../src/lib/opportunities/next";
import { rankOpen } from "../../src/lib/opportunities/rank/open";
import { setOpportunityStore } from "../../src/lib/opportunities/store";
import { supplyDepth } from "../../src/lib/opportunities/supply/depth";
import { fakeCost } from "./cost";
import { memoryStore, newMemoryState, setStatus, type MemoryState } from "./memory-store";
import {
  AT,
  PROFILE,
  SCAN_ID,
  SITE_ID,
  defaultReport,
  question,
  reportOf,
  search,
  serp,
  smallCounts,
} from "./fixtures";

vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = { create: () => Promise.reject(new Error("no model in this suite")) };
  },
}));

let state: MemoryState;

beforeEach(() => {
  state = newMemoryState({ profile: PROFILE });
  setOpportunityStore(memoryStore(state));
});

afterEach(() => {
  setOpportunityStore(null);
});

/** Three targets whose ranking order is decided by demand and intent: a
 *  high-volume decision search, a mid-volume one, and a low-volume
 *  informational one. */
function threeTargets() {
  return reportOf({
    questions: [
      question({
        id: "q1",
        text: "What is the best onboarding software?",
        search: search({ keyword: "best onboarding software", volume: 100 }),
      }),
      question({
        id: "q2",
        text: "What is the best onboarding platform?",
        search: search({ keyword: "best onboarding platform", volume: 9000 }),
      }),
      question({
        id: "q3",
        text: "What is onboarding?",
        search: search({ keyword: "onboarding meaning", volume: 400 }),
      }),
    ],
    serps: [serp(), serp(), serp()],
  });
}

async function derive(report = defaultReport()): Promise<void> {
  const { ctx } = fakeCost();
  await deriveOpportunities(ctx, {
    siteId: SITE_ID,
    scanId: SCAN_ID,
    report,
    ownRanked: measured(0, AT),
    rankedCounts: smallCounts(),
  });
}

describe("§7: one list, ordered by the formula", () => {
  it("the highest-scoring target is first", async () => {
    await derive(threeTargets());
    const ranked = await rankOpen(SITE_ID);
    expect(ranked).toHaveLength(3);

    const first = state.rows.find((row) => row.id === ranked[0]!.opportunityId)!;
    expect(first.target_query).toBe("best onboarding platform");
    // Descending, with no equal pair out of order.
    for (let n = 1; n < ranked.length; n++) {
      expect(ranked[n - 1]!.score).toBeGreaterThanOrEqual(ranked[n]!.score);
    }
  });

  it("the order is total — two reads of the same supply give the same list", async () => {
    await derive(threeTargets());
    expect(await rankOpen(SITE_ID)).toEqual(await rankOpen(SITE_ID));
  });

  it("a site with no readable profile ranks nothing rather than guessing an order", async () => {
    await derive(threeTargets());
    state.profile = null;
    expect(await rankOpen(SITE_ID)).toEqual([]);
  });
});

describe("§7: `unblock` is never in the list and never fills a day", () => {
  it("an instruction is excluded from the ranked set", async () => {
    await derive(defaultReport({ blockedAgents: [AI_READER_AGENTS[0]!] }));
    expect(state.rows.some((row) => row.family === "fix")).toBe(true);

    const ranked = await rankOpen(SITE_ID);
    const families = ranked.map(
      (row) => state.rows.find((candidate) => candidate.id === row.opportunityId)!.family
    );
    expect(families).not.toContain("fix");
  });

  it("a site whose only open rows are instructions answers null", async () => {
    await derive(defaultReport({ blockedAgents: [AI_READER_AGENTS[0]!] }));
    for (const row of state.rows.filter((candidate) => candidate.family !== "fix")) {
      setStatus(state, row.id, "dismissed", AT);
    }
    expect(await nextForDay(SITE_ID)).toBeNull();
  });

  it("the exclusion is stated once, in the store, and not restated in nextForDay", async () => {
    // A second filter here would be the copy that eventually disagrees
    // with what `supplyDepth` counts. The property that proves there is
    // one predicate: what `nextForDay` hands back is always a member of
    // the unused-supply set, and it is null exactly when that set is empty.
    await derive(defaultReport({ blockedAgents: [AI_READER_AGENTS[0]!] }));
    const next = await nextForDay(SITE_ID);
    const { unused } = await supplyDepth(SITE_ID);
    expect(next === null).toBe(unused === 0);
    if (next !== null) {
      expect(next.status).toBe("open");
      expect(next.family).not.toBe("fix");
    }
  });
});

describe("§4.6: the calendar requests; it never creates", () => {
  it("the answer is the head of the ranked order, loaded whole", async () => {
    await derive(threeTargets());
    const ranked = await rankOpen(SITE_ID);
    const next = await nextForDay(SITE_ID);

    expect(next).not.toBeNull();
    expect(next!.id).toBe(ranked[0]!.opportunityId);
    expect(next!.targetQuery).toBe("best onboarding platform");
    expect(next!.evidence).toBeDefined();
    expect(next!.acceptance).toBeDefined();
    expect(next!.createdAt).toBeInstanceOf(Date);
  });

  it("an exhausted site answers null and writes nothing", async () => {
    const before = state.rows.length;
    expect(await nextForDay(SITE_ID)).toBeNull();
    expect(state.rows.length).toBe(before);
  });

  it("a queued, done or dismissed row is never handed back to avoid an empty day", async () => {
    await derive(threeTargets());
    for (const row of [...state.rows]) setStatus(state, row.id, "queued", AT);
    expect(await nextForDay(SITE_ID)).toBeNull();
  });

  it("it takes no date and no count — one site, one opportunity or none", () => {
    expect(nextForDay.length).toBe(1);
  });
});
