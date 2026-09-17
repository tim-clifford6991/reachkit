// tests/scan/run/thin-market.test.ts — SPEC §6 thin markets (2026-09-16), #778.
//
// A new site's paid pass reads a market too thin for the 50/mo floor. It
// pools the rows the pass already buys (the rivals' sizing rows and the
// site's own), walks the seed ladder inside its cap, steps the floor down,
// and ends with questions and a planned page — through the real pipeline,
// the real selection and the real derivation. An established market reads
// exactly as it did. Every vendor and the model are doubled: nothing is
// bought.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { captureStages, fakeDb } from "./harness";
import { measured, measuredZero, unmeasured } from "../../../src/lib/measure/measured";
import type { DomainMeasurement } from "../../../src/lib/measure";
import type { SelectedSearch } from "../../../src/lib/market/questions/select";
import type { StoredReport } from "../../../src/lib/scan/report";
import { memoryStore, newMemoryState, type MemoryState } from "../../opportunities/memory-store";
import { AT, ON_PAGE, PROFILE, ROBOTS } from "../report/fixtures";

vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = { create: () => Promise.reject(new Error("no model in this suite")) };
  },
}));

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

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

const phraseQuestions = vi.fn();
vi.mock("@/lib/market/questions/phrase", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/lib/market/questions/phrase")>()),
  phraseQuestions: (...a: unknown[]) => phraseQuestions(...a),
}));

const keywordSuggestions = vi.fn();
const rankedKeywords = vi.fn();
const serpOrganic = vi.fn();
vi.mock("@/lib/vendors/dataforseo", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/lib/vendors/dataforseo")>()),
  keywordSuggestions: (...a: unknown[]) => keywordSuggestions(...a),
  rankedKeywords: (...a: unknown[]) => rankedKeywords(...a),
  serpOrganic: (...a: unknown[]) => serpOrganic(...a),
}));

const trackedRivals = vi.fn();
vi.mock("@/lib/market/rivals/tracked", () => ({
  trackedRivals: (...a: unknown[]) => trackedRivals(...a),
}));

vi.mock("@/lib/scan/report", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/lib/scan/report")>()),
  readCurrentReport: async () => null,
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
const { selectTwelve } = await import("../../../src/lib/market/questions/select");
const { deriveForPass } = await import("../../../src/lib/opportunities/pass");
const { setOpportunityStore } = await import("../../../src/lib/opportunities/store");

const DOMAIN = "example.com";
const SITE = "site-1";
const CLAIMED_ID = "55555555-5555-4555-8555-555555555555";
const RIVALS = ["appcues.com", "userpilot.com"];

const MEASUREMENT: DomainMeasurement = {
  drivers: {
    foundations: measured(52, AT),
    answerability: measured(38, AT),
    searchPresence: measuredZero(0, AT),
    aiPresence: unmeasured("not_attempted", AT),
  },
  text: { home: "Onboarding for product teams.", pricing: null },
  onPage: measured(ON_PAGE, AT),
  pricing: null,
  robots: measured(ROBOTS, AT),
  // A new site: it ranks for almost nothing.
  ownRanked: measured(1, AT),
  ownRankedRows: [{ keyword: "saas onboarding tool", position: 40, searchVolume: 10, url: "https://example.com/" }],
  homeRefusal: null,
};

function suggestions(rows: readonly (readonly [string, number])[]) {
  const value = rows.map(([keyword, searchVolume]) => ({ keyword, searchVolume }));
  return value.length === 0 ? measuredZero(value, AT) : measured(value, AT);
}

function ranked(rows: readonly (readonly [string, number])[], total: number) {
  return measured(
    {
      rows: rows.map(([keyword, searchVolume], i) => ({
        keyword,
        position: i + 1,
        searchVolume,
        url: "https://rival.example/",
      })),
      total,
    },
    AT
  );
}

/** Every suggestion 10–20/mo: nothing clears the 50/mo floor. */
const THIN: Record<string, readonly (readonly [string, number])[]> = {
  "user onboarding software": [
    ["user onboarding software pricing", 20],
    ["employee onboarding checklist", 20],
  ],
  onboarding: [["onboarding software for saas", 10]],
  "product tours": [["product tours software", 10]],
};

/** The rivals' own rows — relevant ones, and one a guard must still drop. */
const RIVAL_ROWS: Record<string, readonly (readonly [string, number])[]> = {
  "appcues.com": [
    ["appcues alternatives", 20],
    ["pilot training courses", 900],
  ],
  "userpilot.com": [["userpilot alternatives", 20]],
};

const SERP = {
  organic: [
    { position: 1, domain: "appcues.com", url: "https://appcues.com/", title: "Appcues" },
    { position: 2, domain: "userpilot.com", url: "https://userpilot.com/", title: "Userpilot" },
  ],
  aiOverview: { present: false, asynchronousAiOverview: false, referenceDomains: [] },
};

let state: MemoryState;
let stages: { lines: string[]; restore: () => void };

function storedReport(): StoredReport {
  return (storeCurrentReport.mock.calls[0]![0] as { report: StoredReport }).report;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "log").mockImplementation(() => {});
  db.reset();
  db.rows.set("scans", [{ id: CLAIMED_ID, fromIncompleteRescan: false }]);
  state = newMemoryState({ profile: PROFILE });
  setOpportunityStore(memoryStore(state));
  measureDomain.mockResolvedValue(MEASUREMENT);
  deriveProfile.mockResolvedValue(measured(PROFILE, AT));
  keywordSuggestions.mockImplementation(async (_c: unknown, a: { seed: string }) => suggestions(THIN[a.seed] ?? []));
  rankedKeywords.mockImplementation(async (_c: unknown, a: { domain: string }) =>
    ranked(RIVAL_ROWS[a.domain] ?? [], 40)
  );
  phraseQuestions.mockImplementation(async (_c: unknown, a: { selected: SelectedSearch[] }) =>
    measured(
      a.selected.map((search, i) => ({ id: `q${i + 1}`, text: `${search.keyword}?`, search, phrasing: "template" })),
      AT
    )
  );
  serpOrganic.mockResolvedValue(measured(SERP, AT));
  trackedRivals.mockResolvedValue(RIVALS);
  storeCurrentReport.mockImplementation(async (a: { report: StoredReport }) => ({
    scanId: a.report.scanId,
    status: "done" as const,
  }));
  stages = captureStages();
});

afterEach(() => {
  stages.restore();
  setOpportunityStore(null);
});

/** The deep pass as onboarding runs it: the pipeline, then §7's derivation
 *  over the stored report on the pass's own money (`src/lib/scan/deep/run.ts`). */
async function deepPass(): Promise<void> {
  await runScan({
    domain: DOMAIN,
    tier: "deep",
    siteId: SITE,
    afterReport: async ({ report, cost }) => {
      await deriveForPass(cost, { tier: "deep", siteId: SITE, report, hasActiveAccess: true });
    },
  });
}

describe("a thin market still yields questions and a planned page (SPEC §6, #778)", () => {
  it("a deep pass over a market of 10–20/mo searches reaches at least one question and one opportunity", async () => {
    await deepPass();

    const report = storedReport();
    expect(report.questions.kind).toBe("measured");
    const questions = report.questions.kind === "measured" ? report.questions.value : [];
    expect(questions.length).toBeGreaterThanOrEqual(1);
    expect(state.rows.length).toBeGreaterThanOrEqual(1);
  });

  it("pools the rivals' sizing rows — a rival-sourced search survives on the rival's brand — and buys them once", async () => {
    await deepPass();

    const report = storedReport();
    const searches = report.questions.kind === "measured" ? report.questions.value.map((q) => q.search.keyword) : [];
    expect(searches).toContain("userpilot alternatives");
    expect(searches).toContain("saas onboarding tool");
    expect(searches).not.toContain("pilot training courses");
    expect(searches).not.toContain("employee onboarding checklist");

    // Sized early for the pool, and never again in the presence stage.
    expect(rankedKeywords).toHaveBeenCalledTimes(RIVALS.length);
    expect(report.rivalSizes.kind).toBe("measured");
    // The pool is stored, so a category corrected at setup re-derives over it.
    const pool = report.market.kind === "unmeasured" ? [] : (report.market.value.pool ?? []);
    expect(pool).toContainEqual({ keyword: "userpilot alternatives", volume: 20, rival: "userpilot.com" });
  });

  it("walks the seed ladder inside the extra-seed limit, and records the step each question came from", async () => {
    await deepPass();

    const seeds = keywordSuggestions.mock.calls.map((call) => (call[1] as { seed: string }).seed);
    expect(seeds).toEqual(["user onboarding software", "onboarding", "product tours"]);
    expect(seeds.length).toBeLessThanOrEqual(4);

    const report = storedReport();
    const questions = report.questions.kind === "measured" ? report.questions.value : [];
    for (const question of questions) {
      expect([20, 10]).toContain(question.search.floor);
      expect(question.search.volume).toBeGreaterThanOrEqual(question.search.floor!);
    }
    expect(questions.find((q) => q.search.keyword === "product tours software")?.search.floor).toBe(10);
    expect(questions.find((q) => q.search.keyword === "userpilot alternatives")?.search.floor).toBe(20);
  });

  it("a category that opens 'X and …' buys its noun phrase as the second seed (issue 836)", async () => {
    deriveProfile.mockResolvedValue(measured({ ...PROFILE, category: "SEO and content marketing software" }, AT));
    await deepPass();

    const seeds = keywordSuggestions.mock.calls.map((call) => (call[1] as { seed: string }).seed);
    expect(seeds.slice(0, 2)).toEqual(["SEO and content marketing software", "content marketing software"]);
  });

  it("the six stages are still six, in order", async () => {
    await deepPass();
    expect(stages.lines.filter((line) => line.endsWith(":enter"))).toEqual([
      "reading_your_site:enter",
      "reading_access_rules:enter",
      "reading_your_market:enter",
      "checking_your_presence:enter",
      "asking_the_twelve:enter",
      "scoring:enter",
    ]);
  });
});

describe("an established market is unchanged", () => {
  const ESTABLISHED: readonly (readonly [string, number])[] = [
    ["best user onboarding software", 2400],
    ["user onboarding software", 1900],
    ["onboarding software for saas", 880],
    ["product tours software", 720],
    ["best product tours software", 640],
    ["saas onboarding tool", 590],
    ["user onboarding platform", 480],
    ["product tours app", 390],
    ["onboarding app for saas", 320],
    ["user onboarding tools for product teams", 260],
    ["best onboarding platform", 210],
    ["saas user onboarding checklist tool", 170],
    ["onboarding platform for product teams", 140],
    ["top user onboarding tools", 110],
  ];

  it("buys one seed, selects over the suggestions alone at 50/mo, and sizes rivals in the presence stage", async () => {
    // An established market is an established site's: its footprint admits
    // every search here under the demand ceiling (issue 830).
    measureDomain.mockResolvedValue({ ...MEASUREMENT, ownRanked: measured(30_000, AT) });
    keywordSuggestions.mockImplementation(async () => suggestions(ESTABLISHED));
    await deepPass();

    expect(keywordSuggestions).toHaveBeenCalledTimes(1);
    const expected = selectTwelve({
      profile: PROFILE,
      ownRanked: 30_000,
      market: ESTABLISHED.map(([keyword, volume]) => ({ keyword, volume })),
    });
    expect(expected).toHaveLength(12);

    const report = storedReport();
    const selected = report.questions.kind === "measured" ? report.questions.value.map((q) => q.search) : [];
    expect(selected).toEqual(expected);
    expect(selected.every((search) => search.floor === 50)).toBe(true);
    expect(rankedKeywords).toHaveBeenCalledTimes(RIVALS.length);
  });
});
