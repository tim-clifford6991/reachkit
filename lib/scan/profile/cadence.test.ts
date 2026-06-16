import { describe, it, expect } from "vitest";
import { computeCadence } from "./cadence";

const NOW = Date.UTC(2026, 5, 16);
const daysAgo = (d: number) => new Date(NOW - d * 86_400_000).toISOString();

describe("computeCadence", () => {
  it("returns an empty cadence for no/invalid dates", () => {
    const c = computeCadence(["garbage", ""], NOW);
    expect(c.totalPosts).toBe(0);
    expect(c.active).toBe(false);
    expect(c.lastPublishedAt).toBeNull();
  });

  it("counts recency windows, drops future + invalid, and flags active", () => {
    const c = computeCadence(
      [daysAgo(10), daysAgo(60), daysAgo(200), daysAgo(-10) /* future */, "nope"],
      NOW,
    );
    expect(c.totalPosts).toBe(3); // future + invalid dropped
    expect(c.postsLast30).toBe(1);
    expect(c.postsLast90).toBe(2);
    expect(c.lastPublishedAt).toBe(daysAgo(10));
    expect(c.active).toBe(true);
    expect(c.postsPerMonth).toBeCloseTo(0.5, 1);
  });

  it("marks a long-dormant blog inactive", () => {
    const c = computeCadence([daysAgo(400), daysAgo(500)], NOW);
    expect(c.active).toBe(false);
    expect(c.postsLast90).toBe(0);
  });
});
