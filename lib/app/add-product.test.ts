// lib/app/add-product.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ensureDeepScan } from "@/lib/scan/deepen";

const findAppByUrl = vi.fn();
const findExistingScanForApp = vi.fn();
vi.mock("@/lib/scan/abuse", () => ({ findAppByUrl: (...a: unknown[]) => findAppByUrl(...a), findExistingScanForApp: (...a: unknown[]) => findExistingScanForApp(...a) }));

const scanRow = vi.fn();
// serverDb mock covering BOTH the users lookup and the scans lookup.
let userRow: { tier: string; app_ids: string[] } | null = null;
// addTrackedProduct reads the "users" row TWICE: once at the top (the initial
// cap check) and once again as the re-read/re-assert immediately before the
// link write (the check-then-act race guard). By default both reads return
// the same `userRow` — set `userRereadOverride` to make the SECOND read (and
// only the second) diverge, simulating a concurrent add that landed between
// the two reads (Finding 3, code review 2026-07-15).
let userReadCount = 0;
let userRereadOverride: { tier: string; app_ids: string[] } | null | undefined;
const setUser = (u: { tier: string; app_ids: string[] }) => {
  userRow = u;
  userReadCount = 0;
  userRereadOverride = undefined;
};
const inserted: Record<string, unknown[]> = { apps: [], scans: [] };
// Tracks every `.update(patch)` call per table (e.g. the users.app_ids link
// write, and — the defect this file's newest test proves — the scans row
// getting stamped terminal when inngest.send fails after insert).
const updated: Record<string, unknown[]> = { apps: [], scans: [], users: [] };
vi.mock("@/lib/db/client", () => ({
  serverDb: () => ({
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => {
            if (table !== "users") return scanRow();
            userReadCount++;
            if (userReadCount >= 2 && userRereadOverride !== undefined) return { data: userRereadOverride };
            return { data: userRow };
          },
        }),
      }),
      insert: (row: Record<string, unknown>) => {
        inserted[table]?.push(row);
        return { select: () => ({ single: async () => ({ data: { id: `${table}-new` }, error: null }) }) };
      },
      update: (patch: Record<string, unknown>) => {
        updated[table]?.push(patch);
        return { eq: async () => ({ error: null }) };
      },
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

describe("capMessage (the at-cap copy may only name exits that EXIST)", () => {
  it("offers upgrade + remove below the top tier", async () => {
    const { capMessage } = await import("./add-product");
    const msg = capMessage({ tier: "solo", count: 1, cap: 1 });
    expect(msg).toMatch(/upgrade/i);
    expect(msg).toMatch(/remove one in settings/i);
  });

  it("NEVER offers an upgrade on growth — it is the top tier (the 735dbae dead-exit class)", async () => {
    const { capMessage } = await import("./add-product");
    const msg = capMessage({ tier: "growth", count: 3, cap: 3 });
    expect(msg).not.toMatch(/upgrade/i);
    expect(msg).toMatch(/remove one in settings/i);
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
    // Assert the TYPE as well as the code: toMatchObject alone would accept any
    // bare object carrying code:"cap", not the AddProductError callers catch on.
    await expect(addTrackedProduct("u1", "https://new.com/")).rejects.toThrow(AddProductError);
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

  // Finding 3 (code review 2026-07-15): the cap re-read/re-assert (the
  // check-then-act race guard immediately before the link write) must trip
  // BEFORE any cost-bearing call (startScan/ensureDeepScan) — never after.
  // Simulates a concurrent add landing between the initial cap check and the
  // re-read: the re-read now reports the account already at cap. Invariant
  // #2 (CLAUDE.md) requires every cost-bearing call attribute back to a user
  // via users.app_ids — a refusal here must spend NOTHING, so the refusal
  // path must insert NO scans row.
  it("re-read trips the cap → refuses WITHOUT inserting a scans row (no orphaned spend)", async () => {
    const { addTrackedProduct, AddProductError } = await import("./add-product");
    setUser({ tier: "growth", app_ids: ["a", "b"] }); // growth cap = 3; 2 < 3 passes the INITIAL check
    findAppByUrl.mockResolvedValue(null); // fresh app — app-row creation isn't cost-bearing
    inserted.scans = [];
    inserted.apps = [];
    // The re-read (2nd "users" select) reports a 3rd app landed concurrently.
    userRereadOverride = { tier: "growth", app_ids: ["a", "b", "c"] };
    // A single call only (not the double-call pattern used above) — the mock's
    // userReadCount is call-order-sensitive, and a 2nd invocation would consume
    // the override on ITS OWN top-level read too, no longer isolating the
    // re-read path this test exists to prove.
    let caught: unknown;
    try {
      await addTrackedProduct("u1", "https://new.com/");
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(AddProductError);
    expect(caught).toMatchObject({ code: "cap" });
    expect(inserted.scans).toHaveLength(0);
  });

  // Finding 2 (code review 2026-07-15): a paid viewer ATTACHing to a scan
  // that's already IN-FLIGHT for this app must still get it deepened —
  // otherwise the scan finishes on the free track and the paid dashboard
  // renders free-tier data permanently, with nothing left to re-trigger an
  // upgrade. `ensureDeepScan` is documented idempotent (lib/scan/deepen.ts),
  // so calling it here is always safe.
  it("a PAID viewer ATTACHing to an in-flight scan triggers ensureDeepScan", async () => {
    const { addTrackedProduct } = await import("./add-product");
    setUser({ tier: "growth", app_ids: [] }); // growth cap = 3, tier !== "free" → active: true
    findAppByUrl.mockResolvedValue("app1");
    findExistingScanForApp.mockResolvedValue("scan1");
    scanRow.mockReturnValue({ data: { status: "collecting", created_at: new Date().toISOString() } }); // in-flight ⇒ attach
    await expect(addTrackedProduct("u1", "https://x.com/")).resolves.toEqual({ appId: "app1", scanId: "scan1" });
    expect(ensureDeepScan).toHaveBeenCalledWith("scan1");
  });

  it("a FREE viewer ATTACHing to an in-flight scan does NOT trigger ensureDeepScan", async () => {
    const { addTrackedProduct } = await import("./add-product");
    setUser({ tier: "free", app_ids: [] }); // free ⇒ active: false
    findAppByUrl.mockResolvedValue("app1");
    findExistingScanForApp.mockResolvedValue("scan1");
    scanRow.mockReturnValue({ data: { status: "collecting", created_at: new Date().toISOString() } });
    await expect(addTrackedProduct("u1", "https://x.com/")).resolves.toEqual({ appId: "app1", scanId: "scan1" });
    expect(ensureDeepScan).not.toHaveBeenCalled();
  });

  // THE DEFECT this test proves: `startScan`'s scan-row INSERT failure is
  // guarded (returns null; app still links), but the very next line —
  // `inngest.send` — was UNGUARDED. A rejected send (exactly what CI sees:
  // ECONNREFUSED, no Inngest dev server) propagated out of `addTrackedProduct`
  // and the caller reported "Couldn't add your product" for a product that
  // WAS successfully created + linked (spec §6: "Scan trigger fails → App is
  // still created + linked... Never strand a paid slot on a transient Inngest
  // blip"). The naive fix (swallow + return the scanId) is ALSO wrong: the
  // `scans` row would sit at status:"queued" forever with nothing to process
  // it, and the dashboard's in-flight query (`not in (done,failed,degraded)`)
  // would render it as a permanent fake "Scanning…" spinner. So this test
  // asserts the full honest contract: app linked, scanId null, AND the
  // orphaned row stamped terminal (not left "queued").
  it("inngest.send FAILS on a fresh add → app still linked, scanId null, orphan scan row marked terminal (not a fake spinner)", async () => {
    const { addTrackedProduct } = await import("./add-product");
    const { inngest } = await import("@/lib/inngest/client");
    setUser({ tier: "growth", app_ids: [] }); // growth cap = 3, tier !== "free" → active: true
    findAppByUrl.mockResolvedValue(null); // fresh — new app + new scan row
    inserted.scans = [];
    inserted.apps = [];
    updated.users = [];
    updated.scans = [];
    vi.mocked(inngest.send).mockRejectedValueOnce(new Error("connect ECONNREFUSED 127.0.0.1:8288"));

    const result = await addTrackedProduct("u1", "https://boom.com/");

    expect(result.scanId).toBeNull();
    expect(result.appId).toBeTruthy();
    // The app row WAS created and the link write WAS made — never strand a slot.
    expect(inserted.apps).toHaveLength(1);
    expect(updated.users).toHaveLength(1);
    // The scans row WAS inserted (status:"queued" at creation)...
    expect(inserted.scans).toHaveLength(1);
    expect(inserted.scans[0]).toMatchObject({ status: "queued" });
    // ...but because nothing will ever process it, it must be stamped
    // terminal so the dashboard's in-flight query excludes it and falls
    // through to the normal retry affordance instead of a fake spinner.
    expect(updated.scans).toHaveLength(1);
    expect(updated.scans[0]).toMatchObject({ status: "failed" });
  });
});
