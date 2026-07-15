// lib/app/add-product.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const findAppByUrl = vi.fn();
const findExistingScanForApp = vi.fn();
vi.mock("@/lib/scan/abuse", () => ({ findAppByUrl: (...a: unknown[]) => findAppByUrl(...a), findExistingScanForApp: (...a: unknown[]) => findExistingScanForApp(...a) }));

const scanRow = vi.fn();
// serverDb mock covering BOTH the users lookup and the scans lookup.
let userRow: { tier: string; app_ids: string[] } | null = null;
const setUser = (u: { tier: string; app_ids: string[] }) => { userRow = u; };
const inserted: Record<string, unknown[]> = { apps: [], scans: [] };
vi.mock("@/lib/db/client", () => ({
  serverDb: () => ({
    from: (table: string) => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => (table === "users" ? { data: userRow } : scanRow()) }),
      }),
      insert: (row: Record<string, unknown>) => {
        inserted[table]?.push(row);
        return { select: () => ({ single: async () => ({ data: { id: `${table}-new` }, error: null }) }) };
      },
      update: () => ({ eq: async () => ({ error: null }) }),
    }),
  }),
}));
vi.mock("@/lib/billing/entitlements", () => ({ entitlementsFor: async () => ({ active: userRow?.tier !== "free" }) }));
vi.mock("@/lib/inngest/client", () => ({ inngest: { send: vi.fn(async () => ({})) } }));
vi.mock("@/lib/scan/deepen", () => ({ ensureDeepScan: vi.fn(async () => true) }));
// The unit runner has no full env (no SUPABASE_* etc.), same as app/api/scan/route.test.ts —
// stub it statically so env.scanningEnabled never triggers the real parseEnv/zod validation.
// vi.mock factories are hoisted above every other declaration in this file, so the
// mutable flag the paused test flips is created via vi.hoisted (not a plain `const`
// the factory just happens to close over) and read through a GETTER on every access —
// a plain property snapshot captured once at mock-creation time would freeze at
// `true` forever, and the "kill switch holds" test below would pass for the wrong
// reason no matter what env.scanningEnabled is actually set to.
const { envState } = vi.hoisted(() => ({ envState: { scanningEnabled: true } }));
vi.mock("@/lib/config/env", () => ({
  env: {
    get scanningEnabled() { return envState.scanningEnabled; },
  },
}));

const NOW = new Date("2026-07-15T12:00:00Z");
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();

describe("resolveProductScan (invariant: ONE dedupe/staleness policy)", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("no app for the URL → fresh", async () => {
    findAppByUrl.mockResolvedValue(null);
    const { resolveProductScan } = await import("./add-product");
    expect(await resolveProductScan("https://x.com/", { paid: true, now: NOW })).toEqual({ kind: "fresh" });
  });

  it("done scan 4 days old → deepen (reuse; nudgi.ai's real case)", async () => {
    findAppByUrl.mockResolvedValue("app1");
    findExistingScanForApp.mockResolvedValue("scan1");
    scanRow.mockReturnValue({ data: { status: "done", created_at: daysAgo(4) } });
    const { resolveProductScan } = await import("./add-product");
    expect(await resolveProductScan("https://x.com/", { paid: true, now: NOW })).toEqual({ kind: "deepen", appId: "app1", scanId: "scan1" });
  });

  it("done scan 15 days old → rescan (never present stale data as current)", async () => {
    findAppByUrl.mockResolvedValue("app1");
    findExistingScanForApp.mockResolvedValue("scan1");
    scanRow.mockReturnValue({ data: { status: "done", created_at: daysAgo(15) } });
    const { resolveProductScan } = await import("./add-product");
    expect(await resolveProductScan("https://x.com/", { paid: true, now: NOW })).toEqual({ kind: "rescan", appId: "app1" });
  });

  it("exactly 14 days → deepen (boundary is inclusive)", async () => {
    findAppByUrl.mockResolvedValue("app1");
    findExistingScanForApp.mockResolvedValue("scan1");
    scanRow.mockReturnValue({ data: { status: "done", created_at: daysAgo(14) } });
    const { resolveProductScan } = await import("./add-product");
    expect((await resolveProductScan("https://x.com/", { paid: true, now: NOW })).kind).toBe("deepen");
  });

  it("app exists but no reusable scan (failed/stuck) → rescan", async () => {
    findAppByUrl.mockResolvedValue("app1");
    findExistingScanForApp.mockResolvedValue(null);
    const { resolveProductScan } = await import("./add-product");
    expect(await resolveProductScan("https://x.com/", { paid: true, now: NOW })).toEqual({ kind: "rescan", appId: "app1" });
  });

  it("a scan is already RUNNING → attach, never trigger a duplicate paid run", async () => {
    findAppByUrl.mockResolvedValue("app1");
    findExistingScanForApp.mockResolvedValue("scan1");
    scanRow.mockReturnValue({ data: { status: "collecting", created_at: daysAgo(0) } });
    const { resolveProductScan } = await import("./add-product");
    expect(await resolveProductScan("https://x.com/", { paid: true, now: NOW })).toEqual({ kind: "attach", appId: "app1", scanId: "scan1" });
  });

  it("free viewer NEVER rescans a stale scan (cost guard: free dedupe is unchanged)", async () => {
    findAppByUrl.mockResolvedValue("app1");
    findExistingScanForApp.mockResolvedValue("scan1");
    scanRow.mockReturnValue({ data: { status: "done", created_at: daysAgo(90) } });
    const { resolveProductScan } = await import("./add-product");
    expect(await resolveProductScan("https://x.com/", { paid: false, now: NOW })).toEqual({ kind: "attach", appId: "app1", scanId: "scan1" });
  });
});

import { classifyUrl } from "@/lib/scan/router";

describe("URL canonicalisation contract (classify BEFORE resolve)", () => {
  it("every variant of one domain canonicalises to ONE app key", () => {
    const variants = ["nudgi.ai", "https://nudgi.ai", "https://nudgi.ai/", "https://www.nudgi.ai/", "HTTPS://WWW.Nudgi.AI/pricing?utm=x"];
    const canon = variants.map((v) => classifyUrl(v).url);
    expect(new Set(canon).size).toBe(1);
    expect(canon[0]).toBe("https://nudgi.ai/");
  });

  it("resolveProductScan is called with the CANONICAL url, so lookups can't miss", async () => {
    findAppByUrl.mockResolvedValue(null);
    const { resolveProductScan } = await import("./add-product");
    await resolveProductScan(classifyUrl("WWW.Nudgi.AI/x?q=1").url, { paid: true, now: NOW });
    expect(findAppByUrl).toHaveBeenCalledWith("https://nudgi.ai/");
  });
});

describe("addTrackedProduct (cap · already-tracked · paused)", () => {
  // Call history on the shared vi.fn() mocks (findAppByUrl etc.) otherwise carries
  // over from the earlier describe blocks above — clearAllMocks only resets call
  // records, not the mockResolvedValue implementations each test sets explicitly.
  beforeEach(() => { vi.clearAllMocks(); });
  // Unconditional restore (not just an inline reset at the end of the paused test
  // below) — if the paused test's own assertion ever failed, an inline-only reset
  // would never run and every test after it would silently inherit a paused env.
  afterEach(() => { envState.scanningEnabled = true; });

  it("refuses at the tier cap WITHOUT creating anything (no silent untracked scan)", async () => {
    const { addTrackedProduct, AddProductError } = await import("./add-product");
    setUser({ tier: "growth", app_ids: ["a", "b", "c"] }); // growth cap = 3
    await expect(addTrackedProduct("u1", "https://new.com/")).rejects.toMatchObject({ code: "cap" });
    expect(findAppByUrl).not.toHaveBeenCalled();
  });

  it("refuses a URL the user already tracks (no slot burned, no spend)", async () => {
    const { addTrackedProduct } = await import("./add-product");
    setUser({ tier: "growth", app_ids: ["app1"] });
    findAppByUrl.mockResolvedValue("app1");
    await expect(addTrackedProduct("u1", "https://x.com/")).rejects.toMatchObject({ code: "already_tracked" });
  });

  it("refuses when SCANNING_ENABLED=false (P4 kill switch holds here too)", async () => {
    envState.scanningEnabled = false;
    const { addTrackedProduct } = await import("./add-product");
    setUser({ tier: "growth", app_ids: [] });
    await expect(addTrackedProduct("u1", "https://x.com/")).rejects.toMatchObject({ code: "paused" });
    // restore is unconditional via afterEach above, not inline here — see comment on it.
  });

  it("a FREE zero-app user CAN add their first product (no assertPaid regression)", async () => {
    const { addTrackedProduct } = await import("./add-product");
    setUser({ tier: "free", app_ids: [] }); // free cap = 1
    findAppByUrl.mockResolvedValue(null);
    inserted.scans = []; // Clear before the test
    await expect(addTrackedProduct("u1", "https://x.com/")).resolves.toMatchObject({ appId: expect.any(String) });
    // Invariant: free user's scan must be tier=free, never tier=full
    expect(inserted.scans).toHaveLength(1);
    expect(inserted.scans[0]).toMatchObject({ tier: "free" });
  });

  it("a PAID user gets scan tier=full on product add", async () => {
    const { addTrackedProduct } = await import("./add-product");
    setUser({ tier: "growth", app_ids: [] }); // growth cap = 3, tier !== "free" → active: true
    findAppByUrl.mockResolvedValue(null);
    inserted.scans = []; // Clear before the test
    await expect(addTrackedProduct("u1", "https://x.com/")).resolves.toMatchObject({ appId: expect.any(String) });
    // Invariant: paid user's scan must be tier=full, never tier=free
    expect(inserted.scans).toHaveLength(1);
    expect(inserted.scans[0]).toMatchObject({ tier: "full" });
  });
});
