import { expect, test } from "vitest";
import { assembleFacts } from "./facts";

const base = { scanId: "s", appId: "a", storeUrl: "https://nudgi.app", budget: {} as never };

test("web mode produces a webProxy and null ratingTrend", () => {
  const f = assembleFacts({ ...base, mode: "web" }, {
    listing: { name: "Nudgi", category: null, description: "habits" },
    reviews: [], competitors: [{ name: "Habitify", url: "https://habitify.me", source: "x", rank: 1 }],
    extras: { serpResultCount: 1_000_000, phUpvotes: 300, domainAgeYears: 4 },
  });
  expect(f.ratingTrend).toBeNull();
  expect(f.webProxy?.score).toBeGreaterThan(0);
  expect(f.sourcesUsed).toContain("dataforseo_serp");
});

test("app mode produces ratingTrend + null webProxy + themes", () => {
  const f = assembleFacts({ ...base, mode: "ios" }, {
    listing: { name: "Sofa", category: "Lifestyle", description: "" },
    reviews: [{ rating: 5, title: "", body: "love the onboarding" }, { rating: 3, title: "", body: "onboarding confusing" }],
    competitors: [], extras: { ratingCount: 1200, rating: 4.6 },
  });
  expect(f.webProxy).toBeNull();
  expect(f.ratingTrend).toBe(4.6);
  expect(f.reviewVolume).toBe(1200);
  expect(f.themes[0]?.term).toBe("onboarding");
});
