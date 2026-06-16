import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DistributionProfile } from "./types";

const NOW = Date.UTC(2026, 5, 16);
const profile = (domain: string, crawledAt: string): DistributionProfile => ({
  domain,
  channels: [],
  seo: null,
  crawledAt,
});

// serverDb mock: .from("distribution_profiles").select().eq().maybeSingle() and .upsert()
function makeDb(row: { profile: unknown; crawled_at: string } | null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: row, error: null });
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  const upsert = vi.fn().mockResolvedValue({ error: null });
  const from = vi.fn().mockReturnValue({ select, upsert });
  return { serverDb: vi.fn().mockReturnValue({ from }), spies: { upsert, eq } };
}

beforeEach(() => vi.resetModules());

describe("getCachedProfile", () => {
  it("returns a fresh cached profile", async () => {
    const fresh = profile("acme.com", new Date(NOW - 60_000).toISOString());
    const db = makeDb({ profile: fresh, crawled_at: fresh.crawledAt });
    vi.doMock("@/lib/db/client", () => ({ serverDb: db.serverDb }));
    const { getCachedProfile } = await import("./cache");
    expect(await getCachedProfile("acme.com", 7 * 86_400_000, NOW)).toEqual(fresh);
    expect(db.spies.eq).toHaveBeenCalledWith("domain", "acme.com");
  });

  it("returns null when the cached profile is stale", async () => {
    const stale = profile("acme.com", new Date(NOW - 30 * 86_400_000).toISOString());
    const db = makeDb({ profile: stale, crawled_at: stale.crawledAt });
    vi.doMock("@/lib/db/client", () => ({ serverDb: db.serverDb }));
    const { getCachedProfile } = await import("./cache");
    expect(await getCachedProfile("acme.com", 7 * 86_400_000, NOW)).toBeNull();
  });

  it("returns null when nothing is cached", async () => {
    const db = makeDb(null);
    vi.doMock("@/lib/db/client", () => ({ serverDb: db.serverDb }));
    const { getCachedProfile } = await import("./cache");
    expect(await getCachedProfile("acme.com", 7 * 86_400_000, NOW)).toBeNull();
  });
});

describe("profileDomainCached", () => {
  it("serves the cache on a fresh hit without computing", async () => {
    const fresh = profile("acme.com", new Date(NOW - 60_000).toISOString());
    const db = makeDb({ profile: fresh, crawled_at: fresh.crawledAt });
    const compute = vi.fn();
    vi.doMock("@/lib/db/client", () => ({ serverDb: db.serverDb }));
    vi.doMock("./profile-domain", () => ({ profileDomain: compute }));
    const { profileDomainCached } = await import("./cache");
    const out = await profileDomainCached("acme.com", { nowMs: NOW });
    expect(out).toEqual(fresh);
    expect(compute).not.toHaveBeenCalled();
    expect(db.spies.upsert).not.toHaveBeenCalled();
  });

  it("computes + upserts on a miss", async () => {
    const computed = profile("acme.com", new Date(NOW).toISOString());
    const db = makeDb(null);
    const compute = vi.fn().mockResolvedValue(computed);
    vi.doMock("@/lib/db/client", () => ({ serverDb: db.serverDb }));
    vi.doMock("./profile-domain", () => ({ profileDomain: compute }));
    const { profileDomainCached } = await import("./cache");
    const out = await profileDomainCached("acme.com", { nowMs: NOW });
    expect(out).toEqual(computed);
    expect(compute).toHaveBeenCalledOnce();
    expect(db.spies.upsert).toHaveBeenCalledOnce();
  });
});
