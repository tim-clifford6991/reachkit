import { expect, test, vi, beforeEach } from "vitest";
import { appIdFromUrl, fetchItunesListing, fetchItunesCompetitors } from "./itunes";

beforeEach(() => vi.restoreAllMocks());

test("appIdFromUrl extracts the trackId", () => {
  expect(appIdFromUrl("https://apps.apple.com/us/app/sofa/id1276554886")).toBe("1276554886");
});
test("appIdFromUrl throws when no id present", () => {
  expect(() => appIdFromUrl("https://apps.apple.com/us/app/sofa")).toThrow();
});

// ---------------------------------------------------------------------------
// FINDING (C1 audit): appIdFromUrl's `/\/id(\d+)/` pattern is Apple-only — a
// real Google Play Store URL (`?id=<package>`, no digits-after-"/id" path
// segment) never matches, so it throws for every android URL. Every "app
// mode" caller (get-listing.ts, find-competitors.ts, get-reviews via
// collect.ts) is written as "app mode (ios / android)" with no platform
// branch, but there is no Play-Store adapter anywhere — android silently
// degrades to a near-empty scan (see tools.test.ts) rather than using a real
// data source. Pinned here at the adapter boundary; see
// lib/scan/tools/tools.test.ts for the pipeline-level degradation this causes.
// ---------------------------------------------------------------------------
test("appIdFromUrl throws on a real Google Play Store URL (no Android adapter exists)", () => {
  expect(() => appIdFromUrl("https://play.google.com/store/apps/details?id=com.example.app")).toThrow();
});

test("fetchItunesListing maps results[0] to ListingFacts", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
    resultCount: 1,
    results: [{ trackName: "Sofa", primaryGenreName: "Lifestyle", description: "Downtime organizer",
                averageUserRating: 4.8, userRatingCount: 1200, sellerName: "Shawn Hickman" }],
  }))));
  const r = await fetchItunesListing("1276554886");
  expect(r.listing.name).toBe("Sofa");
  expect(r.listing.category).toBe("Lifestyle");
  expect(r.ratingCount).toBe(1200);
});

// ---------------------------------------------------------------------------
// fetchItunesCompetitors — C1 (launch-readiness Workstream C): previously
// untested. The iTunes /search endpoint is a keyword-overlap search (Tier A,
// §5.2), not a curated competitor list — it can and does return an unrelated
// app that merely shares (part of) the search term. This adapter itself only
// excludes the SUBJECT's own trackId; the brand-ambiguity guard against a
// different same-named product lives one layer up in
// lib/scan/competitor-filter.ts (filterRealCompetitors / hasAnyCollision),
// exercised there directly. Here we pin the adapter's own parse contract.
// ---------------------------------------------------------------------------
test("fetchItunesCompetitors maps results[] to Competitor[], 1-indexed by search rank", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
    resultCount: 2,
    results: [
      { trackId: 111, trackName: "Habitica", trackViewUrl: "https://apps.apple.com/us/app/habitica/id111" },
      { trackId: 222, trackName: "Streaks", trackViewUrl: "https://apps.apple.com/us/app/streaks/id222" },
    ],
  }))));
  const out = await fetchItunesCompetitors("habit tracker", "999");
  expect(out).toHaveLength(2);
  expect(out[0]).toMatchObject({ name: "Habitica", url: "https://apps.apple.com/us/app/habitica/id111", source: "itunes_search", rank: 1 });
  expect(out[1]).toMatchObject({ name: "Streaks", rank: 2 });
});

test("fetchItunesCompetitors excludes the subject's own trackId (self-match by id)", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
    resultCount: 2,
    results: [
      { trackId: 1276554886, trackName: "Sofa", trackViewUrl: "https://apps.apple.com/us/app/sofa/id1276554886" },
      { trackId: 333, trackName: "Watchlist+", trackViewUrl: "https://apps.apple.com/us/app/watchlist/id333" },
    ],
  }))));
  const out = await fetchItunesCompetitors("sofa", "1276554886");
  expect(out.map((c) => c.name)).toEqual(["Watchlist+"]); // self trackId dropped
});

test("fetchItunesCompetitors does NOT itself dedupe a different app sharing the subject's name (brand-ambiguity guard lives downstream in filterRealCompetitors)", async () => {
  // Two DIFFERENT apps both named "Sofa" (different developers, different ids) —
  // the search term "sofa" plausibly surfaces both. The adapter's only
  // self-exclusion is by trackId, so the homonym with a DIFFERENT id survives
  // this layer; rankCompetitors -> filterRealCompetitors (subjectName-based
  // collision check) is what must catch it before persistence.
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
    resultCount: 2,
    results: [
      { trackId: 1276554886, trackName: "Sofa", trackViewUrl: "https://apps.apple.com/us/app/sofa/id1276554886" },
      { trackId: 999999, trackName: "Sofa", trackViewUrl: "https://apps.apple.com/us/app/sofa-couch-shop/id999999" },
    ],
  }))));
  const out = await fetchItunesCompetitors("sofa", "1276554886");
  expect(out.map((c) => c.name)).toEqual(["Sofa"]); // homonym (different id) is NOT filtered here
  expect(out[0]?.url).toContain("id999999");
});

test("fetchItunesCompetitors returns [] when the search has no results", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ resultCount: 0, results: [] }))));
  expect(await fetchItunesCompetitors("nonexistent app xyz", "1")).toEqual([]);
});

test("fetchItunesListing throws on a non-ok response", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 500 })));
  await expect(fetchItunesListing("123")).rejects.toThrow(/itunes lookup 123 failed: 500/);
});

test("fetchItunesCompetitors throws on a non-ok response", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 503 })));
  await expect(fetchItunesCompetitors("term", "1")).rejects.toThrow(/itunes search "term" failed: 503/);
});
