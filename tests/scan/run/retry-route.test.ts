// tests/scan/run/retry-route.test.ts — SPEC §2, issue 715.
//
// "Retry this part" posts to the retry route, and the report follows the
// re-measurement by the id the route answers. This suite drives that whole
// path with nothing real doubled but the vendors and the database: the real
// route, the real seam `run.ts` registers, the real `runScan` and its stage
// log — the same arrangement `correction-route.test.ts` beside it uses, and
// for the same reason.
//
// The three claims that make the owner's ruling of 2026-09-22 true:
//
//   1. it **re-runs only that part** — the market is read back off the
//      stored report, so no profile call, no suggestions call and no
//      phrasing call is made, and a part whose stage is not the twelve's
//      does not ask the twelve either;
//   2. it is **inside the same budget** — the pass opens on the retried
//      row's own spend and claims no free-scan allowance, and a report that
//      has spent the 12¢ is refused before anything is claimed;
//   3. it **never leaves the report with less on it** — a section this pass
//      did not re-measure is carried forward from the report it retried.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { captureStages, fakeDb, type DbQuery } from "./harness";
import { measured, measuredZero, unmeasured, type Measured } from "../../../src/lib/measure/measured";
import type { DomainMeasurement } from "../../../src/lib/measure";
import type { SerpResult } from "../../../src/lib/vendors/dataforseo/types";
import type { StoredReport } from "../../../src/lib/scan/report";
import { AT, ON_PAGE, ROBOTS, SERP } from "../report/fixtures";
import { fullSections } from "../report/fixtures";
import { assembleReport } from "../../../src/lib/scan/store";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

const { afterTasks } = vi.hoisted(() => ({ afterTasks: [] as (() => Promise<void>)[] }));
vi.mock("next/server", () => ({
  after: (task: () => Promise<void>) => {
    afterTasks.push(task);
  },
}));

const claimFreeScanSlot = vi.fn();
const admitFreeScan = vi.fn();
vi.mock("@/lib/scan/admission", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/lib/scan/admission")>()),
  isDomainRemoved: async () => false,
  claimFreeScanSlot: (...a: unknown[]) => claimFreeScanSlot(...a),
  admitFreeScan: (...a: unknown[]) => admitFreeScan(...a),
}));

const measureDomain = vi.fn();
vi.mock("@/lib/measure", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/lib/measure")>()),
  measureDomain: (...args: unknown[]) => measureDomain(...args),
}));

vi.mock("@/lib/site-profile", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/lib/site-profile")>()),
  buildSiteProfileWithCrawl: async () => ({
    profile: null,
    crawl: { pages: [], discovered: 0, stoppedBy: "complete", fetched: [], broken: [], sitemap: "absent" },
  }),
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
vi.mock("@/lib/vendors/dataforseo", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/lib/vendors/dataforseo")>()),
  serpOrganic: (...a: unknown[]) => serpOrganic(...a),
}));

const storeCurrentReport = vi.fn();
vi.mock("@/lib/scan/store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/lib/scan/store")>()),
  storeCurrentReport: (...a: unknown[]) => storeCurrentReport(...a),
}));

const { POST } = await import("../../../src/app/api/report/[domain]/retry/route");

const DOMAIN = "example.com";
const RETRIED = "55555555-5555-4555-8555-555555555555";

function measurement(): DomainMeasurement {
  return {
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
    ownRanked: measuredZero(0, AT),
    ownRankedRows: [],
    locale: { country: "US", language: "en" },
    localeFellBack: null,
    homeRefusal: null,
  };
}

/** The report the retry starts from: a pass a ceiling stopped, whose
 *  market and twelve are measured and whose AI-answers card and first page
 *  it never reached. As the row holds it — JSON, so the read revives its
 *  own dates exactly as it does in production. */
function storedCutOff(over: Parameters<typeof fullSections>[0] = {}): unknown {
  const report = assembleReport(
    fullSections({ scanId: RETRIED, stoppedReason: "time_ceiling", aiAnswers: null, freePage: null, ...over })
  );
  return JSON.parse(JSON.stringify(report)) as unknown;
}

/** What the row holds, per test. */
let row = { report: storedCutOff(), cost_cents: 4.73 as number };

function answer(query: DbQuery): unknown[] | null {
  if (query.table !== "scans") return null;
  const filters = new Map(query.filters);
  // Both reads this path makes — the domain's current report (the offer)
  // and the retried row by id (its spend and its report) — land here.
  if (query.verb === "select" && (filters.get("is_current") === true || filters.get("id") === RETRIED)) {
    return [{ id: RETRIED, cost_cents: row.cost_cents, report: row.report }];
  }
  return null;
}

function post(part: string): Promise<Response> {
  const request = new Request(`https://app.example.com/api/report/${DOMAIN}/retry`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ part }),
  });
  return POST(request, { params: Promise.resolve({ domain: DOMAIN }) });
}

let stages: { lines: string[]; restore: () => void };

beforeEach(() => {
  vi.clearAllMocks();
  db.reset();
  db.answer = answer;
  row = { report: storedCutOff(), cost_cents: 4.73 };
  afterTasks.length = 0;
  measureDomain.mockResolvedValue(measurement());
  serpOrganic.mockResolvedValue(measured(SERP, AT) as Measured<SerpResult>);
  storeCurrentReport.mockImplementation(async (a: { report: StoredReport }) => ({
    scanId: a.report.scanId,
    status: "done" as const,
  }));
  stages = captureStages();
});

afterEach(() => {
  stages.restore();
});

describe("the report's per-part retry, through the real route and the real pass (issue 715)", () => {
  it("answers a claimed row's id at once, then re-runs only that part on the market the report already has", async () => {
    const response = await post("ai_answers");
    expect(response.status).toBe(200);
    const body = (await response.json()) as { ok: true; scanId: string };
    expect(body.ok).toBe(true);

    // The row the report's progress stream reads exists before the answer.
    const claims = db.queries.filter((q) => q.table === "scans" && q.verb === "insert");
    expect(claims).toHaveLength(1);
    expect(claims[0]?.values).toMatchObject({ id: body.scanId, domain: DOMAIN, tier: "free", status: "running" });
    expect(storeCurrentReport).not.toHaveBeenCalled();

    // The pass outlives the response, handed to `after()`.
    expect(afterTasks).toHaveLength(1);
    await afterTasks[0]!();

    // **Only that part.** The market came off the stored report, so none of
    // the three calls that derive one was made — they are the free pass's
    // two nano calls and its suggestions buy, and no cache returns them.
    expect(deriveProfile).not.toHaveBeenCalled();
    expect(deriveMarketSet).not.toHaveBeenCalled();
    expect(phraseQuestions).not.toHaveBeenCalled();
    // And the part itself was asked again.
    expect(serpOrganic).toHaveBeenCalled();

    // It supersedes the report it retried, under the id the visitor holds.
    const stored = (storeCurrentReport.mock.calls.at(-1) as unknown as [
      { supersedesScanId?: string; report: StoredReport },
    ])[0];
    expect(stored.report.scanId).toBe(body.scanId);
    expect(stored.supersedesScanId).toBe(RETRIED);
    // The part it retried is on it now, and the twelve it re-asked are the
    // stored report's own — same wording, same searches.
    expect(stored.report.aiAnswers).not.toBeNull();
    expect(stored.report.questions.kind).toBe("measured");

    // No free-scan allowance was asked for or spent.
    expect(admitFreeScan).not.toHaveBeenCalled();
    expect(claimFreeScanSlot).not.toHaveBeenCalled();
  });

  it("a part the stage of the twelve does not produce asks no question at all", async () => {
    await post("free_page");
    await afterTasks[0]!();
    // `scoring` buys nothing, so the retry bought nothing: the SERPs came
    // back out of the report rather than off the vendor.
    expect(serpOrganic).not.toHaveBeenCalled();
    const stored = (storeCurrentReport.mock.calls.at(-1) as unknown as [{ report: StoredReport }])[0];
    // And the card the report already had is still on it — a retry of one
    // part may never leave the report with less on it than it had.
    expect(stored.report.presence).not.toBeNull();
    expect(stored.report.serps.length).toBeGreaterThan(0);
  });

  it("refuses, and claims nothing, once the report's own 12¢ is spent", async () => {
    row = { report: storedCutOff(), cost_cents: 12 };
    const response = await post("ai_answers");
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ ok: false, refused: "no_budget_left" });
    expect(db.queries.filter((q) => q.verb === "insert")).toHaveLength(0);
    expect(afterTasks).toHaveLength(0);
  });

  it("refuses a part that is already on the report, and a report no ceiling stopped", async () => {
    const present = await post("presence");
    expect(present.status).toBe(409);
    expect(await present.json()).toEqual({ ok: false, refused: "part_present" });

    row = { report: JSON.parse(JSON.stringify(assembleReport(fullSections({ scanId: RETRIED, aiAnswers: null })))), cost_cents: 1 };
    const complete = await post("ai_answers");
    expect(complete.status).toBe(409);
    expect(await complete.json()).toEqual({ ok: false, refused: "not_cut_off" });
    expect(db.queries.filter((q) => q.verb === "insert")).toHaveLength(0);
  });

  it("a part that is not one of the three is malformed, not a refusal — no report state could be true of it", async () => {
    const response = await post("everything");
    expect(response.status).toBe(400);
    expect(db.queries.filter((q) => q.verb === "insert")).toHaveLength(0);
  });
});
