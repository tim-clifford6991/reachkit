// Issue 1440 — a free scan's unread searches, finished in the background:
// read once, inside the free cap the pass already spent from, merged into
// the stored report and scored again through the re-score's guarded write.
// The vendor and the database are doubles; nothing here reaches a network.
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { CAPS, TIMING } from "../../src/lib/config/constants";
import type { CostContext } from "../../src/lib/costs";
import { measured, unmeasured, type Measured } from "../../src/lib/measure/measured";
import { finishingOf, finishReads, unreadSearches, type FinishRow, type FinishStore, type FinishVendor } from "../../src/lib/scan/finish-reads";
import { readStoredReport, stillReading, type StoredReport } from "../../src/lib/scan/report";
import type { ScanWrite } from "../../src/lib/scan/rescore-run";
import type { SerpResult } from "../../src/lib/vendors/dataforseo/types";

const ZAPIER = (
  JSON.parse(readFileSync(new URL("./report/fixtures/rescore/zapier.com.json", import.meta.url), "utf8")) as {
    scans: { id: string; createdAt: string; status: FinishRow["status"]; score: number | null; drivers: unknown; report: Record<string, unknown> }[];
  }
).scans[0]!;

const KEYWORDS = [
  "workflow automation platform",
  "ai workflow automation platform",
  "no code workflow automation platform",
  "best workflow automation platform",
  "workflow automation software",
  "workflow automation tools",
  "business process automation",
  "automate repetitive tasks",
  "app integration platform",
  "connect apps without code",
  "zapier alternatives",
  "automation for small business",
];

const PASS_AT = "2026-10-06T03:44:10.827Z";
const SINCE = new Date("2026-10-06T03:45:00.000Z");
const NOW = new Date("2026-10-06T03:45:20.000Z");

/** zapier.com's stored free scan, as a pass that read none of its twelve
 *  would have stored it: twelve chosen, none read, no cards, and the marker. */
function zeroOfTwelve(): Record<string, unknown> {
  const report = structuredClone(ZAPIER.report);
  report.questions = {
    kind: "measured",
    at: PASS_AT,
    value: KEYWORDS.map((keyword, i) => ({ id: `q${i + 1}`, text: "", search: { keyword, volume: 1000 - i }, phrasing: "model" })),
  };
  report.serps = KEYWORDS.map((_, i) =>
    i % 2 === 0 ? { kind: "unmeasured", reason: "not_attempted", at: PASS_AT } : { kind: "unmeasured", reason: "undeterminable", because: "timeout", at: PASS_AT }
  );
  report.presence = null;
  report.aiAnswers = null;
  report.rivals = { kind: "unmeasured", reason: "not_attempted", at: PASS_AT };
  report.stoppedReason = "time_ceiling";
  report.complete = false;
  report.finishingReads = { searches: 12, since: SINCE.toISOString() };
  return report;
}

const md5 = (report: unknown): string => createHash("md5").update(JSON.stringify(report)).digest("hex");

/** The row and `rescore_scan`'s guarded, path-level write, held here. */
function storeOf(report: Record<string, unknown>, costCents: number | null = 7.2) {
  let row: FinishRow = {
    id: ZAPIER.id,
    domain: "zapier.com",
    createdAt: ZAPIER.createdAt,
    status: "degraded",
    score: ZAPIER.score,
    drivers: ZAPIER.drivers,
    md5: md5(report),
    report: structuredClone(report),
    siteId: null,
    isCurrent: true,
    costCents,
  };
  const written: ScanWrite[] = [];
  const store: FinishStore = {
    row: async () => structuredClone(row),
    homeReads: async () => [],
    siteName: async () => "Zapier",
    async writeScan(w) {
      if (w.md5 !== row.md5) return false;
      written.push(w);
      const next = structuredClone(row.report) as Record<string, unknown>;
      const previous = next.previous ?? structuredClone(next);
      for (const change of w.changes) {
        let at = next as Record<string | number, unknown>;
        for (const key of change.path.slice(0, -1)) at = at[key] as Record<string | number, unknown>;
        at[change.path[change.path.length - 1]!] = JSON.parse(JSON.stringify(change.value)) as unknown;
      }
      const stored = { ...next, previous, rescoredAt: w.at, rescoredBy: w.by };
      row = { ...row, report: stored, md5: md5(stored), score: w.score, status: w.status };
      return true;
    },
  };
  return { store, written, row: () => row };
}

function serpFor(query: string): SerpResult {
  return {
    organic: [
      { position: 1, domain: "zapier.com", url: "https://zapier.com/", title: "Zapier" },
      { position: 2, domain: "make.com", url: "https://www.make.com/", title: `Make — ${query}` },
      { position: 3, domain: "n8n.io", url: "https://n8n.io/", title: "n8n" },
    ],
    aiOverview: { present: true, asynchronousAiOverview: true, referenceDomains: ["zapier.com", "make.com"] },
  };
}

/** The pass's ledger as the job opens it: the row's spend counted against the
 *  free cap, each read reserved before it is made. */
function vendorOf(a: { spentCents: number; centsPerRead: number; answer?: (query: string) => Measured<SerpResult> | "throw" }) {
  const asked: string[] = [];
  const opened: string[] = [];
  let spent = a.spentCents;
  const vendor: FinishVendor = {
    async spend(scanId, body) {
      opened.push(scanId);
      const cost = { capHit: () => spent + a.centsPerRead > CAPS.FREE_C, spentCents: () => spent } as unknown as CostContext;
      return body(cost);
    },
    async read(_cost, r) {
      asked.push(r.query);
      spent += a.centsPerRead;
      const answer = a.answer?.(r.query) ?? measured(serpFor(r.query), NOW);
      if (answer === "throw") throw new Error("vendor down");
      if (answer.kind === "unmeasured") r.onFailure({ vendorFailure: "timeout" } as never);
      return answer;
    },
  };
  return { vendor, asked, opened, spent: () => spent };
}

const finish = (store: FinishStore, vendor: FinishVendor) => finishReads({ scanId: ZAPIER.id, now: NOW, version: "abc1234" }, store, vendor);

describe("the marker a free pass stores (issue 1440)", () => {
  const report = readStoredReport(zeroOfTwelve()) as StoredReport;

  it("names every chosen search the pass did not read, by its place", () => {
    expect(unreadSearches(report).map((s) => s.index)).toEqual([...KEYWORDS.keys()]);
    expect(unreadSearches({ ...report, tier: "deep" })).toEqual([]);
  });

  it("is stored only where something is unread and the free cap still holds money", () => {
    expect(finishingOf(report, 7.2, SINCE)).toEqual({ searches: 12, since: SINCE });
    expect(finishingOf(report, CAPS.FREE_C, SINCE)).toBeNull();
    const read = { ...report, serps: report.serps.map(() => measured(serpFor("q"), NOW)) };
    expect(finishingOf(read, 1, SINCE)).toBeNull();
  });

  it("the report says it is still reading only inside the line's window", () => {
    const marked = { finishingReads: { searches: 3, since: SINCE } };
    expect(stillReading(marked, NOW)).toBe(3);
    expect(stillReading(marked, new Date(SINCE.getTime() + TIMING.finishReadsNoticeS * 1000))).toBeNull();
    expect(stillReading({ finishingReads: null }, NOW)).toBeNull();
    expect(stillReading({}, NOW)).toBeNull();
  });
});

describe("scan/finish-reads — a scan with 0 of 12 read finishes to 12 of 12 (issue 1440)", () => {
  it("reads the twelve on the pass's ledger, merges them, scores the report and clears the marker", async () => {
    const db = storeOf(zeroOfTwelve());
    const v = vendorOf({ spentCents: 7.2, centsPerRead: 0.1 });
    const result = await finish(db.store, v.vendor);

    expect(result).toEqual({ finished: true, asked: 12, read: 12, written: true });
    expect(v.opened).toEqual([ZAPIER.id]);
    expect([...v.asked].sort()).toEqual([...KEYWORDS].sort());

    const after = readStoredReport(db.row().report) as StoredReport;
    expect(after.serps.filter((s) => s.kind === "measured")).toHaveLength(12);
    expect(after.finishingReads).toBeNull();
    expect(after.aiAnswers?.measuredSearches).toBe(12);
    expect(after.aiAnswers?.rows).toHaveLength(12);
    expect(after.presence).not.toBeNull();
    expect(after.rivals.kind).toBe("measured");
    // Kept as the re-score keeps it, under the checksum it read.
    expect((db.row().report as { previous: { finishingReads: unknown } }).previous.finishingReads).toEqual({ searches: 12, since: SINCE.toISOString() });
    expect(db.written[0]).toMatchObject({ md5: md5(zeroOfTwelve()), by: "finish-reads@abc1234" });
  });

  it("is idempotent: a second delivery finds no marker and buys nothing", async () => {
    const db = storeOf(zeroOfTwelve());
    await finish(db.store, vendorOf({ spentCents: 7.2, centsPerRead: 0.1 }).vendor);
    const again = vendorOf({ spentCents: 7.2, centsPerRead: 0.1 });
    expect(await finish(db.store, again.vendor)).toEqual({ finished: false, because: "nothing_to_finish" });
    expect(again.asked).toEqual([]);
    expect(db.written).toHaveLength(1);
  });

  it("a report written after it was read is left alone", async () => {
    const db = storeOf(zeroOfTwelve());
    const store: FinishStore = { ...db.store, writeScan: async () => false };
    expect(await finish(store, vendorOf({ spentCents: 7.2, centsPerRead: 0.1 }).vendor)).toMatchObject({ written: false });
  });
});

describe("the budget is the free cap, counting what the pass already spent", () => {
  it("reads only as many as the cap still holds; the rest stay unmeasured", async () => {
    const db = storeOf(zeroOfTwelve(), 11.5);
    const v = vendorOf({ spentCents: 11.5, centsPerRead: 0.1 });
    const result = await finish(db.store, v.vendor);
    expect(v.asked.length).toBeLessThan(12);
    expect(v.spent()).toBeLessThanOrEqual(CAPS.FREE_C);
    expect(result).toMatchObject({ finished: true, read: v.asked.length });
  });

  it("a row whose cap is spent buys nothing, and the marker still goes", async () => {
    const db = storeOf(zeroOfTwelve(), CAPS.FREE_C);
    const v = vendorOf({ spentCents: CAPS.FREE_C, centsPerRead: 0.1 });
    expect(await finish(db.store, v.vendor)).toEqual({ finished: true, asked: 0, read: 0, written: true });
    expect(v.opened).toEqual([]);
    expect((readStoredReport(db.row().report) as StoredReport).finishingReads).toBeNull();
  });
});

describe("one attempt: a search that fails again stays unmeasured with its reason", () => {
  it("keeps the vendor's own kind on the cell, and a raise is undeterminable", async () => {
    const db = storeOf(zeroOfTwelve());
    const v = vendorOf({
      spentCents: 7.2,
      centsPerRead: 0.1,
      answer: (query) =>
        query === KEYWORDS[0] ? unmeasured("undeterminable", NOW) : query === KEYWORDS[1] ? "throw" : measured(serpFor(query), NOW),
    });
    expect(await finish(db.store, v.vendor)).toEqual({ finished: true, asked: 12, read: 10, written: true });
    expect(v.asked.filter((q) => q === KEYWORDS[0])).toHaveLength(1);
    const after = readStoredReport(db.row().report) as StoredReport;
    expect(after.serps[0]).toMatchObject({ kind: "unmeasured", reason: "undeterminable", because: "timeout" });
    expect(after.serps[1]).toMatchObject({ kind: "unmeasured", reason: "undeterminable" });
  });
});
