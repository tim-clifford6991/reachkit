// tests/scan/run/page-questions.test.ts — SPEC §6 (2026-09-20, #908; both
// numbers confirmed as written by the owner 2026-09-21, §12 · #985), issue
// #919.
//
// "Each published page's own question may join the tracked set: **at most
// 24 tracked questions in all** (the twelve plus twelve) … and a page's
// question leaves the set after **8 weeks** without a mention. The set
// never grows past the cap, so its cost is flat."
//
// The done-when, put to the pipeline: **with 30 live pages the pass still
// asks exactly 24 questions**. The cap arithmetic itself is pure and is
// tested with no database in `tests/market/questions/tracked.test.ts`; this
// suite is about the pass — that it asks the questions the arithmetic
// chose, that what it buys per question is one SERP and the two engines,
// that the twelve and the score are untouched by any of it, and that a page
// question never runs before or instead of a market question.
//
// The mutations it exists to kill:
//
//  - asking a page question at a tier whose parameters say no (a free scan
//    with a site would buy 12 SERPs nobody asked for);
//  - asking every live page — the unbounded set the owner's worry names;
//  - putting a page question into `serps`, `battery` or `aiAnswers`, which
//    would move a published score the week a page is published;
//  - asking the pages before the twelve, or in their budget's place;
//  - a retired question keeping its slot, or a retirement losing the
//    history behind it.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { captureStages, fakeDb, type DbQuery } from "./harness";
import { measured, measuredZero, unmeasured } from "../../../src/lib/measure/measured";
import {
  BATTERY as BATTERY_PINS,
  PAGE_QUESTION_RETIRE_WEEKS,
  PRICE_BOOK,
  TRACKED_QUESTIONS_MAX,
} from "../../../src/lib/config/constants";
import type { DomainMeasurement } from "../../../src/lib/measure";
import type { StoredReport } from "../../../src/lib/scan/report";
import type { AiAnswer, RankedRow } from "../../../src/lib/vendors/dataforseo/types";
import { AT, ON_PAGE, PROFILE, ROBOTS, SERP, SELECTED, QUESTION } from "../report/fixtures";

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
vi.mock("@/lib/vendors/dataforseo", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/lib/vendors/dataforseo")>()),
  serpOrganic: (...a: unknown[]) => serpOrganic(...a),
  aiMode: (...a: unknown[]) => aiMode(...a),
  llmScraper: (...a: unknown[]) => llmScraper(...a),
}));

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

vi.mock("@/lib/market/rivals/tracked", () => ({ trackedRivals: async () => null }));

const { runScan, TIER_PARAMETERS } = await import("../../../src/lib/scan/run");

const CLAIMED_ID = "33333333-3333-4333-8333-333333333333";
const SITE_ID = "55555555-5555-4555-8555-555555555555";
const DOMAIN = "example.com";
/** A rival's domain carrying none of the site's own brand token:
 *  `classifyReferences` counts the first label of the site's domain —
 *  "example" — appearing whole in a reference as a *mention*, so a rival at
 *  "rival.example.net" would be read as this site being named. */
const RIVAL = "othersite.net";

/** Thirty live pages, each written for its own search, each ranking where
 *  its number says — page 1 nearest the first page. */
const LIVE_PAGES = 30;

function searchOf(n: number): string {
  return `crm question ${n}`;
}

function publicationRow(n: number): Record<string, unknown> {
  return {
    id: `pub-${String(n).padStart(2, "0")}`,
    live_url: `https://content.example.com/page-${n}`,
    unpublished_at: null,
    drafts: {
      opportunities: {
        target_query: searchOf(n),
        acceptance: { form: "named_on", question: `Is page ${n} the answer?` },
      },
    },
  };
}

/** The customer's own ranked rows, which is where "nearest the first page"
 *  is read from — page 1 at position 1, page 30 at position 30. */
const OWN_RANKED_ROWS: RankedRow[] = Array.from({ length: LIVE_PAGES }, (_, i) => ({
  keyword: searchOf(i + 1),
  position: i + 1,
  searchVolume: 200,
  url: `https://content.example.com/page-${i + 1}`,
}));

const MEASUREMENT: DomainMeasurement = {
  drivers: {
    foundations: measured(52, AT),
    answerability: measured(38, AT),
    searchPresence: measuredZero(0, AT),
    aiPresence: unmeasured("not_attempted", AT),
  },
  text: { home: "A CRM for small teams.", pricing: null },
  onPage: measured(ON_PAGE, AT),
  pricing: null,
  robots: measured(ROBOTS, AT),
  ownRanked: measured(LIVE_PAGES, AT),
  ownRankedRows: OWN_RANKED_ROWS,
  homeRefusal: null,
};

const TWELVE = Array.from({ length: BATTERY_PINS.QUESTIONS }, (_, i) => ({
  ...QUESTION,
  id: `q${i}`,
  search: { ...SELECTED, keyword: `best crm for small teams ${i}` },
}));

const answered = (cited: string[]): AiAnswer => ({ answered: true, text: "…", citedDomains: cited });

function storedReport(): StoredReport {
  const call = storeCurrentReport.mock.calls.at(-1) as unknown as [{ report: StoredReport }];
  return call[0].report;
}

/** Which of the pass's several `scans` reads a query is: #919's history of
 *  the last eight weekly reports is the one that asks for the report column
 *  as well as the tier. The claim adoption asks for neither. */
function isHistoryRead(query: DbQuery): boolean {
  const columns = query.filters.map(([column]) => column);
  return query.table === "scans" && columns.includes("tier") && columns.includes("report");
}

/** How many live pages the next run sees, and what the weeks behind it
 *  said. Set per test; the double answers both reads from here. */
let livePages = LIVE_PAGES;
let history: unknown[] = [];

/** One stored week, as the history read gets it back: a report blob whose
 *  page-questions section asked `asked` and was named on `named`. */
function week(a: { asked: readonly number[]; named: readonly number[] }): Record<string, unknown> {
  return {
    week_start: "2026-08-31",
    report: {
      version: 11,
      pageQuestions: {
        measuredAt: AT.toJSON(),
        ownDomain: DOMAIN,
        tracked: BATTERY_PINS.QUESTIONS + a.asked.length,
        cap: TRACKED_QUESTIONS_MAX,
        retired: [],
        rows: a.asked.map((n) => ({
          publicationId: `pub-${String(n).padStart(2, "0")}`,
          liveUrl: `https://content.example.com/page-${n}`,
          question: { n: 12 + n, wording: { source: "model", text: `Is page ${n} the answer?` }, search: searchOf(n) },
          cell: { kind: "no_answer" },
          engines: [
            {
              engine: "ai_overview",
              cell: a.named.includes(n)
                ? { kind: "answered", citedDomains: [DOMAIN], namesCustomer: true }
                : { kind: "answered", citedDomains: [RIVAL], namesCustomer: false },
            },
          ],
        })),
      },
    },
  };
}

let stages: { lines: string[]; restore: () => void };

beforeEach(() => {
  vi.clearAllMocks();
  db.reset();
  livePages = LIVE_PAGES;
  history = [];
  db.rows.set("scans", [{ id: CLAIMED_ID, fromIncompleteRescan: false }]);
  db.answer = (query) => {
    if (query.table === "publications") {
      return Array.from({ length: livePages }, (_, i) => publicationRow(i + 1));
    }
    if (isHistoryRead(query)) return history;
    return null;
  };
  measureDomain.mockResolvedValue(MEASUREMENT);
  deriveProfile.mockResolvedValue(measured(PROFILE, AT));
  deriveMarketSet.mockResolvedValue(measured([{ keyword: SELECTED.keyword, volume: SELECTED.volume }], AT));
  phraseQuestions.mockResolvedValue(measured(TWELVE, AT));
  serpOrganic.mockResolvedValue(measured(SERP, AT));
  aiMode.mockResolvedValue(measured(answered([RIVAL]), AT));
  llmScraper.mockResolvedValue(measured(answered(["example.com"]), AT));
  readCurrentReport.mockResolvedValue(null);
  storeCurrentReport.mockImplementation(async (a: { report: StoredReport }) => ({
    scanId: a.report.scanId,
    status: "done" as const,
  }));
  stages = captureStages();
});

afterEach(() => stages.restore());

/** The queries the SERP call was made with, in call order. */
function askedQueries(): string[] {
  return serpOrganic.mock.calls.map((call) => (call as unknown as [unknown, { query: string }])[1].query);
}

describe("SPEC §6 — with 30 live pages the pass still asks exactly 24 questions", () => {
  it("asks the twelve, then twelve page questions, and not one more", async () => {
    await runScan({ domain: DOMAIN, siteId: SITE_ID, scanId: CLAIMED_ID, tier: "weekly" });

    expect(serpOrganic).toHaveBeenCalledTimes(TRACKED_QUESTIONS_MAX);
    expect(llmScraper).toHaveBeenCalledTimes(TRACKED_QUESTIONS_MAX);
    expect(aiMode).toHaveBeenCalledTimes(TRACKED_QUESTIONS_MAX);

    const report = storedReport();
    expect(report.pageQuestions?.rows).toHaveLength(BATTERY_PINS.QUESTIONS);
    expect(report.pageQuestions?.tracked).toBe(TRACKED_QUESTIONS_MAX);
    expect(report.pageQuestions?.cap).toBe(TRACKED_QUESTIONS_MAX);
  });

  it("asks the pages nearest the first page, in that order, after every one of the twelve", async () => {
    await runScan({ domain: DOMAIN, siteId: SITE_ID, scanId: CLAIMED_ID, tier: "weekly" });

    const queries = askedQueries();
    // The twelve first — a page question never takes a market question's
    // turn, which is what makes "degrade page questions first" true.
    expect(queries.slice(0, BATTERY_PINS.QUESTIONS).sort()).toEqual(
      TWELVE.map((q) => q.search.keyword).sort()
    );
    expect(queries.slice(BATTERY_PINS.QUESTIONS)).toEqual(
      Array.from({ length: BATTERY_PINS.QUESTIONS }, (_, i) => searchOf(i + 1))
    );
  });

  it("the page half is what the cap has left, whatever the site has published", async () => {
    for (const [pages, expected] of [
      [0, 0],
      [3, 3],
      [12, 12],
      [30, 12],
      [200, 12],
    ] as const) {
      vi.clearAllMocks();
      livePages = pages;
      db.rows.set("scans", [{ id: CLAIMED_ID, fromIncompleteRescan: false }]);
      await runScan({ domain: DOMAIN, siteId: SITE_ID, scanId: CLAIMED_ID, tier: "weekly" });
      expect(serpOrganic, `${pages} live pages`).toHaveBeenCalledTimes(BATTERY_PINS.QUESTIONS + expected);
      expect(storedReport().pageQuestions?.rows ?? []).toHaveLength(expected);
    }
  });

  it("costs 0.24¢ a page question on the standard queue — flat, whatever is published", () => {
    // The price book's own rows, not a number typed here: one SERP, whose
    // AI Overview rides free, plus the battery's two engines.
    const perQuestion = PRICE_BOOK.SERP_STD_C + PRICE_BOOK.CHATGPT_SCRAPE_STD_C + PRICE_BOOK.AI_MODE_STD_C;
    expect(perQuestion).toBeCloseTo(0.24, 5);
    // The page half at its fullest, which is what the cap makes flat.
    expect(perQuestion * BATTERY_PINS.QUESTIONS).toBeCloseTo(2.88, 5);
  });
});

describe("SPEC §6 — beside the twelve, never inside them", () => {
  it("leaves the twelve's own record, the AI-answers card and the score exactly as they were", async () => {
    await runScan({ domain: DOMAIN, siteId: SITE_ID, scanId: CLAIMED_ID, tier: "weekly" });
    const withPages = storedReport();

    // The record halves the score and the cards are counted over are the
    // twelve's alone.
    expect(withPages.serps).toHaveLength(BATTERY_PINS.QUESTIONS);
    expect(withPages.aiAnswers?.rows).toHaveLength(BATTERY_PINS.QUESTIONS);
    expect(withPages.aiAnswers?.measuredSearches).toBe(BATTERY_PINS.QUESTIONS);

    // And the proof that nothing leaked: the same pass with no published
    // page at all scores identically.
    vi.clearAllMocks();
    livePages = 0;
    db.rows.set("scans", [{ id: CLAIMED_ID, fromIncompleteRescan: false }]);
    await runScan({ domain: DOMAIN, siteId: SITE_ID, scanId: CLAIMED_ID, tier: "weekly" });
    const without = storedReport();

    expect(withPages.verdict.scoreAndBand).toEqual(without.verdict.scoreAndBand);
    expect(withPages.verdict.factors).toEqual(without.verdict.factors);
    expect(withPages.aiAnswers).toEqual(without.aiAnswers);
    expect(without.pageQuestions).toBeNull();
  });

  it("numbers the page questions on from the twelve, and carries each page's own address", async () => {
    await runScan({ domain: DOMAIN, siteId: SITE_ID, scanId: CLAIMED_ID, tier: "weekly" });
    const rows = storedReport().pageQuestions?.rows ?? [];

    expect(rows.map((row) => row.question.n)).toEqual(
      Array.from({ length: BATTERY_PINS.QUESTIONS }, (_, i) => BATTERY_PINS.QUESTIONS + i + 1)
    );
    expect(rows[0]?.publicationId).toBe("pub-01");
    expect(rows[0]?.liveUrl).toBe("https://content.example.com/page-1");
    // The opportunity's own asked-as form, never a question composed here.
    expect(rows[0]?.question.wording.text).toBe("Is page 1 the answer?");
    expect(rows[0]?.question.search).toBe(searchOf(1));
    // Three engine columns, the AI Overview first, exactly as a tracked
    // question's row carries them.
    expect(rows[0]?.engines.map((column) => column.engine)).toEqual(["ai_overview", "ai_mode", "chatgpt"]);
  });
});

describe("SPEC §6 — a page's question leaves the set after 8 weeks without a mention", () => {
  it("retires the page whose weeks ran out, records it, and gives its slot to the next candidate", async () => {
    // Eight weekly passes asked page 1 and page 2; page 2 was named on the
    // newest of them, page 1 on none.
    history = Array.from({ length: PAGE_QUESTION_RETIRE_WEEKS }, (_, i) =>
      week({ asked: [1, 2], named: i === 0 ? [2] : [] })
    );

    await runScan({ domain: DOMAIN, siteId: SITE_ID, scanId: CLAIMED_ID, tier: "weekly" });
    const section = storedReport().pageQuestions;

    expect(section?.retired.map((page) => page.publicationId)).toEqual(["pub-01"]);
    expect(section?.retired[0]?.weeksWithoutMention).toBe(PAGE_QUESTION_RETIRE_WEEKS);
    expect(section?.retired[0]?.question).toBe("Is page 1 the answer?");

    const asked = (section?.rows ?? []).map((row) => row.publicationId);
    expect(asked).not.toContain("pub-01");
    expect(asked).toContain("pub-02");
    // The set is still full: the thirteenth page took the retired slot.
    expect(asked).toHaveLength(BATTERY_PINS.QUESTIONS);
    expect(asked).toContain("pub-13");
    expect(section?.tracked).toBe(TRACKED_QUESTIONS_MAX);
  });

  it("a week that named the page resets the run — seven misses is not eight", async () => {
    history = Array.from({ length: PAGE_QUESTION_RETIRE_WEEKS }, (_, i) =>
      week({ asked: [1], named: i === 6 ? [1] : [] })
    );
    await runScan({ domain: DOMAIN, siteId: SITE_ID, scanId: CLAIMED_ID, tier: "weekly" });

    const section = storedReport().pageQuestions;
    expect(section?.retired).toEqual([]);
    expect((section?.rows ?? []).map((row) => row.publicationId)).toContain("pub-01");
  });

  it("a history nobody can read retires nothing", async () => {
    // A blob this build cannot read is a week we know nothing about, not a
    // week the answer was no — and losing a slot is permanent.
    history = [{ week_start: "2026-08-31", report: { version: 2 } }];
    await runScan({ domain: DOMAIN, siteId: SITE_ID, scanId: CLAIMED_ID, tier: "weekly" });
    expect(storedReport().pageQuestions?.retired).toEqual([]);
  });
});

describe("SPEC §6 — which passes ask them at all", () => {
  it("is a tier parameter: the weekly pass alone", () => {
    expect(TIER_PARAMETERS.free.pageQuestions).toBe(false);
    expect(TIER_PARAMETERS.deep.pageQuestions).toBe(false);
    expect(TIER_PARAMETERS.weekly.pageQuestions).toBe(true);
  });

  it.each(["free", "deep"] as const)("%s asks none, even for a site with thirty live pages", async (tier) => {
    // Both adopt a claimed row rather than being handed one, which is what
    // `db.rows` above holds for them.
    await runScan({ domain: DOMAIN, siteId: SITE_ID, tier });
    expect(serpOrganic).toHaveBeenCalledTimes(BATTERY_PINS.QUESTIONS);
    expect(storedReport().pageQuestions).toBeNull();
  });

  it("a pass with no site asks none — the free path has no published page", async () => {
    await runScan({ domain: DOMAIN, tier: "weekly" });
    expect(serpOrganic).toHaveBeenCalledTimes(BATTERY_PINS.QUESTIONS);
    expect(storedReport().pageQuestions).toBeNull();
  });

  it("a database that will not answer about pages takes no measurement down", async () => {
    db.answer = (query) => (query.table === "publications" ? [] : null);
    await runScan({ domain: DOMAIN, siteId: SITE_ID, scanId: CLAIMED_ID, tier: "weekly" });
    const report = storedReport();
    expect(report.pageQuestions).toBeNull();
    expect(report.aiAnswers?.rows).toHaveLength(BATTERY_PINS.QUESTIONS);
  });
});
