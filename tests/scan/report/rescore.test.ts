// Issues 1426 and 1433 — stored scans and a stored rival set, read again by
// the current code from what was stored, as the `scan/rescore` job reads
// them: the rows whole, through a store that stands in for the database.
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { offline } from "../../../src/lib/egress/offline";
import { KEPT_NO_OVERVIEW_TEXT, rehomeSite } from "../../../src/lib/scan/rescore";
import {
  rescoreRow,
  rescoreStored,
  type RescoreStore,
  type ScanWrite,
  type SiteWrite,
  type StoredRead,
  type StoredScanRow,
  type StoredSiteRow,
} from "../../../src/lib/scan/rescore-run";
import type { RivalConclusion } from "../../../src/lib/market/infer/types";

const read = (path: string): unknown => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));

interface FixtureScan {
  id: string;
  createdAt: string;
  status: StoredScanRow["status"];
  score: number | null;
  drivers: unknown;
  report: Record<string, unknown>;
  home: { created_at: string; payload: unknown } | null;
  rendered: readonly { created_at: string; payload: unknown }[];
}

/** A scan as #1429's fixtures stored it. */
const fixture = (domain: string): FixtureScan =>
  (read(`./fixtures/rescore/${domain}.json`) as { scans: FixtureScan[] }).scans[0]!;

const md5 = (report: unknown): string => createHash("md5").update(JSON.stringify(report)).digest("hex");

/** The database as the job reads and writes it: `rescore_scan`'s guard and
 *  its path-level rewrite, applied to rows held here. */
function storeOf(scans: readonly FixtureScan[], sites: StoredSiteRow[] = []) {
  const rows = new Map<string, StoredScanRow>();
  const reads = new Map<string, StoredRead[]>();
  for (const s of scans) {
    const domain = String(s.report.domain);
    rows.set(s.id, { ...s, domain, md5: md5(s.report), report: structuredClone(s.report), siteId: null, isCurrent: false });
    reads.set(domain, [
      ...(reads.get(domain) ?? []),
      ...(s.home === null ? [] : [{ source: "egress.safeFetch" as const, ...s.home }]),
      ...s.rendered.map((r) => ({ source: "on_page/instant_pages" as const, ...r })),
    ]);
  }
  const written: ScanWrite[] = [];
  const sitesWritten: SiteWrite[] = [];
  const store: RescoreStore = {
    scans: async () => [...rows.values()].map((r) => structuredClone(r)),
    homeReads: async (domain) => reads.get(domain) ?? [],
    sites: async () => sites,
    profiles: async () => [],
    answers: async () => [],
    async writeScan(w) {
      const row = rows.get(w.id)!;
      if (row.md5 !== w.md5) return false;
      written.push(w);
      const report = structuredClone(row.report) as Record<string, unknown>;
      const original = { previous: report.previous ?? structuredClone(report), previousColumns: report.previousColumns ?? { score: row.score, status: row.status, drivers: row.drivers } };
      for (const change of w.changes) {
        let at = report as Record<string | number, unknown>;
        for (const key of change.path.slice(0, -1)) at = at[key] as Record<string | number, unknown>;
        at[change.path[change.path.length - 1]!] = JSON.parse(JSON.stringify(change.value));
      }
      const next = { ...report, ...original, rescoredAt: w.at, rescoredBy: w.by };
      rows.set(w.id, { ...row, report: next, md5: md5(next), score: w.score, status: w.status, drivers: JSON.parse(JSON.stringify(w.drivers)) });
      return true;
    },
    async writeSite(w) {
      sitesWritten.push(w);
    },
  };
  return { store, rows, written, sitesWritten };
}

const at = new Date("2026-10-14T12:00:00Z");
const dry = { apply: false, version: "abc1234", at };
const apply = { apply: true, version: "abc1234", at };

describe("gusto.com's scan of 8 October (issue 1418): measured off Cloudflare's page, read again", () => {
  it("the dry run says what a new scan would — no score, degraded — and writes nothing", async () => {
    const db = storeOf([fixture("gusto.com")]);
    const answer = await rescoreStored(db.store, dry);
    expect(answer).toMatchObject({ scansRead: 1, scansChanged: 1, scansWritten: 0, scansLeft: 0 });
    expect(answer.summary).toContain("| gusto.com | free | 2026-10-08 | **0 → —** | **invisible → —** |");
    expect(answer.summary).toContain("**done → degraded**");
    expect(answer.summary).toContain("- Written: nothing (a dry run)");
    expect(db.written).toEqual([]);
  });

  it("the apply writes it under the checksum it read, keeping the original, and a second apply changes nothing", async () => {
    const db = storeOf([fixture("gusto.com")]);
    const before = db.rows.get(fixture("gusto.com").id)!;
    const answer = await rescoreStored(db.store, apply);
    expect(answer).toMatchObject({ scansChanged: 1, scansWritten: 1, scansLeft: 0 });
    expect(db.written[0]).toMatchObject({ md5: before.md5, score: null, status: "degraded", by: "abc1234" });
    const after = db.rows.get(before.id)!;
    expect((after.report as { previous: unknown }).previous).toEqual(before.report);
    expect(after.score).toBeNull();

    const again = await rescoreStored(db.store, apply);
    expect(again).toMatchObject({ scansRead: 1, scansChanged: 0, scansWritten: 0 });
    expect(db.written).toHaveLength(1);
  });

  it("a scan written after it was read is left alone and counted", async () => {
    const db = storeOf([fixture("gusto.com")]);
    const store: RescoreStore = { ...db.store, writeScan: async () => false };
    const answer = await rescoreStored(store, apply);
    expect(answer).toMatchObject({ scansWritten: 0, scansLeft: 1 });
    expect(answer.summary).toContain("left alone because the report changed after it was read: 1 — ee251330");
  });
});

describe("zapier.com's scan of 6 October: AI presence read from the one Google result read", () => {
  it("stored 27; now a rough estimate with its range (issue 1439), as a new scan would show", async () => {
    const db = storeOf([fixture("zapier.com")]);
    const answer = await rescoreStored(db.store, apply);
    expect(answer.summary).toContain("**27 → 47 (47–57, rough)**");
    expect(db.written[0]).toMatchObject({ score: 47 });
    const verdict = db.written[0]!.changes.find((c) => c.path.join(".") === "verdict")!.value as { estimate?: unknown };
    expect(verdict.estimate).toEqual({ low: 47, high: 57, confidence: "rough" });
  });
});

describe("a report from before 2 October whose questions were zero (issue 1431)", () => {
  const zapier = fixture("zapier.com");
  const zero: FixtureScan = {
    ...zapier,
    id: "2d5d2302-0000-4000-8000-000000000000",
    createdAt: "2026-09-30T09:00:00.000000+00:00",
    report: {
      ...zapier.report,
      questions: { kind: "zero", value: [], at: "2026-09-30T09:00:10.000Z" },
      rivalSizes: { kind: "zero", value: [], at: "2026-09-30T09:00:10.000Z" },
    },
  };

  it("is read and scored again beside the others, and a second apply changes nothing", async () => {
    const db = storeOf([zero, fixture("gusto.com"), zapier]);
    const answer = await rescoreStored(db.store, apply);
    expect(answer.scansRead).toBe(3);
    expect(answer.summary).toContain("not readable by this build: 0");
    expect(answer.summary).toContain("| 2d5d2302 | zapier.com |");
    const again = await rescoreStored(db.store, apply);
    expect(again).toMatchObject({ scansRead: 3, scansChanged: 0, scansWritten: 0 });
  });
});

describe("the network, while a scan is scored", () => {
  it("is refused inside offline(), and given back after, so the server's own requests are untouched", () => {
    const own = globalThis.fetch;
    const stand = (() => Promise.resolve(new Response("ok"))) as unknown as typeof fetch;
    globalThis.fetch = stand;
    try {
      expect(() => offline("scan/rescore", "stored data only", () => fetch("https://api.dataforseo.com/"))).toThrow(
        /scan\/rescore: a real network call was attempted via fetch\(\)/
      );
      expect(globalThis.fetch).toBe(stand);
    } finally {
      globalThis.fetch = own;
    }
  });

  it("a re-score that reached for it fails, and nothing is written", async () => {
    const own = globalThis.fetch;
    let called = 0;
    globalThis.fetch = (() => {
      called += 1;
      return Promise.resolve(new Response("ok"));
    }) as unknown as typeof fetch;
    try {
      const db = storeOf([fixture("gusto.com")]);
      // A stored home read whose payload reaches for the network when read.
      const reaching: StoredRead = {
        source: "egress.safeFetch",
        created_at: "2026-10-08T13:52:02.242483+00:00",
        get payload() {
          void fetch("https://gusto.com/");
          return {};
        },
      };
      const store: RescoreStore = { ...db.store, homeReads: async () => [reaching] };
      await expect(rescoreStored(store, apply)).rejects.toThrow(/a real network call was attempted/);
      expect(called).toBe(0);
      expect(db.written).toEqual([]);
    } finally {
      globalThis.fetch = own;
    }
  });
});

describe("streaksapp.com's rivals of 13 October (issue 1417), read again from what the pass stored", () => {
  const run = read("../../../docs/walk/panel/2026-10-13-1414.json") as {
    sites: { site: { domain: string }; market: { rivals: RivalConclusion[] } }[];
  };
  const stored = run.sites.find((s) => s.site.domain === "streaksapp.com")!.market.rivals;
  const evidence = read("../../../scripts/panel/evidence/streaksapp.com.json") as {
    source: string;
    cache_key: string;
    payload: { text: string; citedDomains?: string[] }[];
  }[];
  // The AI Mode answers the pass read, as a report keeps its buyer prompts.
  const marketPrompts = evidence
    .filter((e) => e.source === "serp/google/ai_mode")
    .map((e) => ({ prompt: e.cache_key, citedDomains: e.payload[0]?.citedDomains ?? [], namesSite: false, excerpt: e.payload[0]?.text ?? "" }));

  it("moves HabitNow from Google Play's domain to the site the answers link its name to, and keeps the other four", () => {
    const moved = rehomeSite({
      id: "site",
      domain: "streaksapp.com",
      competitors: stored.map((r) => r.domain),
      rivals: stored,
      overridden: false,
      report: {
        marketPrompts,
        aiAnswers: null,
        serps: [],
        measuredCategory: null,
        market: { kind: "unmeasured", reason: "not_attempted", at: new Date() },
        ownRankedRows: [],
      },
    });
    expect(stored.find((r) => r.name === "HabitNow")?.domain).toBe("google.com");
    expect(moved?.moved).toEqual([{ name: "HabitNow", from: "google.com", to: "habitnow.net" }]);
    expect(moved?.rivals.map((r) => r.domain)).toEqual(["jamesclear.com", "habi.app", "habitify.me", "loophabits.org", "habitnow.net"]);
    expect(moved?.competitors).toEqual(["jamesclear.com", "habi.app", "habitify.me", "loophabits.org", "habitnow.net"]);
  });

  it("leaves a founder's own rivals as they chose them", () => {
    expect(rehomeSite({ id: "site", domain: "streaksapp.com", competitors: [], rivals: stored, overridden: true, report: null })).toBeNull();
  });

  it("an apply writes a site whose current scan is gone with nothing moved, and keeps the old rivals beside the new", async () => {
    // With no current report there are no answers to re-home by: a rival
    // under a platform is dropped, and the first set is kept.
    const site: StoredSiteRow = { id: "s1", domain: "streaksapp.com", competitors: stored.map((r) => r.domain), market: { current: { rivals: stored } } };
    const db = storeOf([], [site]);
    const answer = await rescoreStored(db.store, apply);
    expect(answer.sitesMoved).toBe(1);
    expect(answer.summary).toContain("- streaksapp.com: HabitNow google.com → dropped");
    const write = db.sitesWritten[0]!;
    expect((write.market.rescored as { previous: { rivals: unknown } }).previous.rivals).toEqual(stored);
    expect(write.competitors).not.toContain("google.com");
  });
});

describe("a report whose questions and rival sizes were zero, read whole (issue 1431)", () => {
  const scan = fixture("gusto.com");
  const zeroed = (value?: unknown[]): FixtureScan => {
    const report = structuredClone(scan.report) as Record<string, Record<string, unknown>>;
    const at = report.questions!.at;
    report.questions = value === undefined ? { kind: "zero", at } : { kind: "zero", value, at };
    report.rivalSizes = value === undefined ? { kind: "zero", at } : { kind: "zero", value, at };
    return { ...scan, report };
  };
  const rowOf = (s: FixtureScan): StoredScanRow => ({ ...s, domain: "gusto.com", md5: md5(s.report), siteId: null, isCurrent: false });

  it("is scored again over its empty lists", () => {
    const row = rescoreRow(rowOf(zeroed([])), []);
    expect("result" in row && row.result.after.aiAnswers?.measuredSearches).toBe(0);
  });

  it("is named, not crashed on, where the stored report lost a list", async () => {
    expect(rescoreRow(rowOf(zeroed()), [])).toEqual({ id: scan.id, because: "questions is zero but the stored report carries no list" });
    const answer = await rescoreStored(storeOf([zeroed()]).store, dry);
    expect(answer.summary).toContain("not readable by this build: 1");
    expect(answer.summary).toContain("ee251330: not readable by this build — questions is zero but the stored report carries no list");
  });
});

describe("issue 1420: a mention is read again from whatever answer text was stored", () => {
  const scan = fixture("zapier.com");

  it("lists a scan whose AI Overviews were stored without their text", () => {
    const db = storeOf([scan]);
    const row = rescoreRow([...db.rows.values()][0]!, []);
    expect("result" in row && row.result.kept).toContain(KEPT_NO_OVERVIEW_TEXT);
  });

  it("the job marks a current scan's AI Mode answer named where its stored text names the site, and moves only that cell", async () => {
    const report = structuredClone(scan.report) as { aiAnswers: { rows: { question: { search: string }; engines: unknown[] }[] } };
    const first = report.aiAnswers.rows[0]!;
    first.engines = [...first.engines, { engine: "ai_mode", cell: { kind: "answered", citedDomains: ["g2.com"], namesCustomer: false } }];
    const db = storeOf([{ ...scan, report: report as unknown as Record<string, unknown> }]);
    const row = [...db.rows.values()][0]!;
    db.rows.set(row.id, { ...row, siteId: "site", isCurrent: true });
    const stored = { source: "serp/google/ai_mode", key: `${first.question.search}|United States|en|site:x`, text: "Zapier and Make are the usual picks.", citedUrls: [] };
    const asked: string[] = [];
    const store: RescoreStore = { ...db.store, answers: async (id) => (asked.push(id), [stored]) };

    const answer = await rescoreStored(store, dry);
    expect(asked).toEqual([row.id]);
    expect(answer.summary).toContain("aiAnswers.rows.0.engines.1.cell");

    const again = rescoreRow({ ...row, siteId: "site", isCurrent: true }, [], { siteName: null, answers: [stored] });
    expect("result" in again && again.result.after.aiAnswers!.rows[0]!.engines[1]!.cell).toEqual({
      kind: "answered",
      citedDomains: ["g2.com"],
      namesCustomer: false,
      named: true,
    });
  });
});
