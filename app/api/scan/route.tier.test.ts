import { beforeEach, expect, test, vi } from "vitest";

// ---------------------------------------------------------------------------
// INVARIANT GUARD — the public scan surface is ALWAYS a free preview.
//
// `app/api/scan/route.ts` is the PUBLIC scan endpoint (its callers are the
// marketing scan box and the shared-report auto-start — the in-app "scan my
// product" button uses the SEPARATE /api/app/scan-current). Owner decision
// 2026-07-18: an authenticated viewer — including a PAID one — must get the
// cheap free teaser here, never the deep pass, and the URL must NOT be enrolled
// as a tracked product. Deepening + tracking are a deliberate /app/add (or
// post-checkout provision) action.
//
// This guards the exact leak that shipped: a logged-in growth user pasting a
// third-party URL (cardpointers.com) into the free page got a 66¢ `tier='full'`
// deep scan silently billed AND the URL auto-added to their app_ids. The old
// version of THIS test asserted the leak ("a paid viewer gets tier='full'") —
// it now asserts the opposite. Mutation-proven: flip `tier: "free"` →
// `tier: "full"` in route.ts and test 1 fails.
//
// Pure unit test: every collaborator of route.ts is mocked (DB, inngest, abuse,
// resolveProductScan) so it runs under `npx vitest run` with no local Supabase.
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.resetModules();
  // resetModules() clears the module CACHE but NOT vi.doMock registrations, so a
  // per-test `doMock("@/lib/app/add-product", …)` would otherwise leak into the
  // real-resolution tests below. Unmock it here; the tests that need it re-mock.
  vi.doUnmock("@/lib/app/add-product");
});

/**
 * Minimal chainable `serverDb()` stand-in covering the two inserts route.ts
 * performs on the "brand-new app" path:
 *   db.from("apps").insert(...).select("id").single()
 *   db.from("scans").insert(...).select("id").single()
 * Records every row passed to `scans.insert` so the test can assert `tier`.
 */
function makeDbMock(insertedScanRows: Record<string, unknown>[]) {
  return {
    from: vi.fn((table: string) => ({
      insert: vi.fn((row: Record<string, unknown>) => {
        if (table === "apps") {
          return { select: () => ({ single: async () => ({ data: { id: "app-new-1" }, error: null }) }) };
        }
        if (table === "scans") {
          insertedScanRows.push(row);
          return { select: () => ({ single: async () => ({ data: { id: "scan-new-1" }, error: null }) }) };
        }
        throw new Error(`unexpected insert on table "${table}"`);
      }),
    })),
  };
}

/** The two enrolment/upgrade side-effects the public route must NEVER perform.
 *  Mocking the modules means a FUTURE re-introduction (import + call) trips the
 *  spy — a real forward-regression guard, not a true-by-construction pass. */
function makeSideEffectSpies() {
  const ensureDeepScan = vi.fn(async () => true);
  const linkScanToUser = vi.fn(async () => true);
  vi.doMock("@/lib/scan/deepen", () => ({ ensureDeepScan }));
  vi.doMock("@/lib/auth/profile", () => ({ linkScanToUser }));
  return { ensureDeepScan, linkScanToUser };
}

function makeInngestSpy() {
  const send = vi.fn(async () => ({}));
  vi.doMock("@/lib/inngest/client", () => ({ inngest: { send } }));
  return send;
}

function mockAbuseNewDomain() {
  vi.doMock("@/lib/config/env", () => ({ env: { scanningEnabled: true } }));
  vi.doMock("@/lib/scan/abuse", () => ({
    AbuseError: class AbuseError extends Error {},
    assertRateLimit: vi.fn(async () => {}),
    findAppByUrl: vi.fn(async () => null), // brand-new domain: no existing app → resolveProductScan returns { fresh }
    findExistingScanForApp: vi.fn(async () => null),
    hashIp: vi.fn(() => "hashed-ip"),
    ipFromRequest: vi.fn(() => "203.0.113.1"),
  }));
}

/** Force a paid viewer to be "present" — proves the route ignores it. If the
 *  route ever re-reads entitlements to branch on tier, these spies catch it. */
function mockPaidViewerPresent() {
  const currentUser = vi.fn(async () => ({ authId: "auth-1", user: { id: "user-paid-1" } }));
  const entitlementsFor = vi.fn(async () => ({ tier: "growth", limits: {}, active: true }));
  vi.doMock("@/lib/auth/server", () => ({ currentUser }));
  vi.doMock("@/lib/billing/entitlements", () => ({ entitlementsFor }));
  return { currentUser, entitlementsFor };
}

function postScan(storeUrl: string) {
  return import("@/app/api/scan/route").then(({ POST }) =>
    POST(
      new Request("http://localhost/api/scan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ store_url: storeUrl }),
      }) as never,
    ),
  );
}

test("public /api/scan: a PAID viewer scanning a NEW domain gets tier='free' — never a deep scan (the cardpointers leak)", async () => {
  mockAbuseNewDomain();
  const send = makeInngestSpy();
  const { ensureDeepScan, linkScanToUser } = makeSideEffectSpies();
  mockPaidViewerPresent();

  const insertedScanRows: Record<string, unknown>[] = [];
  vi.doMock("@/lib/db/client", () => ({ serverDb: () => makeDbMock(insertedScanRows) }));

  const res = await postScan("https://brand-new-paid-domain.test/");
  const json = await res.json();

  expect(res.status).toBe(200);
  expect(json.scan_id).toBe("scan-new-1");
  expect(insertedScanRows).toHaveLength(1);
  // THE INVARIANT: free tier for a paid viewer on the public surface.
  expect(insertedScanRows[0]).toMatchObject({ app_id: "app-new-1", tier: "free" });
  // The pipeline is told the tier so the collect cap is the free ceiling.
  expect(send).toHaveBeenCalledWith({ name: "scan/requested", data: { scanId: "scan-new-1", tier: "free" } });
  // No deep pass, no enrolment — those belong to /app/add + checkout only.
  expect(ensureDeepScan).not.toHaveBeenCalled();
  expect(linkScanToUser).not.toHaveBeenCalled();
});

test("public /api/scan: an ATTACH dedupe hit for a PAID viewer hands back the existing scan — no deepen, no enrol", async () => {
  vi.doMock("@/lib/config/env", () => ({ env: { scanningEnabled: true } }));
  vi.doMock("@/lib/scan/abuse", () => ({
    AbuseError: class AbuseError extends Error {},
    assertRateLimit: vi.fn(async () => {}),
    hashIp: vi.fn(() => "hashed-ip"),
    ipFromRequest: vi.fn(() => "203.0.113.1"),
  }));
  vi.doMock("@/lib/db/client", () => ({ serverDb: () => ({ from: vi.fn() }) }));
  const send = makeInngestSpy();
  const { ensureDeepScan, linkScanToUser } = makeSideEffectSpies();
  mockPaidViewerPresent();
  // An in-flight scan already exists for this URL → dedupe to it.
  vi.doMock("@/lib/app/add-product", () => ({
    resolveProductScan: vi.fn(async () => ({ kind: "attach", appId: "app-1", scanId: "scan-inflight-1" })),
  }));

  const res = await postScan("https://acme.com/");
  const json = await res.json();

  expect(res.status).toBe(200);
  expect(json).toMatchObject({ scan_id: "scan-inflight-1", deduped: true });
  // Pure dedupe: the public surface never deepens or links an existing scan.
  expect(ensureDeepScan).not.toHaveBeenCalled();
  expect(linkScanToUser).not.toHaveBeenCalled();
  expect(send).not.toHaveBeenCalled(); // dedupe short-circuits before any new event
});

test("public /api/scan: resolveProductScan is called with paid:false so it can never resolve to a deepen", async () => {
  vi.doMock("@/lib/config/env", () => ({ env: { scanningEnabled: true } }));
  vi.doMock("@/lib/scan/abuse", () => ({
    AbuseError: class AbuseError extends Error {},
    assertRateLimit: vi.fn(async () => {}),
    hashIp: vi.fn(() => "hashed-ip"),
    ipFromRequest: vi.fn(() => "203.0.113.1"),
  }));
  vi.doMock("@/lib/db/client", () => ({ serverDb: () => ({ from: vi.fn() }) }));
  makeInngestSpy();
  makeSideEffectSpies();
  mockPaidViewerPresent();
  const resolveProductScan = vi.fn(async () => ({ kind: "attach", appId: "app-1", scanId: "scan-inflight-1" }));
  vi.doMock("@/lib/app/add-product", () => ({ resolveProductScan }));

  await postScan("https://acme.com/");

  expect(resolveProductScan).toHaveBeenCalledWith("https://acme.com/", { paid: false });
});

test("public /api/scan: an anonymous viewer scanning a new domain gets tier='free'", async () => {
  mockAbuseNewDomain();
  makeInngestSpy();
  makeSideEffectSpies();
  vi.doMock("@/lib/auth/server", () => ({ currentUser: vi.fn(async () => null) }));
  vi.doMock("@/lib/billing/entitlements", () => ({
    entitlementsFor: vi.fn(async () => ({ tier: "free", limits: {}, active: false })),
  }));

  const insertedScanRows: Record<string, unknown>[] = [];
  vi.doMock("@/lib/db/client", () => ({ serverDb: () => makeDbMock(insertedScanRows) }));

  const res = await postScan("https://brand-new-anon-domain.test/");
  expect(res.status).toBe(200);
  await res.json();

  expect(insertedScanRows[0]).toMatchObject({ tier: "free" });
});
