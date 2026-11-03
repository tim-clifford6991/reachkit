// The public report's read (`readShownReport`):
// a repeat visit to a finished report reads only its status and checksum,
// and the blob again only when the checksum moves. A running scan and a
// domain with no report are never held. What it caches is the view-model the
// screen, the resolver and the share image read, so they read the same, and
// a view still too big for Next's 2 MB item is read uncached.
//
// `unstable_cache` runs for real, against Next's own `IncrementalCache` over
// an in-memory store; only the database is a double, which counts its reads.
import "../../generate/env";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

// What Next's server sets before any of its modules load.
await vi.hoisted(async () => {
  const { AsyncLocalStorage } = await import("node:async_hooks");
  (globalThis as { AsyncLocalStorage?: unknown }).AsyncLocalStorage = AsyncLocalStorage;
});

const db = vi.hoisted(() => ({
  row: null as { status: string; report: unknown } | null,
  blobReads: 0,
  stampReads: 0,
}));

vi.mock("@/lib/db", async () => {
  const { createHash } = await import("node:crypto");
  function query(table: string) {
    let columns = "";
    const self = {
      select: (c: string) => ((columns = c), self),
      eq: () => self,
      is: () => self,
      in: () => self,
      limit: () => self,
      then: (resolve: (r: unknown) => unknown, reject?: (e: unknown) => unknown) => {
        if (table !== "scans" || db.row === null) return Promise.resolve({ data: [], error: null }).then(resolve, reject);
        const md5 = db.row.report === null ? null : createHash("md5").update(JSON.stringify(db.row.report)).digest("hex");
        if (columns === "report") db.blobReads += 1;
        else db.stampReads += 1;
        const data = columns === "report" ? [{ report: db.row.report }] : [{ status: db.row.status, report_md5: md5 }];
        return Promise.resolve({ data, error: null }).then(resolve, reject);
      },
    };
    return self;
  }
  return { dbAdmin: () => ({ from: query }) };
});

/** Next's cache handler contract, held in memory. */
class MemoryHandler {
  static store = new Map<string, { value: unknown; lastModified: number }>();
  async get(key: string) {
    return MemoryHandler.store.get(key) ?? null;
  }
  async set(key: string, value: unknown) {
    MemoryHandler.store.set(key, { value, lastModified: Date.now() });
  }
  async revalidateTag() {}
  resetRequestCache() {}
}

const { IncrementalCache } = await import("next/dist/server/lib/incremental-cache");
(globalThis as { __incrementalCache?: unknown }).__incrementalCache = new IncrementalCache({
  dev: false,
  minimalMode: false,
  requestHeaders: {},
  fetchCacheKeyPrefix: "",
  CurCacheHandler: MemoryHandler as never,
  previewProps: { previewModeId: "test" } as never,
  prerenderManifest: { version: 4, routes: {}, dynamicRoutes: {}, notFoundRoutes: [] } as never,
} as never);

const { readCurrentReport, readStoredReport } = await import("@/lib/scan/report");
const { readShownReport, shownView } = await import("@/lib/scan/shown-report");
const { unreadByProtection } = await import("@/lib/scan/challenged");
const { trainingOptOutOf } = await import("@/lib/scan/sections");
const { renderReport } = await import("../../app/scan-address/panel-report");

type Blob = Record<string, unknown> & { verdict: Record<string, unknown> };

/** The SaaS panel site's stored report, as its row holds it. */
function storedBlob(): Blob {
  const file = path.resolve(import.meta.dirname, "../../../docs/walk/free/2026-10-15-1449-after.json");
  const sites = (JSON.parse(readFileSync(file, "utf8")) as { sites: { domain: string; stored: { scan: { report: Blob } } | null }[] }).sites;
  return structuredClone(sites.find((s) => s.domain === "savvycal.com" && s.stored !== null)!.stored!.scan.report);
}

const AT = "2026-10-15T12:00:00.000Z";
const half = (value: number) => ({ kind: "measured", value, at: AT });
const scored = (blob: Blob, score: number, google: number): Blob => ({
  ...blob,
  verdict: {
    ...blob.verdict,
    scoreAndBand: { kind: "measured", value: { score, band: score < 30 ? "invisible" : "hard-to-find" }, at: AT },
    halves: { google: half(google), ai: half(10) },
  },
});

/** `rescore_scan`'s write: the whole original kept under `previous`. */
function rescoredBlob(previous: unknown = scored(storedBlob(), 53, 100)): Blob {
  return {
    ...scored(storedBlob(), 14, 20),
    previous,
    previousColumns: { score: 41, status: "done", drivers: { searchPresence: half(100) } },
    rescoredAt: "2026-10-24T09:00:00.000Z",
  };
}

const DOMAIN = "savvycal.com";
const shown = () => readShownReport(DOMAIN);

beforeEach(() => {
  MemoryHandler.store.clear();
  db.row = { status: "done", report: storedBlob() };
  db.blobReads = 0;
  db.stampReads = 0;
});

describe("the public report's read", () => {
  it("reads a finished report's blob once, and a repeat visit only its status and checksum", async () => {
    const first = await shown();
    const again = await shown();
    expect(db.blobReads).toBe(1);
    expect(db.stampReads).toBe(2);
    expect(again).toEqual(first);
    expect(again?.verdict.measuredAt).toBeInstanceOf(Date);
  });

  it("reads the blob again as soon as the report changes, with no invalidation", async () => {
    await shown();
    db.row = { status: "done", report: scored(storedBlob(), 14, 20) };
    const after = await shown();
    expect(db.blobReads).toBe(2);
    expect(after?.verdict.scoreAndBand).toMatchObject({ value: { score: 14 } });
  });

  it("never holds a running scan's row", async () => {
    db.row = { status: "running", report: storedBlob() };
    await shown();
    await shown();
    expect(db.blobReads).toBe(2);
  });

  it("never holds a domain with no report, so one stored a minute later is served at once", async () => {
    db.row = null;
    expect(await shown()).toBeNull();
    db.row = { status: "done", report: null };
    expect(await shown()).toBeNull();
    db.row = { status: "done", report: storedBlob() };
    expect((await shown())?.domain).toBe(DOMAIN);
  });

  it.each([
    ["a kept report it can read", undefined],
    ["a kept report it cannot read", { version: 999 }],
  ])("renders a re-scored report the same as the full read, from %s", async (_, previous) => {
    db.row = { status: "done", report: rescoredBlob(previous) };
    const full = await readCurrentReport(DOMAIN);
    await shown();
    const cached = await shown();
    expect(db.blobReads).toBe(2);
    const html = renderReport(cached!);
    expect(html).toContain('data-testid="verdict-rescored"');
    expect(html).toBe(renderReport(full!));
  });

  it("caches nothing, and warns once, for a report still over the bound as shown", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    db.row = { status: "done", report: { ...storedBlob(), shownButHuge: "x".repeat(2 * 1024 * 1024) } };
    const first = await shown();
    const again = await shown();
    expect(db.blobReads).toBe(2);
    expect(again?.domain).toBe(DOMAIN);
    expect(again).toEqual(first);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(JSON.stringify([...MemoryHandler.store.values()]).length).toBeLessThan(10_000);
    warn.mockRestore();
  });
});

/** Every stored report in the free walks' evidence, SaaS and local alike. */
function walkBlobs(): [string, Blob][] {
  const dir = path.resolve(import.meta.dirname, "../../../docs/walk/free");
  return readdirSync(dir)
    .filter((file) => file.endsWith(".json"))
    .flatMap((file) =>
      (JSON.parse(readFileSync(path.join(dir, file), "utf8")) as { sites?: { domain: string; stored: { scan: { report: Blob } } | null }[] }).sites
        ?.filter((site) => site.stored?.scan.report)
        .map((site): [string, Blob] => [`${file} ${site.domain}`, site.stored!.scan.report]) ?? []
    );
}

/** A report shaped like the largest current one: a big site's raw robots rules,
 *  crawl list and ranked rows, with the whole original kept beside it. */
function largestShaped(): Blob {
  const base = rescoredBlob();
  const robots = base.robots as { value: Record<string, unknown> };
  const siteIssues = base.siteIssues as Record<string, unknown>;
  const url = (n: number) => `https://www.example-design-tool.com/community/file/${n}/a-long-community-file-slug-${n}`;
  const inflated: Blob = {
    ...base,
    robots: { ...robots, value: { ...robots.value, rules: { "*": Array.from({ length: 26_000 }, (_, n) => ({ allow: false, path: `/file/${n}/*` })) }, sitemaps: Array.from({ length: 2_000 }, (_, n) => url(n)) } },
    siteIssues: { ...siteIssues, checkedPages: Array.from({ length: 8_000 }, (_, n) => url(n)) },
    ownRankedRows: Array.from({ length: 6_000 }, (_, n) => ({ url: url(n), keyword: `design keyword number ${n}`, position: 1 + (n % 90), difficulty: 40, searchVolume: 1_000 })),
  };
  return { ...inflated, previous: { ...inflated, previous: undefined, rescoredAt: undefined } };
}

describe("the view-model the cache holds", () => {
  it("renders, resolves and unfurls every stored report exactly as the full report does", () => {
    const blobs = walkBlobs();
    expect(blobs.length).toBeGreaterThan(20);
    for (const [name, blob] of [...blobs, ["rescored", rescoredBlob()] as [string, Blob]]) {
      const full = readStoredReport(blob);
      const view = readStoredReport(shownView(full));
      expect(renderReport(view), name).toBe(renderReport(full));
      expect(renderReport(unreadByProtection(view)), name).toBe(renderReport(unreadByProtection(full)));
      expect(trainingOptOutOf(view.robots), name).toEqual(trainingOptOutOf(full.robots));
      expect(view.robots.kind, name).toBe(full.robots.kind);
      expect({ ...view.siteIssues, checkedPages: null }, name).toEqual({ ...full.siteIssues, checkedPages: null });
      for (const key of ["scanId", "domain", "complete", "fromIncompleteRescan", "stoppedReason", "verdict", "onPage", "market", "correctionState", "freePage", "blockedAgents", "aiAnswers", "presence", "supply", "questions", "rivals", "rivalSizes", "sources", "serps", "coherence", "finishingReads", "rescoredAt", "previousColumns"] as const) {
        expect(view[key], `${name} ${key}`).toEqual(full[key]);
      }
    }
  });

  it("holds a report shaped like the largest current one under 1.9 MB as Next measures it", async () => {
    const blob = largestShaped();
    expect(JSON.stringify(blob).length).toBeGreaterThan(6_000_000);
    expect(JSON.stringify({ ...blob, previous: undefined }).length).toBeGreaterThan(3_000_000);
    const full = readStoredReport(blob);
    const view = shownView(full);
    expect(JSON.stringify(JSON.stringify(view)).length).toBeLessThan(1.9 * 1024 * 1024);
    expect(renderReport(readStoredReport(view))).toBe(renderReport(full));

    db.row = { status: "done", report: blob };
    await shown();
    await shown();
    expect(db.blobReads).toBe(1);
  });
});
