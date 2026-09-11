// tests/scan/run/rival-sizing.test.ts — BUILD §6.6, §6.4 (issue #140)
//
// The pipeline sizes the customer's tracked rivals, at the two tiers whose
// parameters say so and at no other. Two mutations this suite exists to
// kill: a free pass that buys per-rival `ranked_keywords` (§6.4's
// never-pull list, and the free cap is 12¢), and a pass that stores a
// measured sizing for a site whose rivals it could not read — which would
// tell §7's winnability that every rival is small.
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { captureStages, fakeDb } from "./harness";
import { measured, measuredZero, unmeasured } from "../../../src/lib/measure/measured";
import type { DomainMeasurement } from "../../../src/lib/measure";
import type { RivalSize } from "../../../src/lib/market/rivals/size";
import type { StoredReport } from "../../../src/lib/scan/report";
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
const rankedKeywords = vi.fn();
vi.mock("@/lib/vendors/dataforseo", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/lib/vendors/dataforseo")>()),
  serpOrganic: (...a: unknown[]) => serpOrganic(...a),
  rankedKeywords: (...a: unknown[]) => rankedKeywords(...a),
}));

const trackedRivals = vi.fn();
vi.mock("@/lib/market/rivals/tracked", () => ({
  trackedRivals: (...a: unknown[]) => trackedRivals(...a),
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

const { runScan, TIER_PARAMETERS } = await import("../../../src/lib/scan/run");

const RUN_SOURCE = readFileSync(
  path.resolve(import.meta.dirname, "../../../src/lib/scan/run.ts"),
  "utf8"
);

const DOMAIN = "example.com";
const SITE = "site-1";
const CLAIMED_ID = "33333333-3333-4333-8333-333333333333";

/** `n` ranked rows, which is what a count is read from. */
/** One `ranked_keywords` answer (#117): `n` rows, and the vendor's own
 *  total beside them. `null` — the vendor reported none — is the default,
 *  so the count falls back to the rows and every assertion written before
 *  #117 still says what it said. */
function rows(n: number, total: number | null = null) {
  const value = {
    rows: Array.from({ length: n }, (_, i) => ({
      keyword: `k${i}`,
      position: 1,
      searchVolume: 10,
      url: "https://rival.example/",
    })),
    total,
  };
  return n === 0 ? measuredZero(value, AT) : measured(value, AT);
}

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
  ownRanked: measured(120, AT),
  homeRefusal: null,
};

let stages: { lines: string[]; restore: () => void };

/** The blob the pass stored, as the pipeline handed it to the store. */
function storedReport(): StoredReport {
  return (storeCurrentReport.mock.calls[0]![0] as { report: StoredReport }).report;
}

beforeEach(() => {
  vi.clearAllMocks();
  db.reset();
  db.rows.set("scans", [{ id: CLAIMED_ID, fromIncompleteRescan: false }]);
  measureDomain.mockResolvedValue(MEASUREMENT);
  deriveProfile.mockResolvedValue(measured(PROFILE, AT));
  deriveMarketSet.mockResolvedValue(
    measured([{ keyword: SELECTED.keyword, volume: SELECTED.volume }], AT)
  );
  phraseQuestions.mockResolvedValue(measured([QUESTION], AT));
  serpOrganic.mockResolvedValue(measured(SERP, AT));
  rankedKeywords.mockResolvedValue(rows(40));
  trackedRivals.mockResolvedValue(["appcues.com", "userpilot.com"]);
  readCurrentReport.mockResolvedValue(null);
  storeCurrentReport.mockImplementation(async (a: { report: StoredReport }) => ({
    scanId: a.report.scanId,
    status: "done" as const,
  }));
  stages = captureStages();
});

afterEach(() => stages.restore());

describe("§6.4 — per-rival ranked_keywords never reaches the free path", () => {
  it("a free pass reads no tracked rivals and buys no rival rows", async () => {
    await runScan({ domain: DOMAIN, tier: "free" });
    expect(trackedRivals).not.toHaveBeenCalled();
    expect(rankedKeywords).not.toHaveBeenCalled();
    expect(storedReport().rivalSizes.kind).toBe("unmeasured");
  });

  it("the free tier's parameter says so, and the two paid tiers' say the opposite", () => {
    expect(TIER_PARAMETERS.free.sizesRivals).toBe(false);
    expect(TIER_PARAMETERS.deep.sizesRivals).toBe(true);
    expect(TIER_PARAMETERS.weekly.sizesRivals).toBe(true);
  });

  it("the sizing is reached through the parameter and never through a tier comparison", () => {
    const belowTheTable = RUN_SOURCE.slice(RUN_SOURCE.indexOf("} as const);"));
    expect(belowTheTable).not.toMatch(/tier\s*===?\s*["']/);
    expect(belowTheTable).toMatch(/parameters\.sizesRivals/);
  });
});

describe("a paid pass sizes the rivals the customer chose", () => {
  it("stores one entry per tracked rival, in the order they were chosen", async () => {
    await runScan({ domain: DOMAIN, tier: "deep", siteId: SITE });
    const sizes = storedReport().rivalSizes;
    expect(sizes.kind).not.toBe("unmeasured");
    const entries = sizes.kind === "unmeasured" ? [] : sizes.value;
    expect(entries.map((e) => e.domain)).toEqual(["appcues.com", "userpilot.com"]);
    expect(entries.every((e) => e.state === "sized")).toBe(true);
  });

  it("reads the site it is measuring for, and buys one rival call per rival", async () => {
    await runScan({ domain: DOMAIN, tier: "deep", siteId: SITE });
    expect(trackedRivals).toHaveBeenCalledWith(SITE);
    expect(rankedKeywords).toHaveBeenCalledTimes(2);
  });

  it("bands against the customer's own count from this very pass", async () => {
    await runScan({ domain: DOMAIN, tier: "deep", siteId: SITE });
    // §6.6: "held beside the customer's own measured count from the same
    // pass" — the count `measureDomain` returned, not a second read.
    expect(storedReport().ownRanked).toEqual(measured(120, AT));
  });

  it("carries one date for the whole call — the pass's own", async () => {
    await runScan({ domain: DOMAIN, tier: "deep", siteId: SITE });
    const sizes = storedReport().rivalSizes;
    const entries = sizes.kind === "unmeasured" ? [] : sizes.value;
    for (const entry of entries) {
      if (entry.state === "sized") expect(entry.at).toEqual(AT);
    }
  });

  it("a customer who tracks none is a measured zero, not an unmeasured sizing", async () => {
    trackedRivals.mockResolvedValue([]);
    await runScan({ domain: DOMAIN, tier: "deep", siteId: SITE });
    expect(storedReport().rivalSizes.kind).toBe("zero");
    expect(rankedKeywords).not.toHaveBeenCalled();
  });

  it("the weekly pass sizes too — §6.3 puts rival rows in both paid tiers", async () => {
    await runScan({ domain: DOMAIN, tier: "weekly", siteId: SITE, scanId: "week-1" });
    expect(trackedRivals).toHaveBeenCalledWith(SITE);
    expect(storedReport().rivalSizes.kind).not.toBe("unmeasured");
  });
});

describe("REQ-096 c4 — an unmeasurable rival is carried forward, never demoted", () => {
  const earlier = new Date("2026-08-01T00:00:00.000Z");
  const previous: RivalSize[] = [
    {
      domain: "appcues.com",
      state: "sized",
      rankedCount: 40,
      band: "near",
      at: earlier,
      current: true,
    },
  ];

  it("keeps its earlier date and marks it not current when this pass could not measure it", async () => {
    readCurrentReport.mockResolvedValue({ rivalSizes: measured(previous, earlier) });
    rankedKeywords.mockResolvedValue(unmeasured("undeterminable", AT));
    trackedRivals.mockResolvedValue(["appcues.com"]);

    await runScan({ domain: DOMAIN, tier: "weekly", siteId: SITE, scanId: "week-1" });
    const sizes = storedReport().rivalSizes;
    const entry = (sizes.kind === "unmeasured" ? [] : sizes.value)[0]!;
    expect(entry).toEqual({ ...previous[0]!, current: false });
  });

  it("a rival the last pass did not carry is 'added since', not 'awaiting the deep pass'", async () => {
    readCurrentReport.mockResolvedValue({ rivalSizes: measured(previous, earlier) });
    rankedKeywords.mockResolvedValue(unmeasured("undeterminable", AT));
    trackedRivals.mockResolvedValue(["userpilot.com"]);

    await runScan({ domain: DOMAIN, tier: "weekly", siteId: SITE, scanId: "week-1" });
    const sizes = storedReport().rivalSizes;
    const entry = (sizes.kind === "unmeasured" ? [] : sizes.value)[0]!;
    expect(entry).toEqual({
      domain: "userpilot.com",
      state: "unsized",
      because: "added_since_last_sizing",
    });
  });

  it("with no earlier sizing at all, an unmeasurable rival awaits the deep pass", async () => {
    readCurrentReport.mockResolvedValue(null);
    rankedKeywords.mockResolvedValue(unmeasured("undeterminable", AT));
    trackedRivals.mockResolvedValue(["appcues.com"]);

    await runScan({ domain: DOMAIN, tier: "deep", siteId: SITE });
    const sizes = storedReport().rivalSizes;
    const entry = (sizes.kind === "unmeasured" ? [] : sizes.value)[0]!;
    expect(entry).toEqual({
      domain: "appcues.com",
      state: "unsized",
      because: "awaiting_deep_pass",
    });
  });

  it("a stored report whose own sizing is unmeasured is no earlier sizing at all", async () => {
    readCurrentReport.mockResolvedValue({ rivalSizes: unmeasured("not_attempted", earlier) });
    rankedKeywords.mockResolvedValue(unmeasured("undeterminable", AT));
    trackedRivals.mockResolvedValue(["appcues.com"]);

    await runScan({ domain: DOMAIN, tier: "weekly", siteId: SITE, scanId: "week-1" });
    const sizes = storedReport().rivalSizes;
    const entry = (sizes.kind === "unmeasured" ? [] : sizes.value)[0]!;
    expect(entry).toMatchObject({ state: "unsized", because: "awaiting_deep_pass" });
  });
});

describe("what could not be read is never stored as a measurement", () => {
  it("a site whose row is not there leaves the sizing unmeasured", async () => {
    trackedRivals.mockResolvedValue(null);
    await runScan({ domain: DOMAIN, tier: "deep", siteId: SITE });
    expect(storedReport().rivalSizes.kind).toBe("unmeasured");
    expect(rankedKeywords).not.toHaveBeenCalled();
  });

  it("a read that raised leaves the sizing unmeasured and the pass carries on", async () => {
    trackedRivals.mockRejectedValue(new Error("connection reset"));
    const result = await runScan({ domain: DOMAIN, tier: "deep", siteId: SITE });
    expect(result.status).not.toBe("failed");
    expect(storedReport().rivalSizes.kind).toBe("unmeasured");
  });

  it("a paid pass with no site sizes nothing — there are no tracked rivals without one", async () => {
    await runScan({ domain: DOMAIN, tier: "deep" });
    expect(trackedRivals).not.toHaveBeenCalled();
    expect(storedReport().rivalSizes.kind).toBe("unmeasured");
  });

  it("the customer's own count that could not be read is unmeasured, never a 0 in the blob", async () => {
    measureDomain.mockResolvedValue({
      ...MEASUREMENT,
      ownRanked: unmeasured("undeterminable", AT),
    });
    await runScan({ domain: DOMAIN, tier: "deep", siteId: SITE });
    expect(storedReport().ownRanked.kind).toBe("unmeasured");
  });
});

describe("the six stages are still six", () => {
  it("sizing adds no stage and moves none — it is work inside the presence stage", async () => {
    await runScan({ domain: DOMAIN, tier: "deep", siteId: SITE });
    expect(stages.lines).toEqual([
      "reading_your_site:enter",
      "reading_your_site:done",
      "reading_access_rules:enter",
      "reading_access_rules:done",
      "reading_your_market:enter",
      "reading_your_market:done",
      "checking_your_presence:enter",
      "checking_your_presence:done",
      "asking_the_twelve:enter",
      "asking_the_twelve:done",
      "scoring:enter",
      "scoring:done",
    ]);
  });
});
