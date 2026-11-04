// The store's grounding reads, through the real `store.ts`: they read the current report's scan, the
// writer's scope, and a failed read rejects instead of answering "no fact".
import "./env";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb, type FakeDb } from "../scan/deep/fake-db";
import { NO_EARN_GROUNDING } from "../../src/lib/opportunities/earn-grounding";
import { opportunityStore } from "../../src/lib/opportunities/store";
import { SCAN_ID, SITE_ID, question, reportOf, serp } from "./fixtures";

let db: FakeDb = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client }));

const reads = vi.hoisted(() => ({ grounding: vi.fn(), text: vi.fn() }));
vi.mock("@/lib/generate/pipeline/grounding", async (original) => ({
  ...(await original<object>()),
  readGroundingFact: reads.grounding,
}));
vi.mock("@/lib/measure/text", async (original) => ({ ...(await original<object>()), readMeasuredText: reads.text }));
vi.mock("@/lib/site-profile/store", () => ({ readSiteProfile: async () => null }));

const STORED = JSON.parse(JSON.stringify(reportOf({ questions: [question()], serps: [serp()] })));
const timeout = () => Promise.reject(new Error("canceling statement due to statement timeout (57014)"));

beforeEach(() => {
  db = fakeDb({ scans: [{ id: SCAN_ID, site_id: SITE_ID, is_current: true, report: STORED }] });
  reads.grounding.mockReset().mockResolvedValue({ failed: "no_fact" });
  reads.text.mockReset().mockResolvedValue([]);
});
afterEach(() => vi.clearAllMocks());

describe("hasGroundingFact", () => {
  it("reads the current report's scanId, the same scope as the writer", async () => {
    reads.grounding.mockResolvedValue({ text: "a passage", url: "https://example.com/" });
    expect(await opportunityStore().hasGroundingFact(SITE_ID)).toBe(true);
    // The writer passes `report.scanId` of the same stored report to `readAllFacts`.
    expect(reads.grounding.mock.calls).toEqual([[{ siteId: SITE_ID, scanId: STORED.scanId }]]);
    expect(STORED.scanId).toBe(SCAN_ID);
  });

  it("answers false with no read where the site has no current report", async () => {
    db = fakeDb({ scans: [{ id: SCAN_ID, site_id: SITE_ID, is_current: false, report: STORED }] });
    expect(await opportunityStore().hasGroundingFact(SITE_ID)).toBe(false);
    expect(reads.grounding).not.toHaveBeenCalled();
  });

  it("rejects on a read error instead of answering no fact", async () => {
    reads.grounding.mockImplementation(timeout);
    await expect(opportunityStore().hasGroundingFact(SITE_ID)).rejects.toThrow("57014");
  });
});

describe("earnGrounding", () => {
  it("reads the current scan and rejects on a read error", async () => {
    expect(await opportunityStore().earnGrounding(SITE_ID)).toEqual(NO_EARN_GROUNDING);
    expect(reads.text.mock.calls).toEqual([[{ siteId: SITE_ID, scanId: SCAN_ID, customerOnly: true }]]);

    reads.text.mockImplementation(timeout);
    await expect(opportunityStore().earnGrounding(SITE_ID)).rejects.toThrow("57014");
  });
});
