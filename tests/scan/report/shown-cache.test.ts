// The public report's read (`readCurrentReport(domain, { cached: true })`):
// a repeat visit to a finished report reads only its status and checksum,
// and the blob again only when the checksum moves. A running scan and a
// domain with no report are never held. What it caches is what the screen
// renders, so the screen reads the same.
//
// `unstable_cache` runs for real, against Next's own `IncrementalCache` over
// an in-memory store; only the database is a double, which counts its reads.
import "../../generate/env";
import { readFileSync } from "node:fs";
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

const { readCurrentReport } = await import("@/lib/scan/report");
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
const shown = () => readCurrentReport(DOMAIN, { cached: true });

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

  it("holds the kept copy only as the score its line names", async () => {
    db.row = { status: "done", report: rescoredBlob() };
    await shown();
    const [entry] = [...MemoryHandler.store.values()];
    const held = JSON.stringify(entry?.value);
    expect(held.length).toBeLessThan(JSON.stringify(rescoredBlob()).length * 0.6);
  });
});
