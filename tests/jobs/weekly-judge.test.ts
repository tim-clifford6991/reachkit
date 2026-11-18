// tests/jobs/weekly-judge.test.ts — the Monday tick's second obligation
// (issue #576): §6's "a verdict on every page published so far".
//
// The discriminating pair: a measured week leaves rows behind it *before*
// the digest reads them — a digest composed from an unjudged week reports
// nothing moved — and a failed pass, which stored no report, judges
// nothing at all rather than writing a week of blanks.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DOMAIN, SITE_ID, WEEK, fakeStore, releaseStore, type Fake } from "../opportunities/verdicts/harness";
import type { DigestPage } from "@/lib/opportunities/verdicts";
import { setOpportunityStore } from "@/lib/opportunities/store";
import { memoryStore, newMemoryState, type MemoryState } from "../opportunities/memory-store";
import { asQueue, envelope, pollTheQueueAtOnce, stubVendorFetch, type VendorFetchStub } from "../vendors/harness";
import { VENDOR } from "@/lib/config/constants";

const weekly = vi.hoisted(() => ({
  outcome: { ran: true, scanId: "scan-1", status: "done" } as unknown,
}));
// Issue 1553's search-engine step reaches the database and the vendors;
// these suites judge the week, so it is a no-op here (its own suite is
// `tests/hosted/indexing/search-engines.test.ts`).
vi.mock("@/lib/publish/destinations/hosted/search-engines", () => ({ readSearchEngines: async () => undefined }));
vi.mock("@/lib/scan/weekly", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/scan/weekly")>();
  return { ...actual, runWeekly: async () => weekly.outcome };
});
// The pass is a double, so it left nothing in the queue to read (#1160).
vi.mock("@/lib/scan/weekly/collect", () => ({
  collectLateAnswers: async () => ({ asks: 0, answered: 0, left: 0 }),
}));

// The digest, reading what this tick wrote through its own reader. The
// mail itself is `tests/jobs/weekly-digest.test.ts`'s subject; what is
// under test here is what the digest finds on disk when it is called.
const digest = vi.hoisted(() => ({ read: [] as DigestPage[] }));
vi.mock("@/lib/mail/weekly", () => ({
  sendWeeklyDigest: async (a: { siteId: string; weekStart: string }) => {
    const { weeklyDigest } = await import("@/lib/opportunities");
    digest.read = [...(await weeklyDigest({ siteId: a.siteId, week: a.weekStart })).standings];
    return { sent: true, id: "vendor-1" };
  },
}));

const { startWeeklyScan } = await import("@/jobs/engine");

const NOW = new Date(Date.UTC(2026, 7, 31, 10, 0, 0));
const tick = () =>
  startWeeklyScan({ siteId: SITE_ID, domain: DOMAIN, zone: "UTC", weekStart: WEEK, now: NOW });

let store: Fake;
let opportunities: MemoryState;
// Only the network answers: PostgREST keeps the ledger and `ops_events`, and the vendor's queue answers at once.
let tables: Map<string, Record<string, unknown>[]>;
let vendor: VendorFetchStub;
beforeEach(() => {
  tables = new Map();
  vendor = stubVendorFetch(asQueue(() => envelope({ items: [{ type: "organic", rank_group: 1, domain: "a.com", url: "https://a.com/", title: "A" }] })));
  const answer = vi.mocked(fetch).getMockImplementation()!;
  vi.mocked(fetch).mockImplementation(async (url, init) => {
    const at = new URL(String(url)), name = at.pathname.split("/").pop()!;
    if (at.host === "api.dataforseo.com") return answer(url, init);
    const table = tables.get(name) ?? tables.set(name, []).get(name)!;
    if (init?.method === "POST") table.push(...[JSON.parse(String(init.body))].flat().map((row: Record<string, unknown>) => ({ created_at: new Date().toISOString(), ...row })));
    const rows = table.filter((row) => [...at.searchParams].every(([k, v]) => !v.startsWith("eq.") || String(row[k]) === v.slice(3))).reverse();
    return new Response(JSON.stringify(name === "scans" ? [{ cost_cents: 0, site_id: SITE_ID }] : at.pathname.includes("/rpc/") ? 0 : rows));
  });
  pollTheQueueAtOnce(VENDOR.stdQueuePollIntervalS * 1000);
  opportunities = newMemoryState();
  setOpportunityStore(memoryStore(opportunities));
  releaseStore();
  weekly.outcome = { ran: true, scanId: "scan-1", status: "done" };
  digest.read = [];
  store = fakeStore({});
});
afterEach(() => vi.unstubAllGlobals());

describe("the Monday tick judges the week it measured", () => {
  it("one published page and one measured week leave one verdict, and the digest names it", async () => {
    expect(await tick()).toEqual({ done: true });

    expect(store.rows).toHaveLength(1);
    expect(store.rows[0]!.week).toBe(WEEK);
    expect(digest.read.map((page) => page.publicationId)).toEqual(["pub-1"]);
    expect(digest.read[0]!.standing.kind).toBe("verdict");
  });

  it("a degraded week is judged too — a partly measured week is a measured one", async () => {
    weekly.outcome = { ran: true, scanId: "scan-1", status: "degraded", unmeasured: ["rivals"] };
    await tick();
    expect(store.rows).toHaveLength(1);
  });

  it("**a failed pass judges nothing** — there is no report to judge against", async () => {
    weekly.outcome = { ran: true, scanId: "scan-1", status: "failed" };
    await tick();
    expect(store.inserted).toEqual([]);
  });

  it("a week the vendor refused for credit ends degraded with vendor_funds, and judges, plans and tells nothing", async () => {
    opportunities.rows.push({
      id: "write-1", site_id: SITE_ID, scan_id: "scan-1", type: "answer_page", family: "write",
      target_query: "user onboarding software", target_ref: "onboarding-faq", proposed_slug: "onboarding-faq", title: null, volume: 500,
      evidence: { family: "write" }, acceptance: { form: "top20", query: "user onboarding software" },
      fit_band: "winnable", effort: 0.3, status: "open", cluster_key: "onboarding", absorbed_queries: [],
      ready: false, unready_reason: "not_assessed", created_at: NOW.toISOString(),
    });
    const before = structuredClone(opportunities.rows);
    weekly.outcome = { ran: true, scanId: "scan-1", status: "failed", because: "vendor_funds" };
    expect(await tick()).toEqual({ degraded: "vendor_funds" });
    expect(store.inserted).toEqual([]);
    expect(opportunities.rows).toEqual(before);
    expect(digest.read).toEqual([]);
  });

  it("**a re-delivered tick writes no second verdict** — the key is (publication, week)", async () => {
    await tick();
    await tick();
    expect(store.rows).toHaveLength(1);
  });

  it("**a replayed research step buys no second SERP and writes no second week_research row**", async () => {
    const { askWeekResearch } = await import("@/lib/generate/research-queue");
    const { commitWeek } = await import("@/lib/scan/weekly/commit");
    const week = { siteId: SITE_ID, scanId: "scan-1", weekStart: WEEK, now: NOW, rows: [{ id: "write-1", target_query: "user onboarding software", topUp: true }] };
    for (let run = 0; run < 2; run++) {
      await askWeekResearch({ ...week, waitMs: 1_000 });
      await commitWeek({ ...week, checks: [["write-1", null]] });
    }
    expect(vendor.requests.filter((request) => request.url.includes("/serp/google/organic/task_post"))).toHaveLength(1);
    expect(tables.get("ops_events")?.map((row) => [row.kind, row.code, JSON.parse(String(row.read)).top_up])).toEqual([["week_research", WEEK, { tried: 1, kept: 0 }]]);
  });
});
