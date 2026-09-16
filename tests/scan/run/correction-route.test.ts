// tests/scan/run/correction-route.test.ts — #786.
//
// The report's "Not your market?" posts to the correction route, and the
// report follows the rerun by the id the route answers. This suite drives
// that whole path with nothing real doubled but the vendors and the
// database: the real route, the real correction seam `run.ts` registers,
// the real `runScan` and its stage log. It is the check that a correction
// the route accepts is a pass that runs — under the id the visitor was
// handed, seeded on the market they gave — and not a row nobody claimed.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { captureStages, fakeDb, type DbQuery } from "./harness";
import { measured, measuredZero, unmeasured, type Measured } from "../../../src/lib/measure/measured";
import type { DomainMeasurement } from "../../../src/lib/measure";
import type { SerpResult } from "../../../src/lib/vendors/dataforseo/types";
import type { StoredReport } from "../../../src/lib/scan/report";
import { AT, ON_PAGE, PROFILE, ROBOTS, SERP, SELECTED, QUESTION } from "../report/fixtures";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

const { afterTasks } = vi.hoisted(() => ({ afterTasks: [] as (() => Promise<void>)[] }));
vi.mock("next/server", () => ({
  after: (task: () => Promise<void>) => {
    afterTasks.push(task);
  },
}));

// Admission reads Postgres directly; the correction asks it one thing (is
// the domain removed) and must never claim an allowance.
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

const { POST } = await import("../../../src/app/api/report/[domain]/correct/route");

const DOMAIN = "example.com";
const CORRECTED = "44444444-4444-4444-8444-444444444444";
const CATEGORY = "employee scheduling software";

const KEYWORDS = Array.from({ length: 12 }, (_, i) => `employee scheduling software ${i + 1}`);
const TWELVE = KEYWORDS.map((keyword, i) => ({ ...SELECTED, keyword, rank: i + 1 }));

function measurement(): DomainMeasurement {
  return {
    drivers: {
      foundations: measured(52, AT),
      answerability: measured(38, AT),
      searchPresence: measuredZero(0, AT),
      aiPresence: unmeasured("not_attempted", AT),
    },
    text: { home: "Scheduling for shift teams.", pricing: null },
    onPage: measured(ON_PAGE, AT),
    pricing: null,
    robots: measured(ROBOTS, AT),
    ownRanked: measuredZero(0, AT),
    homeRefusal: null,
  };
}

/** The domain's current report, as `readCorrectionFacts` reads it, and the
 *  conditional state write the route and the pass each make. */
let correctionState = "none";
function answer(query: DbQuery): unknown[] | null {
  if (query.table !== "scans") return null;
  const filters = new Map(query.filters);
  if (query.verb === "select" && filters.get("is_current") === true) {
    return [
      {
        id: CORRECTED,
        created_at: new Date(Date.now() - 86_400_000).toISOString(),
        correction_state: correctionState,
        report: { market: { kind: "measured", value: { profile: { category: "user onboarding software" } } } },
      },
    ];
  }
  if (query.verb === "update" && filters.has("correction_state")) {
    if (filters.get("correction_state") !== correctionState) return [];
    correctionState = String(query.values?.correction_state);
    return [{ id: CORRECTED }];
  }
  return null;
}

function post(category: string): Promise<Response> {
  const request = new Request(`https://app.example.com/api/report/${DOMAIN}/correct`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ category }),
  });
  return POST(request, { params: Promise.resolve({ domain: DOMAIN }) });
}

let stages: { lines: string[]; restore: () => void };

beforeEach(() => {
  vi.clearAllMocks();
  db.reset();
  db.answer = answer;
  correctionState = "none";
  afterTasks.length = 0;
  measureDomain.mockResolvedValue(measurement());
  deriveProfile.mockResolvedValue(measured(PROFILE, AT));
  deriveMarketSet.mockResolvedValue(
    measured(
      TWELVE.map((search) => ({ keyword: search.keyword, volume: search.volume })),
      AT
    )
  );
  phraseQuestions.mockResolvedValue(
    measured(
      TWELVE.map((search, i) => ({ ...QUESTION, id: `q${i + 1}`, search })),
      AT
    )
  );
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

describe("the report's correction, through the real route and the real pass (#786)", () => {
  it("answers with a claimed row's id at once, then the pass runs under that id on the corrected market", async () => {
    const response = await post(CATEGORY);
    expect(response.status).toBe(200);
    const body = (await response.json()) as { ok: true; scanId: string };
    expect(body.ok).toBe(true);

    // The row the report's progress stream reads exists before the answer.
    const claims = db.queries.filter((q) => q.table === "scans" && q.verb === "insert");
    expect(claims).toHaveLength(1);
    expect(claims[0]?.values).toMatchObject({ id: body.scanId, domain: DOMAIN, tier: "free", status: "running" });
    expect(correctionState).toBe("running");
    expect(storeCurrentReport).not.toHaveBeenCalled();

    // The pass outlives the response, handed to `after()`.
    expect(afterTasks).toHaveLength(1);
    await afterTasks[0]!();

    // Measured, not `no_claimed_slot`: every stage ran, each recorded
    // against the id the visitor holds.
    expect(measureDomain).toHaveBeenCalledTimes(1);
    const recorded = db.rpcCalls.filter((c) => c.fn === "append_scan_stage_event");
    expect(recorded.length).toBeGreaterThan(0);
    expect(new Set(recorded.map((c) => c.args.p_scan_id))).toEqual(new Set([body.scanId]));

    // Seeded on the market the visitor gave, and it replaces the report it corrects.
    expect(deriveMarketSet).toHaveBeenCalledWith(expect.anything(), { seeds: [CATEGORY] });
    const stored = (storeCurrentReport.mock.calls.at(-1) as unknown as [{ supersedesScanId?: string; report: StoredReport }])[0];
    expect(stored.report.scanId).toBe(body.scanId);
    expect(stored.supersedesScanId).toBe(CORRECTED);
    expect(stored.report.correctionState).toBe("used");
    expect(correctionState).toBe("used");

    // No free-scan allowance was asked for or spent.
    expect(admitFreeScan).not.toHaveBeenCalled();
    expect(claimFreeScanSlot).not.toHaveBeenCalled();
  });

  it("one correction per report: a second submission is refused and starts nothing", async () => {
    await post(CATEGORY);
    await afterTasks[0]!();
    const inserts = db.queries.filter((q) => q.verb === "insert").length;

    const again = await post("something else");
    expect(again.status).toBe(409);
    expect(await again.json()).toEqual({ ok: false, refused: "used" });
    expect(db.queries.filter((q) => q.verb === "insert")).toHaveLength(inserts);
    expect(afterTasks).toHaveLength(1);
  });
});
