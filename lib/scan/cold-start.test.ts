import { describe, expect, test } from "vitest";
import { isColdStart, resolveColdStart, isEstablishedByFootprint, ESTABLISHED_MIN_RANKED_KEYWORDS } from "./cold-start";
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
// Web mode — established-domain short-circuit, else competitive/theme footprint.
// (the niche serpResultCount + disabled-PH upvotes are deliberately NOT used,
// and an unknown domain age is never treated as "brand-new" on its own.)
// ---------------------------------------------------------------------------
test("web: an established domain (age >= 1y) is NOT Cold Start, even with thin other signals", () => {
  expect(isColdStart(facts({
    mode: "web", competitors: [], themes: [], reviewVolume: 0,
    webProxy: { score: 30, serpResultCount: 104, phUpvotes: 0, domainAgeYears: 8 },
  }))).toBe(false);
});

test("web: acquire.com-style — competitors found → NOT Cold Start (domain age unknown)", () => {
  expect(isColdStart(facts({
    mode: "web", themes: [], reviewVolume: 0,
    competitors: [{ name: "Flippa", url: "", source: "llm_extracted", rank: 1 }],
    webProxy: { score: 9, serpResultCount: 104, phUpvotes: 0, domainAgeYears: null },
  }))).toBe(false);
});

test("web: nudgi.ai-style — no competitors, no themes, new/unknown domain → Cold Start", () => {
  expect(isColdStart(facts({
    mode: "web", competitors: [], themes: [], reviewVolume: 0,
    webProxy: { score: 2, serpResultCount: 30, phUpvotes: 0, domainAgeYears: null },
  }))).toBe(true);
});

test("web: null domain age is NOT treated as brand-new on its own — a theme footprint disqualifies", () => {
  // themes present (from web-review snippets) → has a footprint → not cold, despite null age.
  expect(isColdStart(facts({
    mode: "web", competitors: [], reviewVolume: 3,
    themes: [{ term: "fees", count: 4 }],
    webProxy: { score: 0, serpResultCount: 10, phUpvotes: 0, domainAgeYears: null },
  }))).toBe(false);
});

test("web: a young domain (<1y) with competitors is NOT Cold Start", () => {
  expect(isColdStart(facts({
    mode: "web", themes: [], reviewVolume: 0,
    competitors: [{ name: "Rival", url: "https://rival.com", source: "dataforseo_serp", rank: 1 }],
    webProxy: { score: 40, serpResultCount: 50_000, phUpvotes: 5, domainAgeYears: 0.5 },
  }))).toBe(false);
});

test("web: null webProxy with no competitors and no themes → Cold Start", () => {
  expect(isColdStart(facts({ mode: "web", competitors: [], themes: [], reviewVolume: 0, webProxy: null }))).toBe(true);
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

// ---------------------------------------------------------------------------
// A1 (2026-07-25) — the deep-pass footprint override: a live product wrongly
// flagged cold-start at facts time (SPA fetch → 0 competitors, timed-out domain
// age) must be RESCUED by its real ranked-keyword footprint, never handed the
// pre-launch "waitlist" template. Genuinely pre-launch subjects keep it.
// ---------------------------------------------------------------------------
describe("resolveColdStart — deep-pass footprint override (A1)", () => {
  test("a real ranked-keyword footprint overrides a mis-flagged cold-start (the plausible.io case)", () => {
    expect(resolveColdStart(true, 1425)).toBe(false); // flagged cold-start, but 1,425 keywords → established
    expect(resolveColdStart(true, ESTABLISHED_MIN_RANKED_KEYWORDS)).toBe(false); // exactly at the line → established
  });

  test("a genuinely pre-launch subject (no footprint) stays cold-start", () => {
    expect(resolveColdStart(true, 0)).toBe(true);
    expect(resolveColdStart(true, null)).toBe(true);
    expect(resolveColdStart(true, ESTABLISHED_MIN_RANKED_KEYWORDS - 1)).toBe(true);
  });

  test("never manufactures cold-start: an established subject stays established regardless of footprint", () => {
    expect(resolveColdStart(false, 0)).toBe(false);
    expect(resolveColdStart(false, 5000)).toBe(false);
  });

  test("isEstablishedByFootprint pins the threshold", () => {
    expect(ESTABLISHED_MIN_RANKED_KEYWORDS).toBe(25);
    expect(isEstablishedByFootprint(1425)).toBe(true);
    expect(isEstablishedByFootprint(24)).toBe(false);
    expect(isEstablishedByFootprint(null)).toBe(false);
  });
});
