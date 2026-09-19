// tests/scan/run/serp-rival-sizing.test.ts — SPEC §6 right-sizing, §6.6
// (issue 901)
//
// **The defect, from the live re-measure of reachkit.app on 2026-09-19.**
// The pass selected twelve right-sized questions and then banded them
// against rivals it never measured: its stored `rivalSizes` were the four
// giants the founder tracks, and the reachable competitor sitting in the
// top ten the pass had just bought — `rohringresults.com`, 338 ranked
// keywords, inside the `max(500, 5×3)` qualifying bar for a site ranking
// for three — was never sized, never one of the report's rivals, and
// never able to make a target winnable.
//
// The pass here is the real one — `runScan` at `tier: "deep"`, its six
// stages, its ceilings, its cost context. Doubled at the last line of our
// own code: Postgres, the DataForSEO client, the model calls and the
// customer's own server. Nothing is bought.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { captureStages, fakeDb } from "./harness";
import { measured, measuredZero, unmeasured } from "../../../src/lib/measure/measured";
import type { DomainMeasurement } from "../../../src/lib/measure";
import type { RivalSize } from "../../../src/lib/market/rivals/size";
import type { SelectedSearch } from "../../../src/lib/market/questions/select";
import type { Question } from "../../../src/lib/market/questions/phrase";
import type { SerpResult } from "../../../src/lib/vendors/dataforseo/types";
import type { StoredReport } from "../../../src/lib/scan/report";
import { assess } from "../../../src/lib/opportunities/winnability/band";
import { rankedCountsFor } from "../../../src/lib/opportunities/winnability/counts";
import { rankedCountsOf } from "../../../src/lib/opportunities/pass";
import { AT, ON_PAGE, PROFILE, ROBOTS } from "../report/fixtures";

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

const { runScan } = await import("../../../src/lib/scan/run");

// ── The market the owner measured by hand ───────────────────────────────

const DOMAIN = "example.com";
const SITE = "site-901";
const CLAIMED_ID = "33333333-3333-4333-8333-333333333333";

/** The site's own footprint: three ranked keywords. At that count the
 *  qualifying bar is `max(500, 5×3)` = 500 and the near/middle bars are
 *  100 and 500 — so a 338-keyword domain is `middle`, and reachable. */
const OWN_RANKED = 3;

/** The four the founder tracks — the giants of the *old*, outsized
 *  questions. Every one is above `max(500, 5×3)`, so every one is `far`. */
const GIANTS: Readonly<Record<string, number>> = {
  "zapier.com": 218_224,
  "ahrefs.com": 59_767,
  "marketermilk.com": 7_070,
  "onelittleweb.com": 3_995,
};

/** The competitor the pass's own top ten holds and nobody sized. */
const REACHABLE = "rohringresults.com";
const REACHABLE_RANKED = 338;

/** The question the owner hand-tested: 260/mo, difficulty 7. Its top ten
 *  holds two giants and the reachable competitor. */
const RIGHT_SIZED: SelectedSearch = {
  keyword: "best seo software for small businesses",
  volume: 260,
  intent: "decision",
  score: 9.1,
  rank: 1,
};

const SECOND: SelectedSearch = {
  keyword: "seo content brief software",
  volume: 50,
  intent: "decision",
  score: 7.4,
  rank: 2,
};

const QUESTIONS: Question[] = [
  { id: "q1", text: "What's the best seo software for small businesses?", search: RIGHT_SIZED, phrasing: "template" },
  { id: "q2", text: "What's the best seo content brief software?", search: SECOND, phrasing: "template" },
];

function organic(domains: readonly string[]): SerpResult {
  return {
    organic: domains.map((domain, i) => ({
      position: i + 1,
      domain,
      url: `https://${domain}/`,
      title: domain,
    })),
    aiOverview: { present: false, asynchronousAiOverview: false, referenceDomains: [] },
  };
}

/** Each question's own top ten. The reachable competitor is in the first
 *  and in no other, which is the live shape: a giant holds the top of
 *  every search, a small site holds one. */
const SERPS: Readonly<Record<string, SerpResult>> = {
  [RIGHT_SIZED.keyword]: organic(["zapier.com", "ahrefs.com", REACHABLE]),
  [SECOND.keyword]: organic(["zapier.com", "marketermilk.com", "onelittleweb.com"]),
};

/** One `ranked_keywords` answer: the vendor's own total beside one row. */
function rankedAnswer(total: number) {
  return measured(
    {
      rows: [{ keyword: "k0", position: 1, searchVolume: 10, url: "https://rival.example/" }],
      total,
    },
    AT
  );
}

const MEASUREMENT: DomainMeasurement = {
  drivers: {
    foundations: measured(52, AT),
    answerability: measured(38, AT),
    searchPresence: measuredZero(0, AT),
    aiPresence: unmeasured("not_attempted", AT),
  },
  text: { home: "One right-sized SEO page a day.", pricing: null },
  onPage: measured(ON_PAGE, AT),
  pricing: null,
  robots: measured(ROBOTS, AT),
  ownRanked: measured(OWN_RANKED, AT),
  ownRankedRows: [],
  homeRefusal: null,
};

let stages: { lines: string[]; restore: () => void };

function storedReport(): StoredReport {
  return (storeCurrentReport.mock.calls[0]![0] as { report: StoredReport }).report;
}

function sizesOf(): RivalSize[] {
  const sizes = storedReport().rivalSizes;
  return sizes.kind === "unmeasured" ? [] : sizes.value;
}

function sizeOf(domain: string): RivalSize | undefined {
  return sizesOf().find((size) => size.domain === domain);
}

/** Which domains the pass bought rival rows for, in call order. */
function rivalRowsBoughtFor(): string[] {
  return rankedKeywords.mock.calls.map((call) => (call[1] as { domain: string }).domain);
}

beforeEach(() => {
  vi.clearAllMocks();
  db.reset();
  db.rows.set("scans", [{ id: CLAIMED_ID, fromIncompleteRescan: false }]);
  measureDomain.mockResolvedValue(MEASUREMENT);
  deriveProfile.mockResolvedValue(measured(PROFILE, AT));
  deriveMarketSet.mockResolvedValue(
    measured(
      QUESTIONS.map((question) => ({ keyword: question.search.keyword, volume: question.search.volume })),
      AT
    )
  );
  phraseQuestions.mockResolvedValue(measured(QUESTIONS, AT));
  serpOrganic.mockImplementation(async (_cost: unknown, a: { query: string }) => {
    const serp = SERPS[a.query];
    return serp === undefined ? unmeasured("undeterminable", AT) : measured(serp, AT);
  });
  rankedKeywords.mockImplementation(async (_cost: unknown, a: { domain: string }) =>
    rankedAnswer(a.domain === REACHABLE ? REACHABLE_RANKED : (GIANTS[a.domain] ?? 0))
  );
  trackedRivals.mockResolvedValue(Object.keys(GIANTS));
  readCurrentReport.mockResolvedValue(null);
  storeCurrentReport.mockImplementation(async (a: { report: StoredReport }) => ({
    scanId: a.report.scanId,
    status: "done" as const,
  }));
  stages = captureStages();
});

afterEach(() => stages.restore());

describe("a pass sizes the rivals of the questions it actually asked", () => {
  it("buys rival rows for the reachable competitor its own top ten holds", async () => {
    await runScan({ domain: DOMAIN, tier: "deep", siteId: SITE });

    expect(rivalRowsBoughtFor()).toContain(REACHABLE);
    expect(sizeOf(REACHABLE)).toEqual({
      domain: REACHABLE,
      state: "sized",
      rankedCount: REACHABLE_RANKED,
      countIs: "total",
      band: "middle",
      at: AT,
      current: true,
    });
  });

  it("buys nothing twice — a tracked rival this pass already sized is not a second purchase", async () => {
    await runScan({ domain: DOMAIN, tier: "deep", siteId: SITE });

    const bought = rivalRowsBoughtFor();
    expect(bought).toEqual([...Object.keys(GIANTS), REACHABLE]);
    expect(new Set(bought).size).toBe(bought.length);
    // One entry per domain, the customer's own set first and in its own
    // order, then the domains the pass's SERPs added.
    expect(sizesOf().map((size) => size.domain)).toEqual([...Object.keys(GIANTS), REACHABLE]);
  });

  it("the report's rivals lead with the reachable one, and no far giant is one of them", async () => {
    await runScan({ domain: DOMAIN, tier: "deep", siteId: SITE });

    const rivals = storedReport().rivals;
    const shown = rivals.kind === "unmeasured" ? [] : rivals.value.map((rival) => rival.domain);
    expect(shown[0]).toBe(REACHABLE);
    for (const giant of Object.keys(GIANTS)) expect(shown).not.toContain(giant);
  });

  it("a target bands winnable or reach because of the rival its own SERP holds", async () => {
    await runScan({ domain: DOMAIN, tier: "deep", siteId: SITE });

    // Exactly the two calls `derive/write.ts` composes for one question:
    // the sizing projected into counts, read over that question's own
    // top ten. Difficulty is left out so the counts alone decide.
    const report = storedReport();
    const counts = rankedCountsOf(report);
    const top10 = SERPS[RIGHT_SIZED.keyword]!.organic.map((row) => row.domain);
    const verdict = assess({
      top10RankedCounts: rankedCountsFor(top10, counts, AT),
      ownRanked: OWN_RANKED,
      volume: RIGHT_SIZED.volume,
      difficulty: null,
    });

    expect(verdict.qualified).toBe(true);
    expect(verdict.qualified === true && ["winnable", "reach"].includes(verdict.band)).toBe(true);
    expect(counts.get(REACHABLE)).toEqual(measured(REACHABLE_RANKED, AT));
  });

  it("the weekly pass sizes its own SERPs' domains too", async () => {
    await runScan({ domain: DOMAIN, tier: "weekly", siteId: SITE, scanId: "week-1" });
    expect(rivalRowsBoughtFor()).toContain(REACHABLE);
  });

  it("adds no stage and moves none — the sizing is work inside the scoring stage", async () => {
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

describe("a size from a pass whose questions these are not is never the answer", () => {
  const earlier = new Date("2026-09-17T06:00:00.000Z");

  it("re-sizes a domain this pass's SERPs hold rather than reading the stored one", async () => {
    // An earlier pass sized this domain, when the market it measured was
    // a different one, and banded it far. The customer does not track it.
    readCurrentReport.mockResolvedValue({
      rivalSizes: measured(
        [
          {
            domain: REACHABLE,
            state: "sized" as const,
            rankedCount: 90_000,
            countIs: "total" as const,
            band: "far" as const,
            at: earlier,
            current: true,
          },
        ],
        earlier
      ),
    });

    await runScan({ domain: DOMAIN, tier: "weekly", siteId: SITE, scanId: "week-1" });

    expect(sizeOf(REACHABLE)).toMatchObject({
      state: "sized",
      rankedCount: REACHABLE_RANKED,
      band: "middle",
      at: AT,
      current: true,
    });
    for (const size of sizesOf()) {
      if (size.state === "sized") expect(size.rankedCount).not.toBe(90_000);
    }
  });

  it("a sized domain this pass could not re-read keeps its earlier reading and is not demoted", async () => {
    // REQ-096 c4 still holds for the customer's own set: the SERP sizing
    // replaces a carried-forward entry only with a measurement it took.
    readCurrentReport.mockResolvedValue({
      rivalSizes: measured(
        [
          {
            domain: "zapier.com",
            state: "sized" as const,
            rankedCount: GIANTS["zapier.com"]!,
            countIs: "total" as const,
            band: "far" as const,
            at: earlier,
            current: true,
          },
        ],
        earlier
      ),
    });
    rankedKeywords.mockResolvedValue(unmeasured("undeterminable", AT));

    await runScan({ domain: DOMAIN, tier: "weekly", siteId: SITE, scanId: "week-1" });

    expect(sizeOf("zapier.com")).toEqual({
      domain: "zapier.com",
      state: "sized",
      rankedCount: GIANTS["zapier.com"],
      countIs: "total",
      band: "far",
      at: earlier,
      current: false,
    });
  });
});

describe("§6.4 — the free path buys no rival size, its own SERPs' domains included", () => {
  it("a free pass reads no rivals and buys no ranked rows at all", async () => {
    await runScan({ domain: DOMAIN, tier: "free" });
    expect(trackedRivals).not.toHaveBeenCalled();
    expect(rankedKeywords).not.toHaveBeenCalled();
    expect(storedReport().rivalSizes.kind).toBe("unmeasured");
  });
});
