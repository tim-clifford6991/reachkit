// A free pass over the customer panel's stored reads (one SaaS, one local,
// from docs/walk/free), with every vendor and model port doubled: each
// finished stage's summary says what the stored report says. 0¢.
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { captureStages, fakeDb } from "../run/harness";
import { measured, unmeasured, type Measured } from "../../../src/lib/measure/measured";
import type { DomainMeasurement } from "../../../src/lib/measure";
import type { SerpResult } from "../../../src/lib/vendors/dataforseo/types";
import type { RobotsPolicy } from "../../../src/lib/egress/types";
import { readStoredReport, type StoredReport } from "../../../src/lib/scan/report";
import { categoryOf } from "../../../src/lib/scan/sections";
import { profileOfReport, understandBusiness } from "../../../src/lib/business/understanding";
import { measuredLocale } from "../../../src/lib/locale/locales";
import type { StageSummary } from "../../../src/lib/scan/stages";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

const measureDomain = vi.fn();
vi.mock("@/lib/measure", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/lib/measure")>()),
  measureDomain: (...args: unknown[]) => measureDomain(...args),
}));

const buildSiteProfileWithCrawl = vi.fn();
vi.mock("@/lib/site-profile", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/lib/site-profile")>()),
  buildSiteProfileWithCrawl: (...a: unknown[]) => buildSiteProfileWithCrawl(...a),
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
const placeLocation = vi.fn(async () => null);
vi.mock("@/lib/vendors/dataforseo", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/lib/vendors/dataforseo")>()),
  serpOrganic: (...a: unknown[]) => serpOrganic(...a),
  placeLocation: (...a: unknown[]) => placeLocation(...(a as [])),
}));

const readCurrentReport = vi.fn(async () => null);
vi.mock("@/lib/scan/report", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/lib/scan/report")>()),
  readCurrentReport: (...a: unknown[]) => readCurrentReport(...(a as [])),
}));

const storeCurrentReport = vi.fn(async (a: { report: StoredReport }) => ({ scanId: a.report.scanId, status: "done" as const }));
vi.mock("@/lib/scan/store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/lib/scan/store")>()),
  storeCurrentReport: (...a: unknown[]) => storeCurrentReport(...(a as [{ report: StoredReport }])),
}));

vi.mock("@/lib/scan/correction", () => ({
  readCorrectionFacts: async () => null,
  advanceCorrectionState: async () => true,
  registerCorrectionRunner: () => undefined,
  correctionRunner: () => null,
}));

const { runScan } = await import("../../../src/lib/scan/run");
const { freshSections, summaryAt } = await import("../../../src/lib/scan/pass/sections");

const CLAIMED_ID = "44444444-4444-4444-8444-444444444444";

function walkReport(walk: string, domain: string): StoredReport {
  const file = path.resolve(import.meta.dirname, `../../../docs/walk/free/${walk}.json`);
  const sites = (JSON.parse(readFileSync(file, "utf8")) as { sites: { domain: string; stored: { scan: { report: unknown } } | null }[] }).sites;
  return readStoredReport(sites.find((s) => s.domain === domain && s.stored !== null)!.stored!.scan.report);
}

/** The local read again, with one answer reader shut out and the site in one search's top ten. */
function withReaderOutAndOneFound(report: StoredReport): StoredReport {
  const robots = report.robots as Measured<RobotsPolicy> & { kind: "measured" };
  const serps = report.serps.map((serp, i) =>
    i !== 0 || serp.kind === "unmeasured"
      ? serp
      : { ...serp, value: { ...serp.value, organic: [{ url: `https://${report.domain}/`, title: "Home", domain: report.domain, position: 3 }, ...serp.value.organic] } }
  );
  return {
    ...report,
    robots: { ...robots, value: { ...robots.value, disallowedAgents: { ...robots.value.disallowedAgents, "OAI-SearchBot": true } } },
    serps,
  } as StoredReport;
}

/** The local read again, measured in the town it sells in. */
function inItsTown(report: StoredReport): StoredReport {
  return { ...report, locale: { country: "US", language: "en", place: { name: "Austin", region: "Texas", location: "Austin,Texas,United States" } } } as StoredReport;
}

const PANEL = {
  saas: () => walkReport("2026-10-15-1449-after", "savvycal.com"),
  local: () => walkReport("2026-10-15", "austinplumbery.com"),
  "local, one reader shut out and one search found": () => withReaderOutAndOneFound(walkReport("2026-10-15", "austinplumbery.com")),
};

/** Every vendor and model read answers with what the stored report recorded. */
function replay(stored: StoredReport): void {
  const at = stored.verdict.measuredAt;
  const questions = stored.questions.kind === "unmeasured" ? [] : stored.questions.value;
  const m: DomainMeasurement = {
    drivers: { foundations: measured(80, at), answerability: measured(40, at), searchPresence: unmeasured("not_attempted", at), aiPresence: unmeasured("not_attempted", at) },
    text: { home: "Home.", pricing: null },
    onPage: stored.onPage,
    pricing: null,
    robots: stored.robots,
    ownRanked: stored.ownRanked,
    ownRankedRows: stored.ownRankedRows,
    locale: stored.locale ?? { country: "US", language: "en" },
    localeFellBack: null,
    homeRefusal: null,
  };
  measureDomain.mockResolvedValue(m);
  const pages = Array.from({ length: stored.siteIssues!.pagesChecked }, (_, i) => ({
    url: `https://${stored.domain}/p${i}`,
    title: `Page ${i}`,
    h1: `Page ${i}`,
    text: "",
    facts: { metaDescription: "", noindex: false, phoneViewport: true, schemaTypes: 1 },
    links: [],
    fetchMs: 300,
  }));
  buildSiteProfileWithCrawl.mockResolvedValue({ profile: null, crawl: { pages, discovered: pages.length, stoppedBy: "complete", fetched: [], broken: [], sitemap: "absent" } });
  if (stored.market.kind === "unmeasured") throw new Error("a panel read with no market");
  deriveProfile.mockResolvedValue(measured(stored.market.value.profile, at));
  deriveMarketSet.mockResolvedValue(measured(questions.map((q) => ({ keyword: q.search.keyword, volume: q.search.volume })), at));
  phraseQuestions.mockResolvedValue(measured(questions, at));
  const bySearch = new Map(questions.map((q, i) => [q.search.keyword, stored.serps[i]]));
  serpOrganic.mockImplementation(async (_c: unknown, a: { query: string }) => (bySearch.get(a.query) ?? unmeasured("not_attempted", at)) as Measured<SerpResult>);
}

function summaries(): { stage: string; summary?: StageSummary }[] {
  return db.rpcCalls
    .filter((call) => call.fn === "append_scan_stage_event")
    .map((call) => call.args.p_event as { stage?: string; done?: boolean; summary?: StageSummary })
    .filter((event) => event.done === true)
    .map((event) => ({ stage: event.stage!, ...(event.summary === undefined ? {} : { summary: event.summary }) }));
}

function storedReport(): StoredReport {
  return (storeCurrentReport.mock.calls.at(-1) as unknown as [{ report: StoredReport }])[0].report;
}

let stages: ReturnType<typeof captureStages>;
beforeEach(() => {
  vi.clearAllMocks();
  db.reset();
  db.rows.set("scans", [{ id: CLAIMED_ID, fromIncompleteRescan: false }]);
  stages = captureStages();
});
afterEach(() => stages.restore());

describe("each finished stage carries what it found, and the report says the same", () => {
  for (const [which, panel] of Object.entries(PANEL)) {
    it(which, async () => {
      const read = panel();
      replay(read);
      await runScan({ domain: read.domain as Parameters<typeof runScan>[0]["domain"], tier: "free" });
      const report = storedReport();
      const events = summaries();
      const at = (stage: string) => events.find((e) => e.stage === stage)!.summary ?? {};
      expect(events.map((e) => e.stage)).toEqual(["reading_your_site", "reading_access_rules", "reading_your_market", "checking_your_presence", "asking_the_twelve", "scoring"]);

      // Pages read: the report's count, never 0, from the first exit after the crawl.
      const counts = events.flatMap((e) => (e.summary?.pagesRead === undefined ? [] : [e.summary.pagesRead]));
      expect(counts.length).toBeGreaterThan(0);
      expect(new Set(counts)).toEqual(new Set([report.siteIssues!.pagesChecked]));

      const blocked = report.blockedAgents;
      expect(at("reading_access_rules").readers).toEqual({ google: blocked.includes("Googlebot") ? "out" : "in", ai: blocked.length > 0 ? "out" : "in" });

      expect(at("reading_your_market").category).toBe(categoryOf(report.market));
      // Who buys and where: what the report's read-as chips draw from the stored report.
      const reading = understandBusiness({ domain: report.domain, profile: profileOfReport(report), locale: measuredLocale(report) });
      expect(at("reading_your_market").buyer).toBe(reading.buyers[0]);
      // Where: the town the report was measured in, else the one its reading names.
      expect(at("reading_your_market").place).toBe(report.locale?.place?.name ?? reading.where.place?.name);
      // 0¢: every doubled vendor and model port is asked as often as the report needs, and no more.
      for (const port of [measureDomain, buildSiteProfileWithCrawl, deriveProfile, deriveMarketSet, phraseQuestions]) expect(port).toHaveBeenCalledOnce();
      expect(serpOrganic).toHaveBeenCalledTimes(report.questions.kind === "unmeasured" ? 0 : report.questions.value.length);
      expect(placeLocation).not.toHaveBeenCalled();

      const searches = at("asking_the_twelve").searches ?? [];
      expect(searches.length).toBe(report.presence!.measuredSearches);
      expect(searches.filter((s) => s.onPageOne).length).toBe(report.presence!.you.top10Count);
      const asked = report.questions.kind === "unmeasured" ? [] : report.questions.value.map((q) => q.search.keyword);
      for (const s of searches) expect(asked).toContain(s.words);

      // The other stages name no field of their own.
      for (const stage of ["reading_your_site", "checking_your_presence", "scoring"]) expect(Object.keys(at(stage)).filter((k) => k !== "pagesRead")).toEqual([]);
      expect(Object.keys(at("reading_access_rules")).filter((k) => k !== "pagesRead")).toEqual(["readers"]);
      expect(Object.keys(at("reading_your_market")).filter((k) => k !== "pagesRead")).toEqual(["category", "buyer", ...(report.locale?.place === undefined && reading.where.place === null ? [] : ["place"])]);
    });
  }

  it("the variants are not trivial: a local site measured in its town names it, and a SaaS site names no town", async () => {
    const reads = [
      [inItsTown(walkReport("2026-10-15", "austinplumbery.com")), "Austin"],
      [PANEL.saas(), undefined],
    ] as const;
    for (const [read, place] of reads) {
      vi.clearAllMocks();
      db.reset();
      db.rows.set("scans", [{ id: CLAIMED_ID, fromIncompleteRescan: false }]);
      replay(read);
      await runScan({ domain: read.domain as Parameters<typeof runScan>[0]["domain"], tier: "free" });
      const market = summaries().find((e) => e.stage === "reading_your_market")!.summary!;
      expect(market.place).toBe(place);
      expect(market.place).toBe(storedReport().locale?.place?.name);
      expect(market.buyer).toBeTruthy();
    }
  });

  it("the variant is not trivial: a reader is shut out and one search is found", async () => {
    const read = PANEL["local, one reader shut out and one search found"]();
    replay(read);
    await runScan({ domain: read.domain as Parameters<typeof runScan>[0]["domain"], tier: "free" });
    const events = summaries();
    expect(events.find((e) => e.stage === "reading_access_rules")!.summary!.readers).toEqual({ google: "in", ai: "out" });
    expect(events.find((e) => e.stage === "asking_the_twelve")!.summary!.searches!.filter((s) => s.onPageOne)).toHaveLength(1);
  });
});

describe("a paid pass's market stage names its concluded buyer, the founder's answer first (D49)", () => {
  const read = walkReport("2026-10-15", "austinplumbery.com");
  if (read.market.kind === "unmeasured") throw new Error("a panel read with no market");
  const profile = read.market.value.profile;
  const at = new Date(read.verdict.measuredAt);
  const concluded = {
    buyer: "homeowners and businesses in Austin needing plumbing work",
    job: "fix leaks",
    category: "plumber",
    synonyms: [],
    differentiators: [],
    notOurMarket: [],
    categoryReason: "",
    rivals: [],
  };
  const summaryWith = (founderBuyer: string | null) => {
    const sections = { ...freshSections(at), profile: measured(profile, at), marketRows: measured([], at), market: concluded, founderBuyer };
    return summaryAt("reading_your_market", { domain: read.domain as never, sections, startedAt: at });
  };

  it("the concluded buyer, where the founder gave none", () => {
    expect(summaryWith(null).buyer).toBe(concluded.buyer);
  });

  it("the founder's own answer outranks it", () => {
    expect(summaryWith("Landlords with rental flats").buyer).toBe("Landlords with rental flats");
  });
});
