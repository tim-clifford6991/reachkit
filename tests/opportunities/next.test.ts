// BUILD §7 — the ranked list, and the one opportunity a day fills from
// (the week committed from it, issue 1559).
import "./env";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AI_READER_AGENTS } from "../../src/lib/config/constants";
import { measured } from "../../src/lib/measure/measured";
import { deriveOpportunities } from "../../src/lib/opportunities/derive";
import { pageForDay } from "../../src/lib/opportunities/plan";
import { assessReadiness } from "../../src/lib/opportunities/readiness";
import { isPausedType, rankOpen } from "../../src/lib/opportunities/rank/open";
import { setOpportunityStore, type OpportunityRow } from "../../src/lib/opportunities/store";
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

/** The page the day of `AT` takes: its committed week's, committed here on
 *  demand (issue 1559). */
const dayPage = () => pageForDay(SITE_ID, AT.toISOString().slice(0, 10), AT);

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
        text: "Which onboarding software fits a startup?",
        search: search({ keyword: "onboarding software for startups", volume: 20 }),
      }),
      question({
        id: "q2",
        text: "Which onboarding platform should a product team use?",
        search: search({ keyword: "onboarding platform", volume: 95 }),
      }),
      question({
        id: "q3",
        text: "What is onboarding?",
        search: search({ keyword: "onboarding meaning", volume: 80 }),
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
  // SPEC §6: only a ready row takes a day, so the rows get their answer.
  await assessReadiness(SITE_ID, { at: AT });
}

describe("§7: one list, ordered by the formula", () => {
  it("the highest-scoring target is first", async () => {
    await derive(threeTargets());
    const ranked = await rankOpen(SITE_ID);
    expect(ranked).toHaveLength(3);

    const first = state.rows.find((row) => row.id === ranked[0]!.opportunityId)!;
    expect(first.target_query).toBe("onboarding platform");
    // No row outscores the first. After it the days turn between the types
    // of page (D36, D42), so the rest are not in score order where the
    // supply holds more than one type — `rank/content-mix.test.ts`.
    expect(ranked[0]!.score).toBe(Math.max(...ranked.map((entry) => entry.score)));
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
    expect(await dayPage()).toBeNull();
  });

  it("the exclusion is stated once, in the store, and not restated in the day's pick", async () => {
    // A second filter here would be the copy that eventually disagrees
    // with what `supplyDepth` counts. The property that proves there is
    // one predicate: what the day's pick hands back is always a member of
    // the unused-supply set, and it is null exactly when that set is empty.
    // The search is a plain one: a "best …" search is a type the mix leaves
    // out for now (D46), which the ranking drops and the count still holds.
    await derive(
      reportOf(
        {
          questions: [question({ search: search({ keyword: "user onboarding software for startups" }) })],
          serps: [serp()],
        },
        { blockedAgents: [AI_READER_AGENTS[0]!] }
      )
    );
    const next = await dayPage();
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
    const next = await dayPage();

    expect(next).not.toBeNull();
    expect(next!.id).toBe(ranked[0]!.opportunityId);
    expect(next!.targetQuery).toBe("onboarding platform");
    expect(next!.evidence).toBeDefined();
    expect(next!.acceptance).toBeDefined();
    expect(next!.createdAt).toBeInstanceOf(Date);
  });

  it("an exhausted site answers null and writes nothing", async () => {
    const before = state.rows.length;
    expect(await dayPage()).toBeNull();
    expect(state.rows.length).toBe(before);
  });

  it("a queued, done or dismissed row is never handed back to avoid an empty day", async () => {
    await derive(threeTargets());
    for (const row of [...state.rows]) setStatus(state, row.id, "queued", AT);
    expect(await dayPage()).toBeNull();
  });

});

describe("§7 (D46): the mix leaves out only the types on its one list", () => {
  /** One open, ready Write row, the first scored above the plain one by
   *  its demand alone. */
  function ready(id: string, query: string, volume: number): OpportunityRow {
    return {
      id,
      site_id: SITE_ID,
      scan_id: SCAN_ID,
      type: "keyword_page",
      family: "write",
      target_query: query,
      target_ref: id,
      proposed_slug: null,
      title: null,
      volume,
      evidence: { family: "write", query, volume: measured(volume, AT) },
      acceptance: { form: "top20", query },
      fit_band: "winnable",
      effort: 0.5,
      status: "open",
      cluster_key: null,
      absorbed_queries: [],
      ready: true,
      unready_reason: null,
      created_at: AT.toISOString(),
    } as OpportunityRow;
  }

  it("a listicle is back in the mix, its table built in code (D47): one that outscores a Q&A topic is the day's page", async () => {
    state.rows = [
      ready("listicle", "best user onboarding software", 90),
      ready("plain", "user onboarding software for startups", 20),
    ];

    expect((await dayPage())?.targetQuery).toBe("best user onboarding software");
  });

  it("`isPausedType` reads the row's own type against the one list, which is empty", () => {
    expect(isPausedType({ type: "keyword_page", targetQuery: "best user onboarding software" })).toBe(false);
    expect(isPausedType({ type: "comparison_page", targetQuery: "appcues and userpilot" })).toBe(false);
    expect(isPausedType({ type: "keyword_page", targetQuery: "latest user onboarding trends" })).toBe(false);
    expect(isPausedType({ type: "keyword_page", targetQuery: "how to onboard a new user" })).toBe(false);
    // It publishes no asset, so it has no type to pause.
    expect(isPausedType({ type: "unblock", targetQuery: null })).toBe(false);
  });
});
