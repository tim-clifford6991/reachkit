// tests/scan/run/improve-owned-pages.test.ts — issue #780, SPEC §7 (2026-09-16).
//
// "Update candidates are the site's own pages — its ranked URLs and crawled
// inventory, not only the home page — matched to the market's questions."
//
// Driven through the real deep pass: `runScan` stores the report with the
// site's own ranked rows, `afterReport` runs the real `deriveForPass`, and
// the real `rankOpen` orders what it wrote. Only the vendors, the model,
// the database and the opportunity rows are doubled; nothing is bought.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { captureStages, fakeDb } from "./harness";
import { memoryStore, newMemoryState, type MemoryState } from "../../opportunities/memory-store";
import { measured, unmeasured } from "../../../src/lib/measure/measured";
import type { DomainMeasurement } from "../../../src/lib/measure";
import type { Question } from "../../../src/lib/market/questions/phrase";
import type { StoredReport } from "../../../src/lib/scan/report";
import type { AiAnswer, RankedResult } from "../../../src/lib/vendors/dataforseo/types";
import { AT, ON_PAGE, PROFILE, ROBOTS, SERP, SELECTED, QUESTION } from "../report/fixtures";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = { create: () => Promise.reject(new Error("no model in this suite")) };
  },
}));

const measureDomain = vi.fn();
vi.mock("@/lib/measure", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/lib/measure")>()),
  measureDomain: (...args: unknown[]) => measureDomain(...args),
}));

const deriveProfile = vi.fn();
vi.mock("@/lib/market/questions/profile", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/lib/market/questions/profile")>()),
  deriveProfile: (...a: unknown[]) => deriveProfile(...a),
}));

const deriveMarketSet = vi.fn();
vi.mock("@/lib/market/questions/market-set", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/lib/market/questions/market-set")>()),
  deriveMarketSet: (...a: unknown[]) => deriveMarketSet(...a),
}));

const phraseQuestions = vi.fn();
vi.mock("@/lib/market/questions/phrase", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/lib/market/questions/phrase")>()),
  phraseQuestions: (...a: unknown[]) => phraseQuestions(...a),
}));

const serpOrganic = vi.fn();
const aiMode = vi.fn();
const llmScraper = vi.fn();
const rankedKeywords = vi.fn();
vi.mock("@/lib/vendors/dataforseo", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/lib/vendors/dataforseo")>()),
  serpOrganic: (...a: unknown[]) => serpOrganic(...a),
  aiMode: (...a: unknown[]) => aiMode(...a),
  llmScraper: (...a: unknown[]) => llmScraper(...a),
  rankedKeywords: (...a: unknown[]) => rankedKeywords(...a),
}));

vi.mock("@/lib/market/rivals/tracked", () => ({ trackedRivals: async () => ["appcues.com", "userpilot.com"] }));

const readCurrentReport = vi.fn();
vi.mock("@/lib/scan/report", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/lib/scan/report")>()),
  readCurrentReport: (...a: unknown[]) => readCurrentReport(...a),
}));

const storeCurrentReport = vi.fn();
vi.mock("@/lib/scan/store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/lib/scan/store")>()),
  storeCurrentReport: (...a: unknown[]) => storeCurrentReport(...a),
}));

vi.mock("@/lib/scan/correction", () => ({
  readCorrectionFacts: async () => null,
  advanceCorrectionState: async () => true,
  registerCorrectionRunner: () => undefined,
  correctionRunner: () => null,
}));

const { runScan } = await import("../../../src/lib/scan/run");
const { deriveForPass } = await import("../../../src/lib/opportunities/pass");
const { rankOpen } = await import("../../../src/lib/opportunities/rank/open");
const { setOpportunityStore } = await import("../../../src/lib/opportunities/store");

const CLAIMED_ID = "55555555-5555-4555-8555-555555555555";
const SITE_ID = "22222222-2222-4222-8222-222222222222";
const DOMAIN = "example.com";
const BLOG_POST = "https://example.com/blog/user-onboarding-checklist";

/** Two questions of the same demand and the same intent, both small enough
 *  for a site this size (§6's right-sizing law): one the site's blog post
 *  ranks 12 for, one it has no page for. */
const CHECKLIST: Question = {
  ...QUESTION,
  id: "q1",
  text: "What belongs on a user onboarding checklist?",
  search: { ...SELECTED, keyword: "best user onboarding checklist", volume: 150 },
};
const TOURS: Question = {
  ...QUESTION,
  id: "q2",
  text: "Which product tour tool is best?",
  search: { ...SELECTED, keyword: "best product tour tool", volume: 150, rank: 2 },
};

function measurement(ownRankedRows: DomainMeasurement["ownRankedRows"]): DomainMeasurement {
  return {
    drivers: {
      foundations: measured(52, AT),
      answerability: measured(38, AT),
      searchPresence: measured(4, AT),
      aiPresence: unmeasured("not_attempted", AT),
    },
    text: { home: "Onboarding for product teams.", pricing: null },
    // A substantial home page: nothing to expand there.
    onPage: measured({ ...ON_PAGE, visibleChars: 9000 }, AT),
    pricing: null,
    robots: measured(ROBOTS, AT),
    ownRanked: measured(3, AT),
    ownRankedRows,
    homeRefusal: null,
  };
}

const RANKED_BLOG_POST = [{ keyword: CHECKLIST.search.keyword, position: 12, searchVolume: 150, url: BLOG_POST }];

const answered = (cited: string[]): AiAnswer => ({ answered: true, text: "…", citedDomains: cited });

let state: MemoryState;
let stages: { lines: string[]; restore: () => void };

beforeEach(() => {
  vi.clearAllMocks();
  db.reset();
  db.rows.set("scans", [{ id: CLAIMED_ID, fromIncompleteRescan: false }]);
  vi.stubGlobal("fetch", () => Promise.reject(new Error("no network in this suite")));
  measureDomain.mockResolvedValue(measurement(RANKED_BLOG_POST));
  deriveProfile.mockResolvedValue(measured(PROFILE, AT));
  deriveMarketSet.mockResolvedValue(
    measured(
      [CHECKLIST, TOURS].map((q) => ({ keyword: q.search.keyword, volume: q.search.volume })),
      AT
    )
  );
  phraseQuestions.mockResolvedValue(measured([CHECKLIST, TOURS], AT));
  // Rivals hold both top tens and the AI overview; the site is in neither.
  serpOrganic.mockResolvedValue(measured(SERP, AT));
  aiMode.mockResolvedValue(measured(answered(["appcues.com"]), AT));
  llmScraper.mockResolvedValue(measured(answered(["userpilot.com"]), AT));
  // Small rivals: both searches are winnable for a site this size.
  rankedKeywords.mockResolvedValue(measured<RankedResult>({ rows: [], total: 40 }, AT));
  readCurrentReport.mockResolvedValue(null);
  storeCurrentReport.mockImplementation(async (a: { report: StoredReport }) => ({
    scanId: a.report.scanId,
    status: "done" as const,
  }));

  state = newMemoryState({
    profile: PROFILE,
    inventory: [
      { url: "https://example.com/", title: "Example — onboarding", h1: "Onboarding", purpose: "product" },
      { url: BLOG_POST, title: "The user onboarding checklist", h1: "User onboarding checklist", purpose: "blog" },
    ],
  });
  setOpportunityStore(memoryStore(state));
  stages = captureStages();
});

afterEach(() => {
  stages.restore();
  setOpportunityStore(null);
  vi.unstubAllGlobals();
});

async function deepPass(): Promise<StoredReport> {
  let stored: StoredReport | null = null;
  await runScan({
    domain: DOMAIN,
    tier: "deep",
    siteId: SITE_ID,
    afterReport: async ({ report, cost }) => {
      stored = report;
      state.report = report;
      await deriveForPass(cost, { tier: "deep", siteId: SITE_ID, report, hasActiveAccess: true });
    },
  });
  if (stored === null) throw new Error("the pass stored no report");
  return stored;
}

describe("SPEC §7 (2026-09-16) — update candidates are the site's own ranked pages", () => {
  it("keeps the site's own ranked rows on the stored report, from the one call", async () => {
    const report = await deepPass();
    expect(report.ownRankedRows).toEqual(RANKED_BLOG_POST);
  });

  it("a blog post ranking 12 for a market question yields an Improve for that url, and it outranks a comparable new page", async () => {
    await deepPass();

    const improve = state.rows.find((row) => row.family === "improve");
    expect(improve).toMatchObject({
      type: "answerable_page",
      target_ref: BLOG_POST,
      target_query: CHECKLIST.search.keyword,
    });
    const write = state.rows.find((row) => row.family === "write" && row.target_query === TOURS.search.keyword);
    expect(write).toBeDefined();
    expect(improve!.ready).toBe(true);
    expect(write!.ready).toBe(true);

    const order = (await rankOpen(SITE_ID)).map((entry) => entry.opportunityId);
    expect(order.indexOf(improve!.id)).toBeGreaterThanOrEqual(0);
    expect(order.indexOf(improve!.id)).toBeLessThan(order.indexOf(write!.id));
  });

  it("without the ranked rows the same pass has no page to update — the home page is not invented as one", async () => {
    measureDomain.mockResolvedValue(measurement([]));
    await deepPass();
    expect(state.rows.filter((row) => row.family === "improve")).toEqual([]);
  });
});
