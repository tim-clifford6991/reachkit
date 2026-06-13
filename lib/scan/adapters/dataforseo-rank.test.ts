import { afterEach, expect, test, vi } from "vitest";
import { findPosition, normalizeTarget } from "./dataforseo-rank";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.doUnmock("@/lib/dev/fixtures");
  vi.resetModules();
});

test("normalizeTarget strips scheme, path and leading www", () => {
  expect(normalizeTarget("https://www.Habitify.me/pricing")).toBe("habitify.me");
  expect(normalizeTarget("HTTP://Streaksapp.com")).toBe("streaksapp.com");
  expect(normalizeTarget("nudgi.app")).toBe("nudgi.app");
  expect(normalizeTarget("")).toBe("");
});

test("findPosition returns 1-based organic rank of the target (PAA rows don't count)", () => {
  const body = { tasks: [{ result: [{ items: [
    { type: "organic", domain: "habitify.me", url: "https://habitify.me" },
    { type: "people_also_ask" },
    { type: "organic", domain: "streaksapp.com", url: "https://streaksapp.com" },
    { type: "organic", domain: "nudgi.app", url: "https://nudgi.app" },
  ] }] }] };
  expect(findPosition(body, normalizeTarget("https://nudgi.app"))).toBe(3);
  expect(findPosition(body, normalizeTarget("streaksapp.com"))).toBe(2);
});

test("findPosition returns null when the target does not rank in the window", () => {
  const body = { tasks: [{ result: [{ items: [
    { type: "organic", domain: "habitify.me" },
  ] }] }] };
  expect(findPosition(body, "nudgi.app")).toBeNull();
});

test("findPosition tolerates a malformed/empty body", () => {
  expect(findPosition({}, "nudgi.app")).toBeNull();
  expect(findPosition(null, "nudgi.app")).toBeNull();
});

// fixtures-mode cases: mock @/lib/dev/fixtures so fixturesEnabled()=true without
// touching env (the unit vitest config doesn't load .env.local) and so the real
// deterministic fixtureRankMap is exercised. fetch is NOT stubbed — if the live
// path ran it would throw, so passing proves the short-circuit.
test("rankLookup in fixtures mode returns a deterministic position map (1..50)", async () => {
  vi.resetModules();
  const { fixtureRankMap } = await import("@/lib/dev/fixtures");
  vi.doMock("@/lib/dev/fixtures", () => ({ fixturesEnabled: () => true, fixtureRankMap }));
  const { rankLookup } = await import("./dataforseo-rank");

  const a = await rankLookup(["habit tracker app", "daily habit tracker"], "nudgi.app");
  const b = await rankLookup(["habit tracker app", "daily habit tracker"], "nudgi.app");

  expect(a).toEqual(b); // deterministic
  for (const v of Object.values(a)) {
    expect(v).toBeGreaterThanOrEqual(1);
    expect(v).toBeLessThanOrEqual(50);
  }
  expect(Object.keys(a)).toEqual(["habit tracker app", "daily habit tracker"]);
});

test("rankLookup returns {} for empty keyword list without touching the network", async () => {
  vi.resetModules();
  vi.doMock("@/lib/dev/fixtures", () => ({ fixturesEnabled: () => true, fixtureRankMap: () => ({}) }));
  const { rankLookup } = await import("./dataforseo-rank");
  expect(await rankLookup([], "nudgi.app")).toEqual({});
  expect(await rankLookup(["", "   "], "nudgi.app")).toEqual({});
});
