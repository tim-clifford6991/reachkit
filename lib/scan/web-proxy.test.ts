import { expect, test } from "vitest";
import { webProxyScore } from "./web-proxy";

test("more SERP results + upvotes + older domain → higher score, clamped to 100", () => {
  const lo = webProxyScore({ serpResultCount: 100, phUpvotes: 0, domainAgeYears: 0 });
  const hi = webProxyScore({ serpResultCount: 5_000_000, phUpvotes: 800, domainAgeYears: 8 });
  expect(hi.score).toBeGreaterThan(lo.score);
  expect(hi.score).toBeLessThanOrEqual(100);
  expect(hi.score).toBeGreaterThanOrEqual(0);
});
test("null domain age is treated as 0, not a crash", () => {
  expect(webProxyScore({ serpResultCount: 0, phUpvotes: 0, domainAgeYears: null }).score).toBe(0);
});
