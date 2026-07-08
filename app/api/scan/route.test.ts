import { beforeEach, expect, test, vi } from "vitest";

// ---------------------------------------------------------------------------
// C2 (launch-readiness Workstream C) — the direct paid-fresh-scan branch.
//
// An already-paid viewer scanning a brand-new domain (no existing `apps` row)
// must get `tier: 'full'` on the created `scans` row — a DIFFERENT branch
// than the free→deepen path (see lib/inngest/functions/scan-requested.ts,
// which runs the heavy `full-scan` step inline for tier='full' rather than
// waiting for a separate `scan/deepen` event).
//
// This is a pure unit test: every collaborator of app/api/scan/route.ts is
// mocked (DB, auth, entitlements, inngest, abuse controls) so it runs under
// the default `npx vitest run` with no live/local Supabase required — same
// pattern as app/api/billing/webhook/route.test.ts.
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.resetModules();
});

/**
 * Minimal chainable `serverDb()` stand-in covering exactly the two inserts
 * app/api/scan/route.ts performs on the "brand-new app" path:
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

function mockCommonCollaborators() {
  vi.doMock("@/lib/inngest/client", () => ({ inngest: { send: vi.fn(async () => ({})) } }));
  vi.doMock("@/lib/scan/abuse", () => ({
    AbuseError: class AbuseError extends Error {},
    assertRateLimit: vi.fn(async () => {}),
    findAppByUrl: vi.fn(async () => null), // brand-new domain: no existing app
    findExistingScanForApp: vi.fn(async () => null),
    hashIp: vi.fn(() => "hashed-ip"),
    ipFromRequest: vi.fn(() => "203.0.113.1"),
  }));
  vi.doMock("@/lib/auth/profile", () => ({ linkScanToUser: vi.fn(async () => true) }));
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

test("POST /api/scan: an already-paid viewer scanning a NEW domain gets tier='full' at creation", async () => {
  mockCommonCollaborators();
  vi.doMock("@/lib/auth/server", () => ({
    currentUser: vi.fn(async () => ({ authId: "auth-1", user: { id: "user-paid-1" } })),
  }));
  vi.doMock("@/lib/billing/entitlements", () => ({
    entitlementsFor: vi.fn(async () => ({ tier: "growth", limits: {}, active: true })),
  }));

  const insertedScanRows: Record<string, unknown>[] = [];
  vi.doMock("@/lib/db/client", () => ({ serverDb: () => makeDbMock(insertedScanRows) }));

  const res = await postScan("https://brand-new-paid-domain.test/");
  const json = await res.json();

  expect(res.status).toBe(200);
  expect(json.scan_id).toBe("scan-new-1");
  expect(insertedScanRows).toHaveLength(1);
  expect(insertedScanRows[0]).toMatchObject({ app_id: "app-new-1", tier: "full" });
});

test("POST /api/scan: an authenticated but NOT-paid viewer scanning a new domain still gets tier='free'", async () => {
  mockCommonCollaborators();
  vi.doMock("@/lib/auth/server", () => ({
    currentUser: vi.fn(async () => ({ authId: "auth-2", user: { id: "user-free-1" } })),
  }));
  vi.doMock("@/lib/billing/entitlements", () => ({
    entitlementsFor: vi.fn(async () => ({ tier: "free", limits: {}, active: false })),
  }));

  const insertedScanRows: Record<string, unknown>[] = [];
  vi.doMock("@/lib/db/client", () => ({ serverDb: () => makeDbMock(insertedScanRows) }));

  const res = await postScan("https://brand-new-free-domain.test/");
  const json = await res.json();

  expect(res.status).toBe(200);
  expect(json.scan_id).toBe("scan-new-1");
  expect(insertedScanRows[0]).toMatchObject({ tier: "free" });
});

test("POST /api/scan: an anonymous viewer scanning a new domain gets tier='free' (no auth lookup needed)", async () => {
  mockCommonCollaborators();
  vi.doMock("@/lib/auth/server", () => ({ currentUser: vi.fn(async () => null) }));
  const entitlementsFor = vi.fn(async () => ({ tier: "free", limits: {}, active: false }));
  vi.doMock("@/lib/billing/entitlements", () => ({ entitlementsFor }));

  const insertedScanRows: Record<string, unknown>[] = [];
  vi.doMock("@/lib/db/client", () => ({ serverDb: () => makeDbMock(insertedScanRows) }));

  const res = await postScan("https://brand-new-anon-domain.test/");
  const json = await res.json();

  expect(res.status).toBe(200);
  expect(insertedScanRows[0]).toMatchObject({ tier: "free" });
  // No viewer → entitlementsFor is never consulted (route.ts short-circuits viewerIsPaid=false).
  expect(entitlementsFor).not.toHaveBeenCalled();
});
