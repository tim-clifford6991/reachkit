// Issues 1426 and 1433 — stored scans and a stored rival set, read again by
// the current code from what was stored, as the `scan/rescore` job reads
// them: the rows whole, through a store that stands in for the database.
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { offline } from "../../../src/lib/egress/offline";
import { KEPT_CONTENT_PAGES, KEPT_NO_OVERVIEW_TEXT, KEPT_TOWN_BOUGHT, rehomeSite } from "../../../src/lib/scan/rescore";
import {
  answerRequest,
  claimRequest,
  livePagesAt,
  measuredOf,
  rescoreRow,
  rescoreStored,
  type RescoreQueue,
  type RescoreStore,
  type ProfileNameWrite,
  type ScanWrite,
  type SiteWrite,
  type StoredProfileName,
  type StoredRead,
  type StoredScanRow,
  type StoredSiteRow,
} from "../../../src/lib/scan/rescore-run";
import type { RivalConclusion } from "../../../src/lib/market/infer/types";
import type { RunRecord } from "../../../src/lib/scan/derivation";

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
function storeOf(scans: readonly FixtureScan[], sites: StoredSiteRow[] = [], profiles: StoredProfileName[] = []) {
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
  const namesWritten: ProfileNameWrite[] = [];
  const store: RescoreStore = {
    scans: async () => [...rows.values()].map((r) => structuredClone(r)),
    homeReads: async (domain) => reads.get(domain) ?? [],
    ownReads: async () => ({ own: [], ours: [], oursReads: [] }),
    sites: async () => sites,
    profiles: async () => profiles.map((p) => ({ ...p })),
    answers: async () => [],
    async writeScan(w) {
      const row = rows.get(w.id)!;
      if (row.md5 !== w.md5) return false;
      written.push(w);
      const report = structuredClone(row.report) as Record<string, unknown>;
      const original = { previous: report.previous ?? structuredClone(report), previousColumns: report.previousColumns ?? { score: row.score, status: row.status, drivers: row.drivers } };
      for (const change of w.changes) {
        if (change.path.length === 0) {
          for (const key of Object.keys(report)) delete report[key];
          Object.assign(report, JSON.parse(JSON.stringify(change.value)));
          continue;
        }
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
    async writeProfileName(w) {
      const row = profiles.find((p) => p.domain === w.domain);
      if (row === undefined || row.site_name !== w.from) return false;
      row.site_name = w.to;
      namesWritten.push(w);
      return true;
    },
  };
  return { store, rows, written, sitesWritten, namesWritten };
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

describe("stored placeholders, names and dates, read again at 0¢ (issue 1479)", () => {
  it("gusto.com's stored category <UNKNOWN> is written as none, and a second apply changes nothing", async () => {
    const db = storeOf([fixture("gusto.com")]);
    await rescoreStored(db.store, apply);
    const profile = db.written[0]!.changes.find((c) => c.path.join(".") === "market.value.profile");
    expect(profile?.value).toEqual({ category: "" });
    // Only the replaced report, kept under `previous`, still holds it.
    expect((db.rows.get(fixture("gusto.com").id)!.report as { market: unknown }).market).toMatchObject({ value: { profile: { category: "" } } });
    expect(await rescoreStored(db.store, apply)).toMatchObject({ scansChanged: 0, scansWritten: 0 });
  });

  it("a report dated by a cached page read wears its scan's date", async () => {
    // sage.com's of 10 October 22:52 showed Oct 9, the home read's date (issue 1392).
    const zapier = fixture("zapier.com");
    const verdict = zapier.report.verdict as Record<string, unknown>;
    const cached: FixtureScan = { ...zapier, report: { ...zapier.report, verdict: { ...verdict, measuredAt: "2026-10-05T09:00:00.000Z" } } };
    const db = storeOf([cached]);
    const answer = await rescoreStored(db.store, apply);
    expect(answer.scansWritten).toBe(1);
    const written = db.written[0]!.changes.find((c) => c.path.join(".") === "verdict")!.value as { measuredAt: Date };
    expect(new Date(written.measuredAt).toISOString()).toBe(new Date(zapier.createdAt).toISOString());
    expect(new Date(db.written[0]!.drivers.foundations.at).toISOString()).toBe(new Date(zapier.createdAt).toISOString());
    expect(await rescoreStored(db.store, apply)).toMatchObject({ scansChanged: 0, scansWritten: 0 });
  });

  it("a report dated at or after its scan keeps its date", async () => {
    const db = storeOf([fixture("zapier.com")]);
    await rescoreStored(db.store, apply);
    const verdict = db.written[0]?.changes.find((c) => c.path.join(".") === "verdict")?.value as { measuredAt: Date } | undefined;
    expect(new Date(verdict!.measuredAt).toISOString()).toBe("2026-10-06T03:43:51.829Z");
  });

  // What production stored for these, as the audits of 2026-10-17 read them.
  const profiles = (): StoredProfileName[] => [
    { domain: "hotjar.com", site_name: "Sign up for free", home_title: "Hotjar: Website Heatmaps & Behavior Analytics Tools" },
    { domain: "deel.com", site_name: "HRIS", home_title: "Global Payroll & Compliance | HRIS" },
    { domain: "sage.com", site_name: "Cloudflare", home_title: "Attention Required! | Cloudflare" },
    { domain: "freshworks.com", site_name: "Just a moment...", home_title: "Just a moment..." },
    { domain: "example.com", site_name: "<UNKNOWN>", home_title: null },
    { domain: "paddle.com", site_name: "Paddle - Subscriptions, Payments & Tax Compliance for SaaS & Mobile Apps", home_title: null },
    { domain: "hubspot.com", site_name: "Hubspot", home_title: "HubSpot | Software & Tools for your Business - Homepage" },
    { domain: "reachkit.app", site_name: "ReachKit", home_title: "ReachKit" },
    { domain: "cloudflare.com", site_name: "Cloudflare", home_title: "Connect, protect, and build everywhere | Cloudflare" },
    { domain: "nifty.pm", site_name: null, home_title: null },
  ];

  it("every stored name that is no name is written as the name rule reads it, and counted as a site that moves", async () => {
    const db = storeOf([], [], profiles());
    const dryRun = await rescoreStored(db.store, dry);
    expect(dryRun.sitesMoved).toBe(7);
    expect(db.namesWritten).toEqual([]);
    expect(dryRun.summary).toContain('deel.com "HRIS" → "Deel"');

    const answer = await rescoreStored(db.store, apply);
    expect(answer.sitesMoved).toBe(7);
    expect(Object.fromEntries(db.namesWritten.map((w) => [w.domain, w.to]))).toEqual({
      "hotjar.com": "Hotjar",
      "deel.com": "Deel",
      "sage.com": null,
      "freshworks.com": null,
      "example.com": null,
      "paddle.com": "Paddle",
      "hubspot.com": "HubSpot",
    });
    expect(answer.summary).toContain("7 written");
    expect(await rescoreStored(db.store, apply)).toMatchObject({ sitesMoved: 0 });
  });

  it("a name written since it was read is left alone", async () => {
    const db = storeOf([], [], profiles());
    const store: RescoreStore = { ...db.store, writeProfileName: async () => false };
    const answer = await rescoreStored(store, apply);
    expect(answer.summary).toContain("0 written");
  });
});

describe("zapier.com's scan of 6 October: AI presence read from the one Google result read", () => {
  it("stored 27; now a rough estimate whose range spans its one Google search on page one, as a new scan would show", async () => {
    const db = storeOf([fixture("zapier.com")]);
    const answer = await rescoreStored(db.store, apply);
    expect(answer.summary).toContain("**27 → 47 (28–57, rough)**");
    expect(db.written[0]).toMatchObject({ score: 47 });
    const verdict = db.written[0]!.changes.find((c) => c.path.join(".") === "verdict")!.value as { estimate?: unknown };
    expect(verdict.estimate).toEqual({ low: 28, high: 57, confidence: "rough" });
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

describe("issue 1539: what a tracked-prompt answer states of the business is read again from its stored text", () => {
  it("a stored answer that names the site and gives a price gains it at its own path, and nothing else moves for it", () => {
    const scan = fixture("zapier.com");
    const report = structuredClone(scan.report) as Record<string, unknown>;
    report.prompts = {
      siteName: "Zapier",
      asked: [{ id: "p1", kind: "branded", text: "How much does Zapier cost?" }],
      asks: 2,
      answers: [{ promptId: "p1", engine: "chatgpt", run: 2, named: true, linked: false, ownUrls: [], rivals: [] }],
    };
    const db = storeOf([{ ...scan, report }]);
    const row = { ...[...db.rows.values()][0]!, siteId: "site", isCurrent: true };
    const text = "Zapier plans start at $19.99 a month.";
    const answers = [
      { source: "ai_optimization/chat_gpt/llm_scraper", key: "How much does Zapier cost?|United States|en|site:x", text: "Make costs $9.", citedUrls: [] },
      { source: "ai_optimization/chat_gpt/llm_scraper", key: "How much does Zapier cost?|United States|en|site:x|run:2", text: text.slice(0, 10), whole: text, citedUrls: [] },
    ];
    const again = rescoreRow(row, [], { siteName: "Zapier", answers });
    const change = "result" in again ? again.result.changes.find((c) => c.path[0] === "prompts") : undefined;
    expect(change).toEqual({
      path: ["prompts", "answers", 0, "states"],
      value: [{ kind: "price", raw: "$19.99", says: text, key: "$", values: ["19.99"] }],
    });
  });
});

describe("a stored tracked-prompt answer gains the pages it cited on other sites, from what fetches kept", () => {
  it("a competitor's page is written at its own path, its tracking and the site's own pages and homes left out", () => {
    const scan = fixture("zapier.com");
    const report = structuredClone(scan.report) as Record<string, unknown>;
    report.prompts = {
      siteName: "Zapier",
      asked: [{ id: "p1", kind: "category", text: "Best automation tool?" }],
      asks: 1,
      answers: [{ promptId: "p1", engine: "chatgpt", run: 1, named: false, linked: false, ownUrls: [], rivals: [] }],
    };
    const db = storeOf([{ ...scan, report }]);
    const row = { ...[...db.rows.values()][0]!, siteId: "site", isCurrent: true };
    const citedUrls = ["https://make.com/en/integrations/slack?utm_source=chatgpt.com", "https://make.com/", "https://zapier.com/blog/best-automation/"];
    const answers = [{ source: "ai_optimization/chat_gpt/llm_scraper", key: "Best automation tool?|United States|en|site:x", text: "Make leads.", citedUrls }];
    const again = rescoreRow(row, [], { siteName: "Zapier", answers });
    const change = "result" in again ? again.result.changes.find((c) => c.path[0] === "prompts") : undefined;
    expect(change).toEqual({ path: ["prompts", "answers", 0, "cited"], value: ["https://make.com/en/integrations/slack"] });
  });
});

describe("search presence is re-scored at 0¢ as the stored card's page-one share (owner, 2026-10-22)", () => {
  // gusto.com's stored scan: Google 10/10 from its Labs reach, beside a card of 0 of 1.
  const scan = fixture("gusto.com");
  const withReport = (edit: (report: Record<string, unknown>) => void): FixtureScan => {
    const report = structuredClone(scan.report);
    edit(report);
    return { ...scan, report };
  };
  const googleOf = (s: FixtureScan): unknown => {
    const row = rescoreRow({ ...s, domain: "gusto.com", md5: md5(s.report), siteId: null, isCurrent: false }, []);
    if (!("result" in row)) throw new Error(row.because);
    return { driver: row.result.drivers.searchPresence, kept: row.result.kept };
  };

  it("a stored bar of 10 beside a card of 0 is re-scored to 0, the old value kept under previousColumns, with no request made", async () => {
    expect(scan.drivers).toMatchObject({ searchPresence: { kind: "measured", value: 100 } });
    const fetched = vi.spyOn(globalThis, "fetch");
    const db = storeOf([scan]);
    await rescoreStored(db.store, apply);
    expect(fetched).not.toHaveBeenCalled();
    fetched.mockRestore();
    const after = db.rows.get(scan.id)!;
    expect(after.drivers).toMatchObject({ searchPresence: { kind: "zero", value: 0 } });
    expect((after.report as { verdict: { halves: { google: unknown } } }).verdict.halves.google).toMatchObject({ kind: "zero", value: 0 });
    expect((after.report as { previousColumns: { drivers: unknown } }).previousColumns.drivers).toEqual(scan.drivers);
  });

  it("a stored SERP whose local pack shows the site counts that search as page one", () => {
    const packed = withReport((report) => {
      const first = (report.serps as { kind: string; value: Record<string, unknown> }[]).find((serp) => serp.kind === "measured")!;
      first.value.localPack = [{ title: "Gusto", domain: "www.gusto.com" }];
    });
    expect(googleOf(packed)).toMatchObject({ driver: { kind: "measured", value: 100 } });
  });

  it("a report with no stored card, or no measured search, keeps its stored value until its next scan", () => {
    for (const edit of [
      (report: Record<string, unknown>) => (report.presence = null),
      (report: Record<string, unknown>) => (report.serps = []),
    ]) {
      const { driver, kept } = googleOf(withReport(edit)) as { driver: unknown; kept: string[] };
      expect(driver).toMatchObject({ kind: "measured", value: 100 });
      expect(kept).toContain("search presence: the report kept no measured search, so its stored value stands");
    }
  });
});

describe("the score's range spans a Google share counted over few searches, re-scored at 0¢", () => {
  // Foundations 100 and Content 30 as stored, four searches measured, the
  // site on page one for none, and no AI answer on any of them.
  const gusto = fixture("gusto.com");
  const fourSearches = (): FixtureScan => {
    type Rows<T> = { value: T[] };
    const report = structuredClone(gusto.report) as Record<string, unknown> & { serps: unknown[]; questions: Rows<{ search: object }>; aiAnswers: { rows: object[] }; onPage: { at: string } };
    const [serp] = report.serps;
    const [question] = report.questions.value;
    const [row] = report.aiAnswers.rows;
    const searches = ["payroll software", "payroll for small business", "online payroll", "hr and payroll"];
    report.onPage = { kind: "unmeasured", reason: "not_attempted", at: report.onPage.at } as typeof report.onPage;
    report.serps = searches.map(() => structuredClone(serp));
    report.questions.value = searches.map((keyword, i) => ({ ...question!, id: `q${i + 1}`, search: { ...question!.search, keyword } }));
    report.aiAnswers.rows = searches.map((search) => ({ ...structuredClone(row), question: { search } }));
    const storedAt = report.onPage.at;
    const drivers = { ...(gusto.drivers as object), foundations: { kind: "measured", value: 100, at: storedAt }, answerability: { kind: "measured", value: 30, at: storedAt } };
    return { ...gusto, id: "4f0c0de0-0000-4000-8000-000000000004", drivers, report };
  };
  const verdictWritten = (db: ReturnType<typeof storeOf>) =>
    db.written[0]!.changes.find((c) => c.path.join(".") === "verdict")!.value as { scoreAndBand: { value: { score: number } }; estimate?: unknown };

  it("0 of 4 on page one re-scores to 14 with an estimate of 14–53, rough, with no request made", async () => {
    const fetched = vi.spyOn(globalThis, "fetch");
    const db = storeOf([fourSearches()]);
    await rescoreStored(db.store, apply);
    expect(fetched).toHaveBeenCalledTimes(0);
    fetched.mockRestore();
    expect(db.written[0]).toMatchObject({ score: 14 });
    expect(verdictWritten(db).estimate).toEqual({ low: 14, high: 53, confidence: "rough" });
  });

  it("a report with no stored card keeps the estimate its stored Google value gives", async () => {
    const scan = fourSearches();
    (scan.report as Record<string, unknown>).presence = null;
    const db = storeOf([scan]);
    await rescoreStored(db.store, apply);
    expect(verdictWritten(db).estimate).toEqual({ low: 67, high: 67, confidence: "rough" });
  });
});

describe("issue 1481: a deploy that changes how a scan is read is followed by a dry run, then an apply, with nobody asking", () => {
  const DERIVATION = "f026342a5919";

  /** `rescore_runs` as the tick reads and writes it, over the store above. */
  function queueOf(db: ReturnType<typeof storeOf>) {
    const runs: (RunRecord & { id: string; started: boolean; auto: boolean; stale: readonly string[] | null })[] = [];
    let asked = 0;
    const queue: RescoreQueue & RescoreStore = {
      ...db.store,
      async claim() {
        const next = runs.find((r) => !r.started);
        if (next === undefined) return null;
        next.started = true;
        return { id: next.id, mode: next.mode };
      },
      runs: async () => runs.map((r) => ({ ...r })),
      async ask(mode, when) {
        asked += 1;
        runs.push({
          id: `run-${asked}`,
          mode,
          auto: true,
          started: false,
          derivation: null,
          requestedAt: new Date(when.getTime() + asked).toISOString(),
          finishedAt: null,
          error: null,
          held: null,
          scansChanged: null,
          sitesMoved: null,
          unreadable: null,
          stale: null,
        });
      },
      async answer(id, a, o) {
        Object.assign(runs.find((r) => r.id === id)!, {
          finishedAt: o.at.toISOString(),
          derivation: o.derivation ?? null,
          held: a.held,
          scansChanged: a.scansChanged,
          sitesMoved: a.sitesMoved,
          unreadable: a.scansUnreadable,
          stale: a.stale,
        });
      },
      async failed(id, error, o) {
        Object.assign(runs.find((r) => r.id === id)!, { finishedAt: o.at.toISOString(), error, derivation: o.derivation ?? null });
      },
    };
    /** One tick of `scan/rescore` in production at the deployed derivation. */
    async function tick(derivation = DERIVATION) {
      const request = await claimRequest(at, derivation, queue, true);
      if (request !== null && "id" in request) await answerRequest(request, { version: "abc1234", derivation, at }, queue);
      return request;
    }
    return { queue, runs, tick };
  }

  /** zapier.com's stored scan with a stored score of 40: read again it is 47,
   *  a move the guard expects. */
  const near = ((): FixtureScan => {
    const s = fixture("zapier.com");
    const report = structuredClone(s.report) as Record<string, unknown> & { verdict: { scoreAndBand: { value: { score: number } } } };
    report.verdict.scoreAndBand.value.score = 40;
    return { ...s, score: 40, report };
  })();

  it("asks the dry run, then the apply where the guard holds, then a dry run that finds nothing left", async () => {
    const db = storeOf([near]);
    const { runs, tick } = queueOf(db);

    await tick();
    expect(runs.map((r) => [r.mode, r.auto, r.derivation, r.held, r.scansChanged])).toEqual([["dry", true, DERIVATION, null, 1]]);
    expect(runs[0]!.stale).toEqual([near.id]);
    expect(db.written).toEqual([]);

    await tick();
    expect(runs[1]).toMatchObject({ mode: "apply", auto: true, derivation: DERIVATION, scansChanged: 1, stale: [] });
    expect(db.written[0]).toMatchObject({ id: near.id, score: 47, by: "abc1234" });
    expect((db.rows.get(near.id)!.report as { rescoredBy?: string }).rescoredBy).toBe("abc1234");

    await tick();
    expect(runs[2]).toMatchObject({ mode: "dry", auto: true, scansChanged: 0, held: null, stale: [] });

    // Settled: the next tick at the same derivation asks nothing.
    await expect(tick()).resolves.toBeNull();
    expect(runs).toHaveLength(3);
  });

  it("a deploy that does not change the derivation asks nothing again; one that does starts over", async () => {
    const db = storeOf([near]);
    const { runs, tick } = queueOf(db);
    for (let i = 0; i < 4; i += 1) await tick();
    expect(runs).toHaveLength(3);
    await tick("0a1b2c3d4e5f");
    expect(runs.at(-1)).toMatchObject({ mode: "dry", derivation: "0a1b2c3d4e5f", scansChanged: 0 });
    await expect(tick("0a1b2c3d4e5f")).resolves.toBeNull();
  });

  it("holds the apply where a score moves further than the guard allows, or loses its number, and says why on every tick", async () => {
    const db = storeOf([fixture("gusto.com"), fixture("zapier.com")]);
    const { runs, tick } = queueOf(db);
    await tick();
    expect(runs[0]!.held).toBe("zapier.com moves 20 points (27 → 47), more than 15; gusto.com loses its score (0 → none)");
    expect(runs[0]!.stale).toEqual([fixture("zapier.com").id, fixture("gusto.com").id]);
    await expect(tick()).resolves.toEqual({ held: runs[0]!.held });
    await expect(tick()).resolves.toEqual({ held: runs[0]!.held });
    expect(runs).toHaveLength(1);
    expect(db.written).toEqual([]);
  });

  it("holds where the build cannot read a stored scan the run before could", async () => {
    const db = storeOf([near]);
    const { queue, runs, tick } = queueOf(db);
    const unreadable: RescoreQueue & RescoreStore = {
      ...queue,
      scans: async () => [...(await queue.scans()), { ...(await queue.scans())[0]!, id: "00000000-0000-0000-0000-000000000001", report: "not a report" }],
    };
    for (let i = 0; i < 3; i += 1) await tick("0a1b2c3d4e5f");
    expect(runs.at(-1)).toMatchObject({ unreadable: 0, scansChanged: 0 });
    const writes = db.written.length;
    const request = await claimRequest(at, DERIVATION, unreadable, true);
    if (request === null || !("id" in request)) throw new Error("no request");
    await answerRequest(request, { version: "abc1234", derivation: DERIVATION, at }, unreadable);
    expect(runs.at(-1)!.held).toBe("1 stored scans this build cannot read, 0 before");
    await expect(claimRequest(at, DERIVATION, unreadable, true)).resolves.toEqual({ held: runs.at(-1)!.held });
    expect(db.written).toHaveLength(writes);
  });

  it("a check that still finds moves after the apply is the apply lagging: held, and the scans it names stay stale", async () => {
    const db = storeOf([near]);
    const lagging: RescoreStore = { ...db.store, writeScan: async () => false };
    const { queue, runs } = queueOf(db);
    const q = { ...queue, writeScan: lagging.writeScan };
    for (let i = 0; i < 3; i += 1) {
      const request = await claimRequest(at, DERIVATION, q, true);
      if (request !== null && "id" in request) await answerRequest(request, { version: "abc1234", derivation: DERIVATION, at }, q);
    }
    expect(runs.map((r) => r.mode)).toEqual(["dry", "apply", "dry"]);
    expect(runs[1]).toMatchObject({ stale: [near.id] });
    expect(runs[2]!.held).toBe("after the apply, 1 scan still reads differently from the deployed code");
    await expect(claimRequest(at, DERIVATION, q, true)).resolves.toEqual({ held: runs[2]!.held });
  });

  it("a request the master session inserted is answered first, and outside production nothing is asked", async () => {
    const db = storeOf([near]);
    const { queue, runs } = queueOf(db);
    await expect(claimRequest(at, DERIVATION, queue, false)).resolves.toBeNull();
    await expect(claimRequest(at, null, queue, true)).resolves.toBeNull();
    expect(runs).toEqual([]);
  });
});

describe("issue 1504: a free scan's town its profile no longer reads stands where its searches were bought, and is stale", () => {
  // gusto.com's stored scan, with close.com's place and profile as stored on
  // 16 October: a CRM read as software, sold internationally, whose
  // searches were bought in Austin off the town its footer gave.
  const withPlace = (profile: Record<string, unknown>): FixtureScan => {
    const s = fixture("gusto.com");
    const report = structuredClone(s.report) as Record<string, unknown> & { market: { value: { profile: Record<string, unknown> } } };
    report.locale = { country: "US", language: "en", place: { name: "Austin", region: "Texas", location: "Austin,Texas,United States" }, placeFrom: "page_text" };
    report.market.value.profile = { ...report.market.value.profile, category: "sales CRM software", ...profile };
    return { ...s, report };
  };
  const close = withPlace({ kind: "software", reach: "international", town: "Austin, Texas" });
  const plumber = withPlace({ kind: "local-service", reach: "local", town: "Austin, Texas", category: "plumber" });
  const rescored = (s: FixtureScan) => {
    const result = rescoreRow({ ...s, domain: "gusto.com", md5: md5(s.report), report: structuredClone(s.report), siteId: null, isCurrent: false }, []);
    if (!("result" in result)) throw new Error(result.because);
    return result.result;
  };

  it("software sold internationally keeps its town and the rivals read there, and is stale", () => {
    const result = rescored(close);
    expect(result.changes.find((change) => change.path[0] === "locale")).toBeUndefined();
    expect(result.after.rivals).toEqual(rescored(plumber).after.rivals);
    expect(result.stale).toBe(true);
    expect(result.kept).toContain(KEPT_TOWN_BOUGHT);
  });

  it("a plumber whose profile reads Austin keeps it, and is not stale", () => {
    const result = rescored(plumber);
    expect(result.changes.find((change) => change.path[0] === "locale")).toBeUndefined();
    expect(result.stale).toBe(false);
  });

  it("the run lists it stale after the apply, though nothing is left to write", async () => {
    const db = storeOf([close]);
    expect((await rescoreStored(db.store, apply)).stale).toEqual([close.id]);
    const check = await rescoreStored(db.store, dry);
    expect(check.scansChanged).toBe(0);
    expect(check.stale).toEqual([close.id]);
    expect((db.rows.get(close.id)!.report as { locale: unknown }).locale).toEqual(close.report.locale);
  });
});

describe("issue 1551: a paid scan's Content is read again over its measured pages, from their stored reads", () => {
  const scan = fixture("zapier.com");
  const home = scan.home!;
  const page = (url: string, html: string, created_at = "2026-10-06T03:44:00Z") => ({
    url,
    created_at,
    payload: { url, status: 200, html, bytes: html.length, readAt: created_at },
  });
  const ARTICLE = "<html><body><h2>How do I connect two apps?</h2><p>Pick 2 apps and 1 trigger.</p><h2>Is it free?</h2><p>Yes, for 100 tasks.</p></body></html>";
  const own = [
    { url: "https://zapier.com/", created_at: home.created_at, payload: home.payload },
    page("https://zapier.com/sitemap.xml", '<?xml version="1.0"?><urlset><url><loc>https://zapier.com/apps</loc></url></urlset>'),
    ...Array.from({ length: 4 }, (_, i) => page(`https://zapier.com/guide-${i}`, ARTICLE)),
  ];
  const ours = "https://content.zapier.com/how-to-connect-apps";
  const homeRead = [{ source: "egress.safeFetch" as const, ...home }];
  const paid = () => {
    const report = { ...structuredClone(scan.report), tier: "weekly" };
    const db = storeOf([{ ...scan, report }]);
    const row = [...db.rows.values()][0]!;
    db.rows.set(row.id, { ...row, siteId: "site" });
    return { db, row: { ...row, siteId: "site" } };
  };

  it("names ReachKit's live pages first, then the pages the scan read, and no sitemap", () => {
    const measured = measuredOf({ own, ours: [ours], oursReads: [page(ours, ARTICLE, "2026-10-05T07:00:00Z"), page(ours, "<html></html>", "2026-10-07T00:00:00Z")] })!;
    // The fixture's stored home keeps no bytes; the home is never a measured page either way.
    expect(measured.pages).toEqual([ours, ...own.slice(2).map((r) => r.url)]);
    expect(measured.reads.get(ours)).toEqual(page(ours, ARTICLE, "2026-10-05T07:00:00Z").payload);
    expect(measuredOf({ own: [], ours: [ours], oursReads: [] })).toBeUndefined();
  });

  it("reads a page as live where it was published before the scan and not taken down until after", () => {
    const at = "2026-10-10T00:00:00Z";
    expect(
      livePagesAt(
        [
          { live_url: "https://c.x/a", published_at: "2026-10-03T00:00:00Z", unpublished_at: null },
          { live_url: "https://c.x/b", published_at: "2026-10-05T00:00:00Z", unpublished_at: "2026-10-12T00:00:00Z" },
          { live_url: "https://c.x/c", published_at: "2026-10-06T00:00:00Z", unpublished_at: "2026-10-08T00:00:00Z" },
          { live_url: "https://c.x/d", published_at: "2026-10-11T00:00:00Z", unpublished_at: null },
        ],
        at
      )
    ).toEqual(["https://c.x/b", "https://c.x/a"]);
  });

  it("five measured pages beside the home move Content, and so the score; home alone stands as stored", async () => {
    const { db, row } = paid();
    const stored = rescoreRow(row, homeRead);
    const reads = { own, ours: [ours], oursReads: [page(ours, ARTICLE, "2026-10-05T07:00:00Z")] };
    const read = rescoreRow(row, homeRead, { siteName: null, answers: [], measured: measuredOf(reads) });
    if (!("result" in stored) || !("result" in read)) throw new Error("unreadable");
    const valueOf = (m: { kind: string; value?: number }): number | undefined => m.value;
    expect(valueOf(stored.result.drivers.answerability)).toBeCloseTo(20.543433689506923, 9);
    expect(read.result.drivers.answerability.kind).toBe("measured");
    expect(valueOf(read.result.drivers.answerability)).not.toBeCloseTo(20.543433689506923, 3);
    expect(read.result.kept).not.toContain(KEPT_CONTENT_PAGES);

    const answer = await rescoreStored({ ...db.store, ownReads: async () => reads }, dry);
    expect(answer.scansChanged).toBe(1);
  });

  it("a measured page with no stored read is named, and the rest are read", () => {
    const { row } = paid();
    const read = rescoreRow(row, homeRead, { siteName: null, answers: [], measured: measuredOf({ own, ours: [ours], oursReads: [] }) });
    expect("result" in read && read.result.kept).toContain(KEPT_CONTENT_PAGES);
  });
});

describe("the other markets a stored home read declares are counted at 0¢", () => {
  const declaring = (scan: FixtureScan): FixtureScan => {
    const payload = scan.home!.payload as Record<string, unknown>;
    const alternates = ["en", "de-de", "fr-fr"].map((tag) => `<link rel="alternate" hreflang="${tag}" href="https://zapier.com/${tag === "en" ? "" : `${tag}/`}">`).join("");
    return { ...scan, home: { ...scan.home!, payload: { ...payload, html: `<html lang="en"><head>${alternates}</head><body></body></html>` } } };
  };

  it("a report whose stored home read declares them gains them, and a second apply changes nothing", async () => {
    const scan = declaring(fixture("zapier.com"));
    expect(String((scan.home!.payload as { html: string }).html)).toContain('hreflang="de-de"');
    const db = storeOf([scan]);
    await rescoreStored(db.store, apply);
    expect((db.rows.get(scan.id)!.report as { locale?: unknown }).locale).toEqual({ country: "US", language: "en", alsoServes: ["de-de", "fr-fr"] });
    const again = await rescoreStored(db.store, apply);
    expect(again).toMatchObject({ scansChanged: 0 });
  });

  it("a report whose home read is gone keeps what it has, until its next scan", async () => {
    const scan = { ...declaring(fixture("zapier.com")), home: null };
    const db = storeOf([scan]);
    await rescoreStored(db.store, apply);
    expect((db.rows.get(scan.id)!.report as { locale?: unknown }).locale).toBeUndefined();
  });
});
