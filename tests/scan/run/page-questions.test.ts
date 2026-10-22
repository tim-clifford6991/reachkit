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
import { measured, measuredZero, unmeasured, type Measured } from "../../../src/lib/measure/measured";
import {
  ASYNC_AIO_SURCHARGE_MULTIPLIER,
  BATTERY as BATTERY_PINS,
  CAPS,
  PAGE_QUESTION_RETIRE_WEEKS,
  PRICE_BOOK,
  TRACKED_QUESTIONS_MAX,
  TYPING_RESERVE_C,
  VENDOR,
  WEEKLY_RIVAL_RESIZES,
} from "../../../src/lib/config/constants";
import type { CostContext } from "../../../src/lib/costs";
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

/** The customer's own ranked rows, which is where a page with no reading yet
 *  is placed from — page 1 at position 11, page 30 at position 40, so pages
 *  1 to 20 are climbing at 11–30 in their own order. */
const OWN_RANKED_ROWS: RankedRow[] = Array.from({ length: LIVE_PAGES }, (_, i) => ({
  keyword: searchOf(i + 1),
  position: i + 11,
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
  locale: { country: "US", language: "en" },
  localeFellBack: null,
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
    // D19 (issue 1162): the weekly twelve keep their Google searches alone;
    // a page's own question still asks both engines.
    expect(llmScraper).toHaveBeenCalledTimes(BATTERY_PINS.QUESTIONS);
    expect(aiMode).toHaveBeenCalledTimes(BATTERY_PINS.QUESTIONS);

    const report = storedReport();
    expect(report.pageQuestions?.rows).toHaveLength(BATTERY_PINS.QUESTIONS);
    expect(report.pageQuestions?.tracked).toBe(TRACKED_QUESTIONS_MAX);
    expect(report.pageQuestions?.cap).toBe(TRACKED_QUESTIONS_MAX);
  });

  it("asks the pages climbing at 11–30, nearest first, after every one of the twelve", async () => {
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
});

describe("owner B2 — each page slot's result is read deep enough to see the page", () => {
  /** The page slots' SERP calls, after the twelve's. */
  const pageCalls = () =>
    (serpOrganic.mock.calls as unknown as [unknown, { query: string; depth?: number }][]).map((call) => call[1]).slice(BATTERY_PINS.QUESTIONS);

  it("a page seen nowhere yet is read 100 deep, and its stored row says so", async () => {
    measureDomain.mockResolvedValue({ ...MEASUREMENT, ownRankedRows: [] });
    await runScan({ domain: DOMAIN, siteId: SITE_ID, scanId: CLAIMED_ID, tier: "weekly" });

    expect(pageCalls().map((call) => call.depth)).toEqual(Array(BATTERY_PINS.QUESTIONS).fill(100));
    // The twelve keep the ten-deep read.
    const twelve = (serpOrganic.mock.calls as unknown as [unknown, { depth?: number }][]).slice(0, BATTERY_PINS.QUESTIONS);
    expect(twelve.every((call) => call[1].depth === undefined)).toBe(true);
    expect(storedReport().pageQuestions?.rows.map((row) => row.depth)).toEqual(Array(BATTERY_PINS.QUESTIONS).fill(100));
  });

  it("a page last seen at 64 is read 80 deep, and one at 11 is read 30 deep", async () => {
    livePages = 2;
    measureDomain.mockResolvedValue({ ...MEASUREMENT, ownRankedRows: [OWN_RANKED_ROWS[0], { ...OWN_RANKED_ROWS[1], position: 64 }] });
    await runScan({ domain: DOMAIN, siteId: SITE_ID, scanId: CLAIMED_ID, tier: "weekly" });
    expect(pageCalls().map((call) => [call.query, call.depth])).toEqual([
      [searchOf(1), 30],
      [searchOf(2), 80],
    ]);
  });

  it("a thin market's slots past the first twelve read ten deep and say so, so the weekly spend stays flat", async () => {
    measureDomain.mockResolvedValue({ ...MEASUREMENT, ownRankedRows: [] });
    phraseQuestions.mockResolvedValue(measured(TWELVE.slice(0, 4), AT));
    await runScan({ domain: DOMAIN, siteId: SITE_ID, scanId: CLAIMED_ID, tier: "weekly" });

    const deep = TRACKED_QUESTIONS_MAX - BATTERY_PINS.QUESTIONS;
    const rows = storedReport().pageQuestions?.rows ?? [];
    expect(rows).toHaveLength(TRACKED_QUESTIONS_MAX - 4);
    const depthOf = new Map(
      (serpOrganic.mock.calls as unknown as [unknown, { query: string; depth?: number }][]).map((call) => [call[1].query, call[1].depth])
    );
    expect(rows.map((row) => depthOf.get(row.question.search))).toEqual([
      ...Array(deep).fill(100),
      ...Array(rows.length - deep).fill(VENDOR.serpDepth),
    ]);
    expect(rows.map((row) => row.depth)).toEqual([...Array(deep).fill(100), ...Array(rows.length - deep).fill(VENDOR.serpDepth)]);
  });
});

// Owner W1 beside owner B2: the stages stop at the weekly cap less the typing
// reserve, and the page slots now read 100 deep. Every double below ledgers
// through the pass's own cost context at what the seam charges for that call
// (`tests/scan/page-questions-ledger.test.ts` holds the seam to those prices).
describe("owner W1 — a week's deep page reads fit inside the cap less the typing reserve", () => {
  const ledger = async <T>(c: CostContext, key: string, cents: number, value: Measured<T>): Promise<Measured<T>> => {
    const paid = await c.recordFetch({ source: key.split("|")[0] ?? key, cacheKey: key, freshnessDays: 0, costCents: cents, run: async () => value });
    return "skipped" in paid ? unmeasured<T>("not_attempted", AT) : paid.payload;
  };

  /** A placed site's own market, so the pass builds and asks the 25 tracked prompts. */
  const SITE = {
    domain: DOMAIN,
    category: "crm software",
    competitors: [],
    tracked_prompts: null,
    market: {
      current: {
        category: "crm software",
        synonyms: ["sales crm", "contact manager", "pipeline tool"],
        buyer: "Small sales teams",
        job: "Keep every deal in one place",
        rivals: [
          { domain: RIVAL, name: "Othersite", basis: "ranks", reason: "" },
          { domain: "pipedrive.com", name: "Pipedrive", basis: "ranks", reason: "" },
          { domain: "hubspot.com", name: "HubSpot", basis: "ranks", reason: "" },
        ],
      },
    },
  };

  /** What the stages left on the scan row when the pass closed. */
  const closedCents = (): number =>
    db.queries.filter((q) => q.table === "scans" && q.verb === "update" && q.values?.cost_cents !== undefined).at(-1)?.values
      ?.cost_cents as number;

  beforeEach(() => {
    db.rows.set("sites", [SITE]);
    // Pages nobody has seen yet, so every deep slot reads 100 deep.
    measureDomain.mockImplementation(async (c: CostContext) => {
      // The weekly site read buys its own ranked rows, and the pass re-sizes its due rivals before the asks.
      await ledger(c, "ranked|own", PRICE_BOOK.RANKED_PAID_COST_C, measured(0, AT));
      await ledger(c, "ranked|rival", WEEKLY_RIVAL_RESIZES * PRICE_BOOK.RANKED_RIVAL_COST_C, measured(0, AT));
      return { ...MEASUREMENT, ownRankedRows: [] };
    });
    serpOrganic.mockImplementation(
      (c: CostContext, call: { query: string; depth?: number; priority?: "high"; loadAsyncAiOverview: boolean }) => {
        const pages = Math.ceil((call.depth ?? VENDOR.serpDepth) / 10);
        const base = call.priority === "high" ? PRICE_BOOK.SERP_STD_HIGH_C : PRICE_BOOK.SERP_STD_C;
        const cents = call.loadAsyncAiOverview ? base * (pages + ASYNC_AIO_SURCHARGE_MULTIPLIER - 1) : base * pages;
        return ledger(c, `serp|${call.query}`, cents, measured(SERP, AT));
      }
    );
    llmScraper.mockImplementation((c: CostContext, call: { query: string; run?: number }) =>
      ledger(c, `chatgpt|${call.query}|${call.run ?? 1}`, PRICE_BOOK.CHATGPT_SCRAPE_STD_C, measured(answered(["example.com"]), AT))
    );
    aiMode.mockImplementation((c: CostContext, call: { query: string; run?: number }) =>
      ledger(c, `ai_mode|${call.query}|${call.run ?? 1}`, PRICE_BOOK.AI_MODE_STD_C, measured(answered([RIVAL]), AT))
    );
  });

  it("a full market: all twelve page slots and all 54 prompt asks are bought, and the pass closes under the cap less the reserve", async () => {
    await runScan({ domain: DOMAIN, siteId: SITE_ID, scanId: CLAIMED_ID, tier: "weekly" });

    const report = storedReport();
    const rows = report.pageQuestions?.rows ?? [];
    expect(rows).toHaveLength(BATTERY_PINS.QUESTIONS);
    expect(rows.every((row) => row.depth === 100 && row.organic !== null && row.cell.kind !== "unmeasured")).toBe(true);
    expect(report.prompts?.answers).toHaveLength(54);
    expect(closedCents()).toBeGreaterThan(0);
    expect(closedCents()).toBeLessThanOrEqual(CAPS.WEEKLY_C - TYPING_RESERVE_C);
  });

  it("a thin market's 24 slots cost more than the stages may spend: the pass closes under the line, and a slot it did not reach says not attempted, never 0", async () => {
    phraseQuestions.mockResolvedValue(measured([], AT));
    await runScan({ domain: DOMAIN, siteId: SITE_ID, scanId: CLAIMED_ID, tier: "weekly" });

    const rows = storedReport().pageQuestions?.rows ?? [];
    expect(rows).toHaveLength(TRACKED_QUESTIONS_MAX);
    expect(closedCents()).toBeLessThanOrEqual(CAPS.WEEKLY_C - TYPING_RESERVE_C);
    const unreached = rows.filter((row) => row.organic === null);
    expect(unreached.length).toBeGreaterThan(0);
    for (const row of unreached) {
      expect(row.cell).toEqual({ kind: "unmeasured", reason: "not_attempted" });
      expect(row.engines.every((column) => column.cell.kind !== "no_answer" && column.cell.kind !== "answered")).toBe(true);
    }
  });
});

describe("a page's own question is put to the engines as a buyer asks it (owner B2)", () => {
  /** The queries ChatGPT was asked: on a weekly pass, only the page questions. */
  const chatgptAsked = () => (llmScraper.mock.calls as unknown as [unknown, { query: string }][]).map((call) => call[1].query);

  it("asks the page's own question, never its search", async () => {
    livePages = 2;
    await runScan({ domain: DOMAIN, siteId: SITE_ID, scanId: CLAIMED_ID, tier: "weekly" });
    expect(chatgptAsked()).toEqual(["Is page 1 the answer?", "Is page 2 the answer?"]);
  });

  it("a local placed site asks it with its town", async () => {
    livePages = 2;
    measureDomain.mockResolvedValue({ ...MEASUREMENT, locale: { country: "US", language: "en", place: { name: "Austin" } } });
    await runScan({ domain: DOMAIN, siteId: SITE_ID, scanId: CLAIMED_ID, tier: "weekly" });
    expect(chatgptAsked()).toEqual(["Is page 1 the answer in Austin?", "Is page 2 the answer in Austin?"]);
    const aiModeAsked = (aiMode.mock.calls as unknown as [unknown, { query: string }][]).map((call) => call[1].query);
    expect(aiModeAsked).toEqual(chatgptAsked());
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
    // page at all reads the same presence and the same AI answers. Its
    // Content differs, because the published pages are measured pages of
    // the site (issue 1551).
    vi.clearAllMocks();
    livePages = 0;
    db.rows.set("scans", [{ id: CLAIMED_ID, fromIncompleteRescan: false }]);
    await runScan({ domain: DOMAIN, siteId: SITE_ID, scanId: CLAIMED_ID, tier: "weekly" });
    const without = storedReport();

    expect(withPages.verdict.factors.presence).toEqual(without.verdict.factors.presence);
    expect(withPages.verdict.factors.foundations).toEqual(without.verdict.factors.foundations);
    expect(withPages.aiAnswers).toEqual(without.aiAnswers);
    expect(without.pageQuestions).toBeNull();
  });

  it("reads ReachKit's live pages as measured pages of the site, up to the allowance (issue 1551)", async () => {
    const log = vi.spyOn(console, "log");
    await runScan({ domain: DOMAIN, siteId: SITE_ID, scanId: CLAIMED_ID, tier: "weekly" });
    const events = log.mock.calls.map(([line]) => (typeof line === "string" && line.startsWith("{") ? (JSON.parse(line) as { event?: string; pages?: number }) : {}));
    log.mockRestore();
    expect(events.find((e) => e.event === "measured_pages")).toMatchObject({ domain: DOMAIN, pages: BATTERY_PINS.MEASURED_PAGES_MAX });
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
