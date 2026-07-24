import { describe, it, expect } from "vitest";
import { shouldReuseFreeLayer, FREE_LAYER_MAX_AGE_DAYS } from "@/lib/scan/free-layer-freshness";

const NOW = new Date("2026-07-24T09:00:00Z").getTime();
const daysAgo = (d: number) => new Date(NOW - d * 24 * 60 * 60 * 1000).toISOString();

describe("shouldReuseFreeLayer — deepen freshness gate (owner rule 2026-07-24)", () => {
  it("REUSES a fresh persisted layer (≤7d) — keeps the score stable free↔paid", () => {
    expect(shouldReuseFreeLayer(daysAgo(2), true, NOW)).toBe(true); // the plausible.io case
    expect(shouldReuseFreeLayer(daysAgo(0), true, NOW)).toBe(true);
    expect(shouldReuseFreeLayer(daysAgo(FREE_LAYER_MAX_AGE_DAYS), true, NOW)).toBe(true); // exactly 7d = still fresh
  });

  it("RECOMPUTES a stale layer (>7d) — never serves week-old free data", () => {
    expect(shouldReuseFreeLayer(daysAgo(8), true, NOW)).toBe(false);
    expect(shouldReuseFreeLayer(daysAgo(21), true, NOW)).toBe(false); // "come back weeks later" case
  });

  it("RECOMPUTES when there is no persisted layer to reuse", () => {
    expect(shouldReuseFreeLayer(daysAgo(1), false, NOW)).toBe(false);
  });

  it("RECOMPUTES (fails toward fresh) on a missing/bad timestamp", () => {
    expect(shouldReuseFreeLayer(null, true, NOW)).toBe(false);
    expect(shouldReuseFreeLayer(undefined, true, NOW)).toBe(false);
    expect(shouldReuseFreeLayer("not-a-date", true, NOW)).toBe(false);
  });

  it("pins the 1-week threshold", () => {
    expect(FREE_LAYER_MAX_AGE_DAYS).toBe(7);
  });
});
