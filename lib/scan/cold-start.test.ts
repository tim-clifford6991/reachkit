import { expect, test } from "vitest";
import { isColdStart } from "./cold-start";
import type { PreliminaryFacts } from "@/lib/scan/types";

// A "well-established" baseline we then override per case.
function facts(overrides: Partial<PreliminaryFacts>): PreliminaryFacts {
  return {
    mode: "ios",
    listing: { name: "App", category: "Productivity", description: "An app" },
    competitors: [{ name: "Rival", url: "https://rival.com", source: "dataforseo_serp", rank: 1 }],
    reviewVolume: 1500,
    ratingTrend: 4.6,
    webProxy: null,
    themes: [{ term: "streaks", count: 30 }],
    sourcesUsed: ["itunes", "app_store_rss"],
    coldStart: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// App mode — judged on review volume
// ---------------------------------------------------------------------------
test("app mode with < 25 reviews is Cold Start", () => {
  expect(isColdStart(facts({ mode: "ios", reviewVolume: 12 }))).toBe(true);
  expect(isColdStart(facts({ mode: "ios", reviewVolume: 0 }))).toBe(true);
  // boundary: 24 is cold, 25 is not
  expect(isColdStart(facts({ mode: "ios", reviewVolume: 24 }))).toBe(true);
});

test("an established app (1,500 reviews) is NOT Cold Start", () => {
  expect(isColdStart(facts({ mode: "ios", reviewVolume: 1500 }))).toBe(false);
  // boundary: exactly 25 reviews is enough footprint
  expect(isColdStart(facts({ mode: "ios", reviewVolume: 25 }))).toBe(false);
});

test("android mode uses the same review-volume threshold", () => {
  expect(isColdStart(facts({ mode: "android", reviewVolume: 5 }))).toBe(true);
  expect(isColdStart(facts({ mode: "android", reviewVolume: 800 }))).toBe(false);
});

// ---------------------------------------------------------------------------
// Web mode — judged on the web proxy footprint
// ---------------------------------------------------------------------------
test("web mode with a null webProxy is Cold Start", () => {
  expect(isColdStart(facts({ mode: "web", reviewVolume: 0, webProxy: null }))).toBe(true);
});

test("a brand-new website (tiny SERP, no PH, <1y domain) is Cold Start", () => {
  const newSite = facts({
    mode: "web",
    reviewVolume: 0,
    webProxy: { score: 1, serpResultCount: 30, phUpvotes: 0, domainAgeYears: 0.2 },
  });
  expect(isColdStart(newSite)).toBe(true);
});

test("an established website (large SERP footprint) is NOT Cold Start", () => {
  const established = facts({
    mode: "web",
    reviewVolume: 0,
    webProxy: { score: 70, serpResultCount: 842_000, phUpvotes: 312, domainAgeYears: 4 },
  });
  expect(isColdStart(established)).toBe(false);
});

test("a young domain that nonetheless ranks broadly is NOT Cold Start (any strong signal disqualifies)", () => {
  // <1y domain but a real SERP footprint → has a footprint → not cold.
  const youngButVisible = facts({
    mode: "web",
    reviewVolume: 0,
    webProxy: { score: 40, serpResultCount: 50_000, phUpvotes: 5, domainAgeYears: 0.5 },
  });
  expect(isColdStart(youngButVisible)).toBe(false);

  // brand-new domain with a viral PH launch → has a launch signal → not cold.
  const phLaunch = facts({
    mode: "web",
    reviewVolume: 0,
    webProxy: { score: 30, serpResultCount: 100, phUpvotes: 400, domainAgeYears: 0.1 },
  });
  expect(isColdStart(phLaunch)).toBe(false);
});

test("null domain age is treated as brand-new (Cold Start when other signals are weak)", () => {
  const unknownAge = facts({
    mode: "web",
    reviewVolume: 0,
    webProxy: { score: 0, serpResultCount: 10, phUpvotes: 0, domainAgeYears: null },
  });
  expect(isColdStart(unknownAge)).toBe(true);
});

// ---------------------------------------------------------------------------
// Effectively-no-signal — degraded/empty facts in ANY mode
// ---------------------------------------------------------------------------
test("effectively no signal at all (no competitors, no themes, thin reviews) is Cold Start", () => {
  expect(
    isColdStart(facts({ mode: "ios", competitors: [], themes: [], reviewVolume: 3 })),
  ).toBe(true);
});

test("a healthy app keeps its footprint even with few themes", () => {
  // Lots of reviews but no extracted themes and competitors present → still established.
  expect(
    isColdStart(facts({ mode: "ios", competitors: [{ name: "X", url: "https://x.com", source: "s", rank: 1 }], themes: [], reviewVolume: 900 })),
  ).toBe(false);
});
