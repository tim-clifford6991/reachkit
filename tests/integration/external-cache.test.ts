/**
 * Validates the global cache layer against the local Supabase (search_cache table):
 * a second call within TTL returns the cached value WITHOUT re-running fetchFn.
 * Run: pnpm test:int tests/integration/external-cache.test.ts
 */
import { describe, it, expect } from "vitest";
import { cachedJson } from "@/lib/scan/cache/external-cache";

describe("cachedJson (LIVE local DB)", () => {
  it("fetches once, then serves from cache within TTL", async () => {
    const key = `test:cache:${Date.now()}`;
    let calls = 0;
    const fetchFn = async () => {
      calls++;
      return { value: 42, calls };
    };

    const first = await cachedJson(key, 60_000, fetchFn);
    const second = await cachedJson(key, 60_000, fetchFn);

    expect(calls).toBe(1); // fetchFn ran only on the first call
    expect(first).toEqual({ value: 42, calls: 1 });
    expect(second).toEqual({ value: 42, calls: 1 }); // cached copy of the first result
  });

  it("de-duplicates concurrent calls for the same key (computes once)", async () => {
    const key = `test:cache:dedup:${Date.now()}`;
    let calls = 0;
    const fetchFn = async () => {
      calls++;
      await new Promise((r) => setTimeout(r, 50)); // hold so both callers overlap
      return { calls };
    };

    const [a, b] = await Promise.all([cachedJson(key, 60_000, fetchFn), cachedJson(key, 60_000, fetchFn)]);

    expect(calls).toBe(1); // the two concurrent callers shared ONE compute
    expect(a).toEqual({ calls: 1 });
    expect(b).toEqual({ calls: 1 });
  });

  it("re-fetches when the cached row is older than the TTL", async () => {
    const key = `test:cache:ttl:${Date.now()}`;
    let calls = 0;
    const fetchFn = async () => {
      calls++;
      return { calls };
    };

    await cachedJson(key, 60_000, fetchFn); // populate
    const stale = await cachedJson(key, 0, fetchFn); // TTL 0 → always stale → re-fetch

    expect(calls).toBe(2);
    expect(stale).toEqual({ calls: 2 });
  });
});
