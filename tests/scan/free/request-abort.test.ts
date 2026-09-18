// tests/scan/free/request-abort.test.ts — issues 875 and 877
//
// **A free scan gives up on a stuck vendor call sooner** (owner ruling
// 2026-09-17, on issue 873's diagnosis).
//
// `asking_the_twelve` is 13 s at a fan-out of four, so a call held to the
// transport's 10 s bound took a quarter of that stage for almost all of it:
// on the free scans of 2026-09-17 the questions behind such a call were
// never asked, and two answers that did arrive were thrown away because the
// stage had already been abandoned.
//
// **The 5 s bound that answered it was wrong** (issue 877): the first free
// scan after it shipped aborted 5 of its 7 calls and was billed for all of
// them. Every tier is back on the transport's 10 s, the bound is still
// carried per call so a tier can be given its own figure later, and what
// these calls take is now recorded on the ledger row — which is where the
// next value comes from.
//
// The abort is asserted where it is actually applied — the `AbortSignal`
// the transport hands `fetch` — and the vendor's own latency is simulated
// against it, so a call "answering at 7 s" is aborted on the free path and
// answered on a paid one. Doubled: the vendor's HTTP surface, the database,
// the customer's server and the model calls. Real: the transport, the
// envelope, `withCostContext`, the retry and the composition.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb } from "../run/harness";
import { envelope, setEnvFixture, stubVendorFetch } from "../../vendors/harness";
import { measured } from "../../../src/lib/measure/measured";
import type { StoredReport } from "../../../src/lib/scan/report";
import { AT, PROFILE, QUESTION, ROBOTS, SELECTED } from "../report/fixtures";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

vi.mock("@/lib/costs/daily", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/lib/costs/daily")>()),
  openDayLedger: async () => ({ spentCents: () => 0, refresh: async () => {}, ceilingReached: () => false, add: () => {} }),
}));

const HOME_HTML =
  "<html><head><title>Onboarding</title></head><body><h1>Onboarding for product teams</h1>" +
  "<h2>How does it work?</h2><p>Guided product tours that lift activation in the first week.</p></body></html>";

vi.mock("@/lib/egress/safe-fetch", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/lib/egress/safe-fetch")>()),
  safeFetch: async (url: string) => ({ ok: true, status: 200, url, html: HOME_HTML, bytes: HOME_HTML.length, readAt: AT, headers: {} }),
}));

vi.mock("@/lib/egress/robots", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/lib/egress/robots")>()),
  readRobots: async () => ROBOTS,
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

const selectTwelve = vi.fn();
vi.mock("@/lib/market/questions/select", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/lib/market/questions/select")>()),
  selectTwelve: (...a: unknown[]) => selectTwelve(...a),
}));

const phraseQuestions = vi.fn();
vi.mock("@/lib/market/questions/phrase", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/lib/market/questions/phrase")>()),
  phraseQuestions: (...a: unknown[]) => phraseQuestions(...a),
}));

// The paid tiers buy the battery, which is not this suite's subject and is
// a queued endpoint; it is doubled at its own boundary.
const aiMode = vi.fn();
const llmScraper = vi.fn();
vi.mock("@/lib/vendors/dataforseo", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/lib/vendors/dataforseo")>()),
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

setEnvFixture();
const { runScan, TIER_PARAMETERS } = await import("../../../src/lib/scan/run");
const { VENDOR, CAPS, BATTERY } = await import("../../../src/lib/config/constants");

const CLAIMED_ID = "50450450-4504-4504-8504-504504504504";
const DOMAIN = "example.com";
const SLOW = "best onboarding software 3";

const TWELVE = Array.from({ length: BATTERY.QUESTIONS }, (_, i) => ({
  ...SELECTED,
  keyword: `best onboarding software ${i}`,
  rank: i + 1,
}));

/** The aborts the transport asked for, in the order it asked. */
let aborts: number[];
/** Which abort each organic SERP request was issued under, by keyword. */
let asks: { keyword: string; abortMs: number; answered: boolean }[];

function serpBody(): unknown {
  return envelope({
    items: [{ type: "organic", rank_group: 1, domain: "rival.com", url: "https://rival.com/p", title: "Rival" }],
  });
}

function timeoutError(): Error {
  const error = new Error("The operation was aborted due to timeout");
  error.name = "TimeoutError";
  return error;
}

/**
 * The vendor, with one keyword that takes `latencyMs` to answer the first
 * time it is asked and answers at once when it is asked again — production's
 * own tail, where a query that was slow once is ordinarily fast next time.
 * A request whose abort is shorter than the latency never gets an answer.
 */
function vendorSlowOnce(latencyMs: number) {
  const seen = new Map<string, number>();
  return stubVendorFetch((request) => {
    if (!request.url.includes("/serp/google/organic")) return envelope({ items: [] });
    const keyword = String(request.task?.keyword ?? "");
    const attempt = (seen.get(keyword) ?? 0) + 1;
    seen.set(keyword, attempt);
    const abortMs = aborts.at(-1) ?? VENDOR.requestAbortMs;
    const slow = keyword === SLOW && attempt === 1;
    const answered = !slow || latencyMs <= abortMs;
    asks.push({ keyword, abortMs, answered });
    if (!answered) throw timeoutError();
    return serpBody();
  });
}

function storedReport(): StoredReport {
  return (storeCurrentReport.mock.calls.at(-1) as unknown as [{ report: StoredReport }])[0].report;
}

function organicAborts(): number[] {
  return asks.map((ask) => ask.abortMs);
}

beforeEach(() => {
  vi.clearAllMocks();
  db.reset();
  db.rows.set("scans", [{ id: CLAIMED_ID, fromIncompleteRescan: false }]);
  aborts = [];
  asks = [];
  // The abort the transport actually applies, captured where it is made.
  const real = AbortSignal.timeout.bind(AbortSignal);
  vi.spyOn(AbortSignal, "timeout").mockImplementation((ms: number) => {
    aborts.push(ms);
    return real(ms);
  });
  deriveProfile.mockResolvedValue(measured(PROFILE, AT));
  selectTwelve.mockReturnValue(TWELVE);
  deriveMarketSet.mockResolvedValue(
    measured(
      TWELVE.map((s) => ({ keyword: s.keyword, volume: s.volume })),
      AT
    )
  );
  phraseQuestions.mockImplementation(async (_c: unknown, a: { selected: readonly { keyword: string }[] }) =>
    measured(
      a.selected.map((search, i) => ({ ...QUESTION, id: `q${i + 1}`, search })),
      AT
    )
  );
  aiMode.mockResolvedValue(measured({ answered: true, text: "…", citedDomains: [] }, AT));
  llmScraper.mockResolvedValue(measured({ answered: true, text: "…", citedDomains: [] }, AT));
  readCurrentReport.mockResolvedValue(null);
  storeCurrentReport.mockImplementation(async (a: { report: StoredReport }) => ({
    scanId: a.report.scanId,
    status: "done" as const,
  }));
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("issue 875 — the abort is the tier's, and the transport carries it per call", () => {
  it("a free pass asks its questions under the ten-second abort (issue 877's reversion)", async () => {
    vendorSlowOnce(7_000);
    await runScan({ domain: DOMAIN, tier: "free" });

    expect(TIER_PARAMETERS.free.serpAbortMs).toBe(VENDOR.requestAbortMs);
    expect(organicAborts()).not.toHaveLength(0);
    expect(new Set(organicAborts())).toEqual(new Set([VENDOR.requestAbortMs]));
  });

  it("a deep pass keeps the ten-second one", async () => {
    vendorSlowOnce(7_000);
    await runScan({ domain: DOMAIN, tier: "deep" });

    expect(TIER_PARAMETERS.deep.serpAbortMs).toBe(VENDOR.requestAbortMs);
    expect(new Set(organicAborts())).toEqual(new Set([VENDOR.requestAbortMs]));
  });

  it("a weekly pass keeps it too", () => {
    expect(TIER_PARAMETERS.weekly.serpAbortMs).toBe(VENDOR.requestAbortMs);
  });
});

describe("issue 875 — a call the abort cuts short comes back through issue 865's retry", () => {
  it("the question is measured, asked twice, and the pass stays inside its cap", async () => {
    // Longer than any tier's bound, so it is aborted whatever the tier —
    // which is what issue 877 leaves this case proving.
    vendorSlowOnce(30_000);
    await runScan({ domain: DOMAIN, tier: "free" });

    // The slow one was aborted, then asked again after the sweep.
    const slowAsks = asks.filter((ask) => ask.keyword === SLOW);
    expect(slowAsks.map((ask) => ask.answered)).toEqual([false, true]);

    const report = storedReport();
    expect(report.serps).toHaveLength(BATTERY.QUESTIONS);
    expect(report.serps.every((serp) => serp.kind !== "unmeasured")).toBe(true);

    const spent = db.queries
      .filter((q) => q.table === "fetches" && q.verb === "insert")
      .reduce((sum, q) => sum + Number((q.values as unknown as { cost_cents: number }).cost_cents), 0);
    expect(spent).toBeLessThanOrEqual(CAPS.FREE_C);
  });

  it("nothing beyond that one retry is bought: twelve questions, thirteen asks", async () => {
    vendorSlowOnce(30_000);
    await runScan({ domain: DOMAIN, tier: "free" });

    expect(asks).toHaveLength(BATTERY.QUESTIONS + 1);
  });

  it("the same vendor on a deep pass answers first time — no abort, no retry", async () => {
    vendorSlowOnce(7_000);
    await runScan({ domain: DOMAIN, tier: "deep" });

    expect(asks.filter((ask) => ask.keyword === SLOW)).toHaveLength(1);
    expect(asks.every((ask) => ask.answered)).toBe(true);
  });
});

describe("issue 875 — an answer that arrives after its stage was abandoned is kept", () => {
  /** The vendor, with one question that answers only when this test says
   *  so — the call already in flight that a stage's clock cannot cancel. */
  function vendorHoldingOne(): { release: () => void } {
    let release = (): void => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    stubVendorFetch(async (request) => {
      if (!request.url.includes("/serp/google/organic")) return envelope({ items: [] });
      if (String(request.task?.keyword ?? "") === SLOW) await held;
      return serpBody();
    });
    return { release: () => release() };
  }

  it("the late cell is measured, not the arm that says nobody reached it", async () => {
    // The abort is not what this test is about, and a signal that fires on
    // real time while the stage runs on a fake clock would cut the held
    // call short: here nothing aborts, and the stage's own budget is what
    // ends the asking.
    vi.spyOn(AbortSignal, "timeout").mockImplementation(() => new AbortController().signal);
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    const vendor = vendorHoldingOne();

    // The answer lands while the pass is entering its scoring stage — the
    // window every real pass has, where the report is not yet composed.
    let landed = false;
    const pass = runScan({
      domain: DOMAIN,
      tier: "free",
      onStage: async (stage: string) => {
        if (stage !== "scoring" || landed) return;
        landed = true;
        vendor.release();
        await vi.advanceTimersByTimeAsync(0);
      },
    } as never);

    // Past `asking_the_twelve`'s own budget, so the stage is abandoned
    // with that one call still in flight.
    await vi.advanceTimersByTimeAsync(30_000);
    await pass;

    const report = storedReport();
    const slowIndex = TWELVE.findIndex((search) => search.keyword === SLOW);
    expect(report.serps[slowIndex]?.kind).not.toBe("unmeasured");
    expect(landed).toBe(true);
  });
});

describe("issue 877 — what a call took is recorded, so the next abort value is not a guess", () => {
  /** The `fetches` rows this pass wrote, with what the seam timed. */
  function rows(): { source: string; duration_ms: number | null; payload: unknown }[] {
    return db.queries
      .filter((q) => q.table === "fetches" && q.verb === "insert")
      .map((q) => q.values as unknown as { source: string; duration_ms: number | null; payload: unknown });
  }

  it("an answered call carries its elapsed time", async () => {
    vendorSlowOnce(7_000);
    await runScan({ domain: DOMAIN, tier: "free" });

    const answered = rows().filter((row) => row.source === "serp/google/organic" && Array.isArray(row.payload));
    expect(answered).not.toHaveLength(0);
    for (const row of answered) {
      expect(typeof row.duration_ms).toBe("number");
      expect(row.duration_ms).toBeGreaterThanOrEqual(0);
    }
  });

  it("an abandoned call carries the time we waited, beside the charge it still cost", async () => {
    vendorSlowOnce(30_000);
    await runScan({ domain: DOMAIN, tier: "free" });

    const aborted = rows().filter(
      (row) =>
        row.source === "serp/google/organic" &&
        typeof row.payload === "object" &&
        row.payload !== null &&
        (row.payload as { vendorFailure?: string }).vendorFailure === "timeout"
    );
    expect(aborted).toHaveLength(1);
    expect(typeof aborted[0]?.duration_ms).toBe("number");
  });

  it("the pass says what its asking took, in one line", async () => {
    const logged: Record<string, unknown>[] = [];
    vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      if (typeof args[0] !== "string") return;
      try {
        logged.push(JSON.parse(args[0]) as Record<string, unknown>);
      } catch {
        // Not a JSON line.
      }
    });
    vendorSlowOnce(7_000);
    await runScan({ domain: DOMAIN, tier: "free" });

    const line = logged.find((entry) => entry.event === "serp_latency");
    expect(line).toMatchObject({
      event: "serp_latency",
      asked: BATTERY.QUESTIONS,
      measured: BATTERY.QUESTIONS,
      abortMs: VENDOR.requestAbortMs,
    });
    expect(typeof line?.slowestMs).toBe("number");
    expect(typeof line?.medianMs).toBe("number");
  });
});
