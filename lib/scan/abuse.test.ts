import { afterEach, describe, expect, test, vi } from "vitest";

// Mockable surface: fixtures flag + the service-role db client. The db mock
// returns a deferred result so each test resolves the count it wants.
const fixturesEnabledMock = vi.fn<() => boolean>(() => false);
let nextCount: number | null = 0;
let nextError: { message: string } | null = null;
const gteMock = vi.fn(async () => ({ count: nextCount, error: nextError }));
const eqMock = vi.fn(() => ({ gte: gteMock }));
const selectMock = vi.fn(() => ({ eq: eqMock }));
const fromMock = vi.fn(() => ({ select: selectMock }));

vi.mock("@/lib/dev/fixtures", () => ({ fixturesEnabled: () => fixturesEnabledMock() }));
vi.mock("@/lib/db/client", () => ({ serverDb: () => ({ from: fromMock }) }));

const { hashIp, ipFromRequest, assertRateLimit, AbuseError, RATE_LIMIT } = await import("./abuse");

function reqWith(headers: Record<string, string>): import("next/server").NextRequest {
  return { headers: new Headers(headers) } as unknown as import("next/server").NextRequest;
}

afterEach(() => {
  vi.clearAllMocks();
  fixturesEnabledMock.mockReturnValue(false);
  nextCount = 0;
  nextError = null;
});

describe("hashIp", () => {
  test("is a stable hex sha256 and never echoes the raw ip", () => {
    const h = hashIp("203.0.113.7");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).toBe(hashIp("203.0.113.7")); // deterministic
    expect(h).not.toContain("203.0.113.7");
    expect(hashIp("203.0.113.7")).not.toBe(hashIp("203.0.113.8"));
  });
});

describe("ipFromRequest", () => {
  test("prefers the first x-forwarded-for entry", () => {
    expect(ipFromRequest(reqWith({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" }))).toBe("1.2.3.4");
  });
  test("falls back to x-real-ip", () => {
    expect(ipFromRequest(reqWith({ "x-real-ip": "9.9.9.9" }))).toBe("9.9.9.9");
  });
  test("returns 'unknown' when no proxy headers are present", () => {
    expect(ipFromRequest(reqWith({}))).toBe("unknown");
  });
});

describe("assertRateLimit counting", () => {
  test("resolves when under the limit", async () => {
    nextCount = RATE_LIMIT - 1;
    await expect(assertRateLimit(hashIp("1.2.3.4"))).resolves.toBeUndefined();
    expect(gteMock).toHaveBeenCalledTimes(1);
  });

  test("throws AbuseError('rate_limit') at the limit", async () => {
    nextCount = RATE_LIMIT;
    await expect(assertRateLimit(hashIp("1.2.3.4"))).rejects.toBeInstanceOf(AbuseError);
    await expect(assertRateLimit(hashIp("1.2.3.4"))).rejects.toMatchObject({ kind: "rate_limit" });
  });

  test("treats a null count as zero (resolves)", async () => {
    nextCount = null;
    await expect(assertRateLimit(hashIp("1.2.3.4"))).resolves.toBeUndefined();
  });

  test("propagates a db error", async () => {
    nextError = { message: "boom" };
    await expect(assertRateLimit(hashIp("1.2.3.4"))).rejects.toMatchObject({ message: "boom" });
  });
});

describe("assertRateLimit skips", () => {
  test("fixtures mode skips the limit regardless of count (no query issued)", async () => {
    fixturesEnabledMock.mockReturnValue(true);
    nextCount = RATE_LIMIT * 100;
    await expect(assertRateLimit(hashIp("1.2.3.4"))).resolves.toBeUndefined();
    expect(fromMock).not.toHaveBeenCalled();
  });

  test("the 'unknown' ip hash is never rate-limited (no query issued)", async () => {
    nextCount = RATE_LIMIT * 100;
    await expect(assertRateLimit(hashIp("unknown"))).resolves.toBeUndefined();
    expect(fromMock).not.toHaveBeenCalled();
  });
});
