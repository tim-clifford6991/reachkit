import { beforeEach, expect, test, vi } from "vitest";

// Regression guard (code-review Finding 2, 2026-07-15): commit 0d71ba6 narrowed
// /api/scan's post-dedupe deepen call from "any dedupe hit while paid" to
// "only plan.kind === 'deepen' while paid" — silently dropping the deepen for
// `attach` (a paid viewer landing on a scan that's already IN-FLIGHT). That's
// the exact incoherent state this whole branch exists to prevent: the scan
// finishes on the FREE track (tier stays 'free', no report upgrade), and
// nothing ever re-triggers a deepen — the paid dashboard renders free-tier
// data permanently.
//
// This is a pure unit test: resolveProductScan is mocked directly (its own
// dedupe/staleness semantics are covered by lib/app/add-product.test.ts) so
// this file only has to prove route.ts's OWN branching: attach + paid → deepen.
beforeEach(() => {
  vi.resetModules();
});

function mockCommonCollaborators() {
  vi.doMock("@/lib/config/env", () => ({ env: { scanningEnabled: true } }));
  vi.doMock("@/lib/inngest/client", () => ({ inngest: { send: vi.fn(async () => ({})) } }));
  vi.doMock("@/lib/scan/abuse", () => ({
    AbuseError: class AbuseError extends Error {},
    assertRateLimit: vi.fn(async () => {}),
    hashIp: vi.fn(() => "hashed-ip"),
    ipFromRequest: vi.fn(() => "203.0.113.1"),
  }));
  vi.doMock("@/lib/auth/profile", () => ({ linkScanToUser: vi.fn(async () => true) }));
  // Never reached on the attach/deepen early-return path, but route.ts calls
  // serverDb() unconditionally near the top of the handler.
  vi.doMock("@/lib/db/client", () => ({ serverDb: () => ({ from: vi.fn() }) }));
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

test("POST /api/scan: a PAID viewer ATTACHing to an in-flight scan still triggers ensureDeepScan", async () => {
  mockCommonCollaborators();
  vi.doMock("@/lib/auth/server", () => ({
    currentUser: vi.fn(async () => ({ authId: "auth-1", user: { id: "user-paid-1" } })),
  }));
  vi.doMock("@/lib/billing/entitlements", () => ({
    entitlementsFor: vi.fn(async () => ({ tier: "growth", limits: {}, active: true })),
  }));
  vi.doMock("@/lib/app/add-product", () => ({
    resolveProductScan: vi.fn(async () => ({ kind: "attach", appId: "app-1", scanId: "scan-inflight-1" })),
  }));
  const ensureDeepScan = vi.fn(async () => true);
  vi.doMock("@/lib/scan/deepen", () => ({ ensureDeepScan }));

  const res = await postScan("https://acme.com/");
  const json = await res.json();

  expect(res.status).toBe(200);
  expect(json).toMatchObject({ scan_id: "scan-inflight-1", deduped: true });
  expect(ensureDeepScan).toHaveBeenCalledWith("scan-inflight-1");
});

test("POST /api/scan: a FREE (unpaid) viewer ATTACHing to an in-flight scan does NOT trigger ensureDeepScan", async () => {
  mockCommonCollaborators();
  vi.doMock("@/lib/auth/server", () => ({ currentUser: vi.fn(async () => null) }));
  const entitlementsFor = vi.fn(async () => ({ tier: "free", limits: {}, active: false }));
  vi.doMock("@/lib/billing/entitlements", () => ({ entitlementsFor }));
  vi.doMock("@/lib/app/add-product", () => ({
    resolveProductScan: vi.fn(async () => ({ kind: "attach", appId: "app-1", scanId: "scan-inflight-1" })),
  }));
  const ensureDeepScan = vi.fn(async () => true);
  vi.doMock("@/lib/scan/deepen", () => ({ ensureDeepScan }));

  const res = await postScan("https://acme.com/");
  expect(res.status).toBe(200);
  expect(ensureDeepScan).not.toHaveBeenCalled();
});
