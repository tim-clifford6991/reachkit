import { describe, it, expect, vi, beforeEach } from "vitest";
import { searchCacheKey } from "./search-cache";

describe("searchCacheKey", () => {
  it("is deterministic and part-sensitive", () => {
    expect(searchCacheKey("demand", "a", "year")).toBe(searchCacheKey("demand", "a", "year"));
    expect(searchCacheKey("demand", "a")).not.toBe(searchCacheKey("demand", "b"));
  });
});

const NOW = Date.UTC(2026, 5, 16);
function makeDb(row: { response: unknown; created_at: string } | null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: row, error: null });
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  const upsert = vi.fn().mockResolvedValue({ error: null });
  const from = vi.fn().mockReturnValue({ select, upsert });
  return { serverDb: vi.fn().mockReturnValue({ from }), spies: { upsert } };
}

beforeEach(() => vi.resetModules());

describe("getCachedSearch", () => {
  it("returns a fresh cached response; null when stale or missing", async () => {
    const db = makeDb({ response: ["x.com"], created_at: new Date(NOW - 60_000).toISOString() });
    vi.doMock("@/lib/db/client", () => ({ serverDb: db.serverDb }));
    const { getCachedSearch } = await import("./search-cache");
    expect(await getCachedSearch("k", 7 * 86_400_000, NOW)).toEqual(["x.com"]);
  });

  it("returns null when the entry is older than maxAge", async () => {
    const db = makeDb({ response: ["x"], created_at: new Date(NOW - 30 * 86_400_000).toISOString() });
    vi.doMock("@/lib/db/client", () => ({ serverDb: db.serverDb }));
    const { getCachedSearch } = await import("./search-cache");
    expect(await getCachedSearch("k", 7 * 86_400_000, NOW)).toBeNull();
  });
});

describe("cachedSearch", () => {
  it("computes + stores on miss, serves cache on hit", async () => {
    const miss = makeDb(null);
    vi.doMock("@/lib/db/client", () => ({ serverDb: miss.serverDb }));
    const { cachedSearch } = await import("./search-cache");
    const compute = vi.fn().mockResolvedValue(["a.com"]);
    expect(await cachedSearch("k", compute)).toEqual(["a.com"]);
    expect(compute).toHaveBeenCalledOnce();
    expect(miss.spies.upsert).toHaveBeenCalledOnce();
  });

  it("does not compute on a fresh hit", async () => {
    const hit = makeDb({ response: ["cached.com"], created_at: new Date(Date.now()).toISOString() });
    vi.doMock("@/lib/db/client", () => ({ serverDb: hit.serverDb }));
    const { cachedSearch } = await import("./search-cache");
    const compute = vi.fn();
    expect(await cachedSearch("k", compute)).toEqual(["cached.com"]);
    expect(compute).not.toHaveBeenCalled();
  });
});
