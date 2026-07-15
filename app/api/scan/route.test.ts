import { afterEach, expect, test, vi } from "vitest";

// Pure unit test (no local Supabase): the rate-limited path returns before
// `serverDb()` is ever dereferenced in route.ts, so it's enough to mock the
// abuse module's `assertRateLimit` (keeping the REAL `hashIp`/`ipFromRequest`/
// `AbuseError` via importActual) plus the two other side-effecting imports the
// module touches unconditionally (`inngest`, `currentUser`) — same pattern as
// tests/integration/scan-route.test.ts, minus the real-DB happy path.
vi.mock("@/lib/inngest/client", () => ({ inngest: { send: vi.fn(async () => ({})) } }));
vi.mock("@/lib/auth/server", () => ({ currentUser: vi.fn(async () => null) }));
// The route reads env.scanningEnabled (P4 kill switch) at the top; the unit
// runner has no full env, so stub it ON (scanning enabled).
vi.mock("@/lib/config/env", () => ({ env: { scanningEnabled: true } }));

const assertRateLimitMock = vi.fn();
vi.mock("@/lib/scan/abuse", async () => {
  const actual = await vi.importActual<typeof import("@/lib/scan/abuse")>("@/lib/scan/abuse");
  return { ...actual, assertRateLimit: (...args: [string]) => assertRateLimitMock(...args) };
});

afterEach(() => {
  vi.clearAllMocks();
});

function postReq(headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/scan", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify({ store_url: "https://example.com" }),
  }) as never;
}

test("POST /api/scan returns 429 (not 500) when the per-IP rate limit is exceeded", async () => {
  const { AbuseError } = await import("@/lib/scan/abuse");
  assertRateLimitMock.mockRejectedValueOnce(
    new AbuseError("rate_limit", "scan rate limit reached for this IP"),
  );
  const { inngest } = await import("@/lib/inngest/client");

  const { POST } = await import("@/app/api/scan/route");
  const res = await POST(postReq({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" }));

  expect(res.status).toBe(429);
  const json = await res.json();
  expect(json.error).toMatch(/rate limit/i);

  // The request never reaches the pipeline: no scan created, no event sent.
  expect(inngest.send).not.toHaveBeenCalled();
});

test("POST /api/scan hashes the client IP (ipHash) and passes it to assertRateLimit", async () => {
  const { AbuseError, hashIp } = await import("@/lib/scan/abuse");
  assertRateLimitMock.mockRejectedValueOnce(
    new AbuseError("rate_limit", "scan rate limit reached for this IP"),
  );

  const { POST } = await import("@/app/api/scan/route");
  // x-forwarded-for may be a chain; the client is the FIRST entry.
  await POST(postReq({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" }));

  expect(assertRateLimitMock).toHaveBeenCalledTimes(1);
  expect(assertRateLimitMock).toHaveBeenCalledWith(hashIp("203.0.113.9"));
  // Never the raw IP — only its hash reaches the rate-limit check.
  expect(assertRateLimitMock).not.toHaveBeenCalledWith("203.0.113.9");
});

test("POST /api/scan does not swallow a non-abuse error from assertRateLimit as a 429", async () => {
  assertRateLimitMock.mockRejectedValueOnce(new Error("db down"));

  const { POST } = await import("@/app/api/scan/route");
  // route.ts re-throws anything that isn't an AbuseError; Next.js would map
  // that to a 500 at the framework layer. Calling the handler directly here
  // (bypassing that layer), the rejection itself is the observable contract.
  await expect(POST(postReq())).rejects.toThrow("db down");
});
