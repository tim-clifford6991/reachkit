// SPEC §2 2026-09-24 (#1069): a removed site leaves `/scans` at once, and a
// scan finished a minute ago is already there. The gallery's reads are
// cached so a crawler walking every filter costs one read per view per
// window; the cache is keyed by an uncached fingerprint of the removals and
// the newest scan, so neither promise waits on it.
//
// `unstable_cache` runs for real, against Next's own `IncrementalCache` over
// an in-memory store; only the database is a double, which counts its reads
// and answers the view as the migration defines it.
import "../../generate/env";
import { beforeEach, describe, expect, it, vi } from "vitest";

interface ListingRow {
  domain: string;
  company: string;
  score: number | null;
  category: string | null;
  scanned_at: string;
  has_logo: boolean;
}

// What Next's server sets before any of its modules load.
await vi.hoisted(async () => {
  const { AsyncLocalStorage } = await import("node:async_hooks");
  (globalThis as { AsyncLocalStorage?: unknown }).AsyncLocalStorage = AsyncLocalStorage;
});

const db = vi.hoisted(() => ({
  scans: [] as ListingRow[],
  blocks: [] as { domain: string; blocked_at: string }[],
  reads: new Map<string, number>(),
}));

vi.mock("@/lib/db", () => {
  function query(table: string) {
    const eq = new Map<string, unknown>();
    let term = "";
    const self = {
      select: () => self,
      or: (filter: string) => ((term = /\*(.*?)\*/.exec(filter)?.[1] ?? ""), self),
      order: () => self,
      in: () => self,
      range: () => self,
      limit: () => self,
      eq: (column: string, value: unknown) => (eq.set(column, value), self),
      then: (resolve: (r: unknown) => unknown, reject?: (e: unknown) => unknown) => {
        db.reads.set(table, (db.reads.get(table) ?? 0) + 1);
        return Promise.resolve(answer(table, eq, term)).then(resolve, reject);
      },
    };
    return self;
  }
  function answer(table: string, eq: Map<string, unknown>, term: string) {
    if (table === "free_scan_listing") {
      const blocked = new Set(db.blocks.map((b) => b.domain));
      const rows = db.scans
        .filter((r) => !blocked.has(r.domain))
        .filter((r) => r.domain.includes(term))
        .filter((r) => (eq.has("category") ? r.category === eq.get("category") : true))
        .filter((r) => (eq.has("domain") ? r.domain === eq.get("domain") : true));
      return { data: rows, error: null, count: rows.length };
    }
    if (table === "domain_blocks") {
      const newest = [...db.blocks].sort((x, y) => y.blocked_at.localeCompare(x.blocked_at));
      return { data: newest.slice(0, 1), error: null, count: db.blocks.length };
    }
    if (table === "scans") {
      const newest = db.scans.map((r) => r.scanned_at).sort().at(-1);
      return { data: newest === undefined ? [] : [{ finished_at: newest }], error: null };
    }
    return { data: [], error: null };
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
  getPrerenderManifest: () =>
    ({ version: 4, routes: {}, dynamicRoutes: {}, notFoundRoutes: [], preview: { previewModeId: "test" } }) as never,
} as never);

function scan(domain: string, at: string, category = "Bike repair"): ListingRow {
  return { domain, company: domain, score: 47, category, scanned_at: at, has_logo: false };
}

const listingReads = () => db.reads.get("free_scan_listing") ?? 0;
const VIEW = { search: "", category: null, sort: "newest", shown: 16 } as const;

beforeEach(() => {
  MemoryHandler.store.clear();
  db.reads.clear();
  db.blocks = [];
  db.scans = [scan("harbour.example", "2026-09-23T10:00:00.000Z"), scan("quay.example", "2026-09-22T10:00:00.000Z", "Plumbing")];
});

describe("the gallery's cache", () => {
  it("reads one view once inside the window, whichever card count or extra parameter asked for it", async () => {
    const { readGallery } = await import("@/lib/scan/gallery");
    const first = await readGallery(VIEW);
    const again = await readGallery({ ...VIEW, shown: 17 });
    expect(listingReads()).toBe(2); // the cards and the chips, once
    expect(again).toEqual(first);
    expect(again.entries[0]?.scannedAt).toBeInstanceOf(Date);
    await readGallery({ ...VIEW, sort: "az" });
    expect(listingReads()).toBe(4);
  });

  it("shows a removal at once: a new takedown row is a new key, and the site is gone", async () => {
    const { readGallery } = await import("@/lib/scan/gallery");
    await readGallery(VIEW);
    expect((await readGallery(VIEW)).entries.map((e) => e.domain)).toContain("harbour.example");
    expect(listingReads()).toBe(2);
    db.blocks = [{ domain: "harbour.example", blocked_at: "2026-10-22T13:00:00Z" }];
    const after = await readGallery(VIEW);
    expect(listingReads()).toBe(4);
    expect(after.entries.map((e) => e.domain)).toEqual(["quay.example"]);
    expect(after.total).toBe(1);
  });

  it("shows a lifted removal at once, though the newest takedown row is unchanged", async () => {
    const { readGallery } = await import("@/lib/scan/gallery");
    db.blocks = [
      { domain: "harbour.example", blocked_at: "2026-10-01T00:00:00Z" },
      { domain: "gone.example", blocked_at: "2026-10-02T00:00:00Z" },
    ];
    await readGallery(VIEW);
    expect((await readGallery(VIEW)).total).toBe(1);
    expect(listingReads()).toBe(2);
    db.blocks = db.blocks.filter((b) => b.domain !== "harbour.example");
    expect((await readGallery(VIEW)).total).toBe(2);
  });

  it("shows a scan finished a minute ago at once", async () => {
    const { readGallery } = await import("@/lib/scan/gallery");
    await readGallery(VIEW);
    await readGallery(VIEW);
    expect(listingReads()).toBe(2);
    db.scans = [scan("dock.example", "2026-10-22T13:59:00.000Z"), ...db.scans];
    expect((await readGallery(VIEW)).entries.map((e) => e.domain)).toContain("dock.example");
    expect(listingReads()).toBe(4);
  });

  it("never caches the one-domain check", async () => {
    const { isListed } = await import("@/lib/scan/gallery");
    expect(await isListed("harbour.example")).toBe(true);
    db.blocks = [{ domain: "harbour.example", blocked_at: "2026-10-22T13:00:00Z" }];
    expect(await isListed("harbour.example")).toBe(false);
    expect(listingReads()).toBe(2);
  });

  it("says whether the category asked for is listed, whatever the search", async () => {
    const { readGallery } = await import("@/lib/scan/gallery");
    expect((await readGallery({ ...VIEW, category: "Plumbing" })).listed).toBe(true);
    expect((await readGallery({ ...VIEW, category: "Plumbing", search: "none" })).listed).toBe(true);
    expect((await readGallery({ ...VIEW, category: "zz" })).listed).toBe(false);
    expect((await readGallery({ ...VIEW, category: "zz", search: "none" })).listed).toBe(false);
    expect((await readGallery({ ...VIEW, category: null })).listed).toBe(true);
  });

  it("rounds a requested card count down to whole pages, within the bound", async () => {
    const { galleryShown } = await import("@/lib/scan/gallery");
    expect([Number.NaN, 0, 16, 17, 31, 32, 47, 320, 9999].map(galleryShown)).toEqual([16, 16, 16, 16, 16, 32, 32, 320, 320]);
  });
});

describe("the /scans page", () => {
  const render = async (searchParams: Record<string, string>) => {
    const { default: ScansPage } = await import("@/app/(public)/scans/page");
    const { renderToStaticMarkup } = await import("react-dom/server");
    return renderToStaticMarkup(await ScansPage({ searchParams: Promise.resolve(searchParams) }));
  };
  const notFound = { digest: "NEXT_HTTP_ERROR_FALLBACK;404" };

  it("answers a category no listed scan has with not found, and a real one with its cards, searched or not", async () => {
    await expect(render({ cat: "zz" })).rejects.toMatchObject(notFound);
    await expect(render({ cat: "zz", q: "none" })).rejects.toMatchObject(notFound);
    expect(await render({ cat: "Plumbing" })).toContain("quay.example");
    expect(await render({ cat: "Plumbing", q: "none" })).not.toContain("quay.example");
  });

  it("reads the plain view once, whatever tracking parameters or card count the address carries", async () => {
    await render({});
    await render({ utm_source: "x", fbclid: "y" });
    await render({ shown: "17" });
    expect(listingReads()).toBe(2);
  });
});
