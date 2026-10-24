// BUILD §7, §6.3 — what a paid pass does with what it measured (issue #126).
//
// `deriveForPass` is the one call the deep pass and the weekly measurement
// make into §7. The two things it decides are which entry point a tier
// uses and what winnability reads for its two inputs; the derivation
// itself is `tests/opportunities/derive/`'s and is not re-tested here.
import "./env";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PLAN_DEPTH } from "../../src/lib/config/constants";
import { measured, unmeasured } from "../../src/lib/measure/measured";
import type { RivalSize } from "../../src/lib/market/rivals/size";
import { deriveForPass, rankedCountsOf } from "../../src/lib/opportunities/pass";
import { planWeek, supplyDepth } from "../../src/lib/opportunities/plan";
import { setOpportunityStore } from "../../src/lib/opportunities/store";
import { cappedCost, fakeCost } from "./cost";
import { memoryStore, newMemoryState, type MemoryState } from "./memory-store";
import { AT, PROFILE, SITE_ID, defaultReport, question, reportOf, search, serp } from "./fixtures";

vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = { create: () => Promise.reject(new Error("no model in this suite")) };
  },
}));

let state: MemoryState;

/** Days of pages once the week's commit has assessed the pass's rows. */
async function committedSupply(): Promise<number> {
  await planWeek(SITE_ID, { now: AT });
  return (await supplyDepth(SITE_ID, AT)).unused;
}

beforeEach(() => {
  state = newMemoryState();
  setOpportunityStore(memoryStore(state));
});

afterEach(() => {
  setOpportunityStore(null);
});

/** A report whose two top-ten rivals were sized small enough to clear the
 *  winnable bar at cold start. */
function sized(rankedCount: number): RivalSize[] {
  return ["appcues.com", "userpilot.com"].map((domain) => ({
    domain,
    state: "sized" as const,
    rankedCount,
    band: "near" as const,
    at: AT,
    current: true,
  }));
}

describe("rankedCountsOf — #37's sizing, projected", () => {
  it("reads a sized rival's own count, with the date it was measured on", () => {
    const counts = rankedCountsOf(defaultReport({ rivalSizes: measured(sized(40), AT) }));
    expect(counts.get("appcues.com")).toEqual(measured(40, AT));
  });

  it("an unmeasured sizing is an empty lookup, never a zero — a domain we did not size satisfies no bar", () => {
    const counts = rankedCountsOf(defaultReport({ rivalSizes: unmeasured("not_attempted", AT) }));
    expect(counts.size).toBe(0);
    expect(counts.get("appcues.com")).toBeUndefined();
  });

  it("a rival at the row cap is undeterminable and not a count — the floor is not a size", () => {
    // `PRICE_BOOK.RANKED_RIVAL_ROWS` is 100; a response at the cap is "at
    // least this many", which reads a large rival as a small one.
    const counts = rankedCountsOf(defaultReport({ rivalSizes: measured(sized(100), AT) }));
    expect(counts.get("appcues.com")?.kind).toBe("unmeasured");
  });
});

describe("the customer's own count is the pass's, not a guess (issue #140)", () => {
  it("derives against the count the pass stored, whatever it is", async () => {
    // #140 put `ownRanked` on the blob; before it, this read
    // `undeterminable` and every customer was banded at the cold-start
    // floors. The derivation now runs against what was measured.
    const report = defaultReport({
      rivalSizes: measured(sized(40), AT),
      ownRanked: measured(120, AT),
    });
    const outcome = await deriveForPass(fakeCost().ctx, {
      tier: "deep",
      siteId: SITE_ID,
      report,
      hasActiveAccess: true,
    });
    expect(outcome.added).toBeGreaterThan(0);
  });

  it("a count that could not be read is the cold-start 0 and still derives", async () => {
    const report = defaultReport({
      rivalSizes: measured(sized(40), AT),
      ownRanked: unmeasured("undeterminable", AT),
    });
    const outcome = await deriveForPass(fakeCost().ctx, {
      tier: "deep",
      siteId: SITE_ID,
      report,
      hasActiveAccess: true,
    });
    expect(outcome.added).toBeGreaterThan(0);
  });
});

describe("the deep pass derives what its evidence supports", () => {
  it("persists Write opportunities for a site whose rivals clear the bars", async () => {
    // Issue 1549: a day of supply is a day the ranking plans, which needs
    // the site's profile.
    state.profile = PROFILE;
    const report = defaultReport({
      rivalSizes: measured(sized(40), AT),
      ownRanked: measured(120, AT),
    });
    const outcome = await deriveForPass(fakeCost().ctx, {
      tier: "deep",
      siteId: SITE_ID,
      report,
      hasActiveAccess: true,
    });

    expect(outcome.tier).toBe("deep");
    expect(state.rows.length).toBeGreaterThan(0);
    expect(state.rows.every((row) => row.site_id === SITE_ID)).toBe(true);
    // Every row belongs to the pass that derived it: `scan_id` is the
    // report's own, never a second id minted here.
    expect(state.rows.every((row) => row.scan_id === report.scanId)).toBe(true);
    expect(await committedSupply()).toBe(state.rows.filter((row) => row.family !== "fix").length);
    // The Done-when this issue exists for: a sized market yields days of
    // pages, not only Fix instructions (which take no publishing day).
    expect(state.rows.filter((row) => row.family === "write").length).toBeGreaterThan(0);
  });

  it("derives nothing where the market could not be sized — fewer opportunities, never a guessed one", async () => {
    await deriveForPass(fakeCost().ctx, {
      tier: "deep",
      siteId: SITE_ID,
      // A keyword page: the one Write type an unsized market drops (§6).
      report: reportOf(
        {
          questions: [question({ search: search({ keyword: "user onboarding software" }) })],
          serps: [serp({ aiOverview: { present: false, asynchronousAiOverview: false, referenceDomains: [] } })],
        },
        { rivalSizes: unmeasured("undeterminable", AT) }
      ),
      hasActiveAccess: true,
    });
    expect(state.rows.filter((row) => row.family === "write")).toHaveLength(0);
  });

  it("stops at the evidence and pads nothing — a week of days is never invented", async () => {
    const report = reportOf(
      { questions: [question()], serps: [serp()] },
      { rivalSizes: measured(sized(40), AT) }
    );
    await deriveForPass(fakeCost().ctx, {
      tier: "deep",
      siteId: SITE_ID,
      report,
      hasActiveAccess: true,
    });
    expect(await committedSupply()).toBeLessThan(PLAN_DEPTH);
  });
});

describe("right-sizing law — a target is offered only in proportion to the site's own presence (SPEC §6, 2026-09-16, #779)", () => {
  /** One market, two searches: a 20/mo long-tail question an AI answer
   *  gave to a rival, and a 50,000/mo head term no answer covers. The rivals
   *  ranking for both are small, so only the site's own footprint differs. */
  function market(ownRanked: number) {
    return reportOf(
      {
        questions: [
          question({
            id: "q1",
            text: "How do I onboard users without code?",
            search: search({ keyword: "onboard users without code", volume: 20 }),
          }),
          question({
            id: "q2",
            text: "What is the best project management software?",
            search: search({ keyword: "project management software", volume: 50_000 }),
          }),
        ],
        serps: [
          serp(),
          serp({ aiOverview: { present: false, asynchronousAiOverview: false, referenceDomains: [] } }),
        ],
      },
      { rivalSizes: measured(sized(40), AT), ownRanked: measured(ownRanked, AT) }
    );
  }

  async function offered(ownRanked: number): Promise<(string | null)[]> {
    await deriveForPass(fakeCost().ctx, {
      tier: "deep",
      siteId: SITE_ID,
      report: market(ownRanked),
      hasActiveAccess: true,
    });
    return state.rows.filter((row) => row.family === "write").map((row) => row.target_query);
  }

  it("a site ranking for 3 keywords is offered the 20/mo answer and refused the 50,000/mo head term", async () => {
    const queries = await offered(3);
    expect(queries).toContain("onboard users without code");
    expect(queries).not.toContain("project management software");
    const small = state.rows.find((row) => row.target_query === "onboard users without code")!;
    expect(small.fit_band).toBe("winnable");
  });

  it("a site ranking for 30,000 keywords is offered the head term", async () => {
    const queries = await offered(30_000);
    expect(queries).toContain("project management software");
  });
});

describe("the weekly pass tops up", () => {
  it("adds what the week newly found, and a re-run of the same week adds nothing", async () => {
    const report = reportOf(
      {
        questions: [question(), question({ id: "q2", search: search({ keyword: "onboarding checklist tool" }) })],
        serps: [serp(), serp()],
      },
      { rivalSizes: measured(sized(40), AT) }
    );
    const first = await deriveForPass(fakeCost().ctx, {
      tier: "weekly",
      siteId: SITE_ID,
      report,
      hasActiveAccess: true,
    });
    if (first.tier !== "weekly") throw new Error("unreachable");
    expect(first.added).toBeGreaterThan(0);

    const again = await deriveForPass(fakeCost().ctx, {
      tier: "weekly",
      siteId: SITE_ID,
      report,
      hasActiveAccess: true,
    });
    if (again.tier !== "weekly") throw new Error("unreachable");
    expect(again.added).toBe(0);
  });

  it("adds nothing where access has lapsed", async () => {
    const report = defaultReport({ rivalSizes: measured(sized(40), AT) });
    const outcome = await deriveForPass(fakeCost().ctx, {
      tier: "weekly",
      siteId: SITE_ID,
      report,
      hasActiveAccess: false,
    });
    if (outcome.tier !== "weekly") throw new Error("unreachable");
    expect(outcome.added).toBe(0);
    expect(state.rows).toHaveLength(0);
  });
});

// Owner W1: a pass that cannot pay for its typing says so on its own line.
describe("the supply line says whether the typing ran", () => {
  function weekReport() {
    return reportOf(
      {
        questions: [question(), question({ id: "q2", search: search({ keyword: "onboarding checklist tool" }) })],
        serps: [serp(), serp()],
      },
      { rivalSizes: measured(sized(40), AT) }
    );
  }

  function eventsOf(log: { mock: { calls: unknown[][] } }, event: string): Record<string, unknown>[] {
    return log.mock.calls
      .map(([line]) => (typeof line === "string" && line.startsWith("{") ? (JSON.parse(line) as Record<string, unknown>) : null))
      .filter((line): line is Record<string, unknown> => line?.event === event);
  }

  it("a pass whose ceiling refuses says `not_run` with the reason, and buys nothing", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    try {
      const cost = cappedCost();
      await deriveForPass(cost.ctx, { tier: "weekly", siteId: SITE_ID, report: weekReport(), hasActiveAccess: true });
      expect(cost.sources).toEqual([]);
      expect(eventsOf(log, "supply_pass")).toEqual([
        expect.objectContaining({ derived: "not_run", because: "spend_ceiling", spentCents: 9999 }),
      ]);
    } finally {
      log.mockRestore();
    }
  });

  it("a pass that typed says how many topics it typed", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    try {
      await deriveForPass(fakeCost().ctx, { tier: "weekly", siteId: SITE_ID, report: weekReport(), hasActiveAccess: true });
      const [line] = eventsOf(log, "supply_pass");
      expect(line?.derived).toEqual(expect.any(Number));
      expect(line?.derived as number).toBeLessThanOrEqual(line?.added as number);
      expect(line).not.toHaveProperty("because");
    } finally {
      log.mockRestore();
    }
  });
});
