// Issues 1549, 1559 — supply is the days a committed week can write, and a
// dismissed topic stays dismissed.
import "../env";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { measured } from "../../../src/lib/measure/measured";
import { countWritable, writableDays } from "../../../src/lib/opportunities/rank/open";
import { setOpportunityStore } from "../../../src/lib/opportunities/store";
import { supplyDepth } from "../../../src/lib/opportunities/plan";
import type { Opportunity } from "../../../src/lib/opportunities/types";
import { fakeCost } from "../cost";
import { memoryStore, newMemoryState, setStatus, type MemoryState } from "../memory-store";
import { AT, PROFILE, SCAN_ID, SITE_ID, question, reportOf, search, serp, smallCounts } from "../fixtures";

vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = { create: () => Promise.reject(new Error("no model in this suite")) };
  },
}));

let state: MemoryState;

beforeEach(() => {
  state = newMemoryState({ profile: PROFILE, now: AT });
  setOpportunityStore(memoryStore(state));
});

afterEach(() => {
  setOpportunityStore(null);
});

/** A report whose searches are all "best X": every topic a listicle. */
function listicles(count: number) {
  const questions = [];
  const serps = [];
  for (let n = 0; n < count; n++) {
    questions.push(question({ id: `q${n}`, text: `Best onboarding tool ${n}?`, search: search({ keyword: `best onboarding tool ${n}` }) }));
    serps.push(serp());
  }
  return reportOf({ questions, serps });
}

const input = (report: ReturnType<typeof listicles>) => ({
  siteId: SITE_ID,
  scanId: SCAN_ID,
  report,
  ownRanked: measured(0, AT),
  rankedCounts: smallCounts(),
  hasActiveAccess: true,
});

async function deriveOnly(report: ReturnType<typeof listicles>): Promise<void> {
  const { deriveOpportunities } = await import("../../../src/lib/opportunities/derive");
  await deriveOpportunities(fakeCost().ctx, input(report) as never);
  const { assessReadiness } = await import("../../../src/lib/opportunities/readiness");
  await assessReadiness(SITE_ID, { at: AT });
}

function row(id: string, type: Opportunity["type"], targetQuery: string, absorbedQueries: string[] = []): Opportunity {
  return { id, family: "write", type, status: "open", clusterKey: null, targetQuery, absorbedQueries, evidence: { family: "write" }, createdAt: AT } as unknown as Opportunity;
}

describe("pages left are writable days, not ready topics", () => {
  it("six listicle topics are one writable day in the next seven, not six", async () => {
    await deriveOnly(listicles(6));
    expect(state.rows.filter((r) => r.ready).length).toBe(6);

    expect(await writableDays(SITE_ID, AT, 7)).toBe(1);
    // A week and its spares hold one a week of them, never six-and-counting
    // as a Q&A.
    expect((await supplyDepth(SITE_ID, AT)).unused).toBe(2);
  });

  it("a topic another row already absorbed is counted once", () => {
    const scored = [
      { opportunity: row("a", "keyword_page", "best generative engine optimization tools for agencies", ["how to choose geo software"]), points: 2, parts: [] },
      { opportunity: row("b", "keyword_page", "how to choose geo software"), points: 1, parts: [] },
    ];
    expect(countWritable(scored, { mix: { from: 0, recent: [] } }, 30)).toBe(1);
  });
});

describe("a dismissed topic stays dismissed", () => {
  it("is not written down again by a pass whose evidence did not change", async () => {
    const report = listicles(2);
    await deriveOnly(report);
    const dismissed = state.rows.find((r) => r.target_query === "best onboarding tool 1")!;
    setStatus(state, dismissed.id, "dismissed", AT);

    await deriveOnly(report);

    const again = state.rows.filter((r) => r.target_query === "best onboarding tool 1");
    expect(again.map((r) => r.status)).toEqual(["dismissed"]);
  });
});
