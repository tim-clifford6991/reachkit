// A topic the customer stopped is never derived again, whatever a later pass
// measures; one a gate dismissed comes back on a higher volume. The stored
// rows are the customer panel's, one SaaS and one local site.
import "../env";
import { afterEach, describe, expect, it, vi } from "vitest";
import { measured } from "../../../src/lib/measure/measured";
import { deriveOpportunities } from "../../../src/lib/opportunities/derive";
import { setOpportunityStore } from "../../../src/lib/opportunities/store";
import { panelSite, SITE_ID } from "../../golden/plan/panel";
import { fakeCost } from "../cost";
import { AT, SCAN_ID, question, reportOf, search, serp, smallCounts } from "../fixtures";
import { memoryStore, newMemoryState } from "../memory-store";

vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = { create: () => Promise.reject(new Error("no model in this suite")) };
  },
}));

afterEach(() => {
  setOpportunityStore(null);
});

/** Next week's pass over a panel site whose `query` row was dismissed, at three times the volume it was dismissed at. */
async function nextPass(domain: string, query: string, stopped: boolean) {
  const rows = panelSite(domain).rows.map((row) => (row.target_query === query ? { ...row, status: "dismissed", stopped } : row));
  const dismissedAt = rows.find((row) => row.target_query === query)!.volume!;
  const state = newMemoryState();
  state.rows.push(...rows);
  setOpportunityStore(memoryStore(state));
  const keyword = search({ keyword: query, volume: dismissedAt * 3 });
  const { ctx } = fakeCost();
  await deriveOpportunities(ctx, {
    siteId: SITE_ID,
    scanId: SCAN_ID,
    report: reportOf({ questions: [question({ text: `What is ${query}?`, search: keyword })], serps: [serp()] }),
    ownRanked: measured(0, AT),
    rankedCounts: smallCounts(),
  });
  return state.rows.filter((row) => row.target_query === query && row.status === "open");
}

describe.each([
  ["savvycal.com", "acuity scheduling alternatives"],
  ["fletcherelectric.co.uk", "eicr leeds"],
])("%s: next week's pass measures %s at three times its volume", (domain, query) => {
  it("a topic the customer stopped is not derived again", async () => {
    expect(await nextPass(domain, query, true)).toEqual([]);
  });

  it("a topic a gate dismissed is derived again", async () => {
    expect(await nextPass(domain, query, false)).toHaveLength(1);
  });
});
