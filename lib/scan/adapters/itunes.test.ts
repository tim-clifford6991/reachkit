import { expect, test, vi, beforeEach } from "vitest";
import { appIdFromUrl, fetchItunesListing } from "./itunes";

beforeEach(() => vi.restoreAllMocks());

test("appIdFromUrl extracts the trackId", () => {
  expect(appIdFromUrl("https://apps.apple.com/us/app/sofa/id1276554886")).toBe("1276554886");
});
test("appIdFromUrl throws when no id present", () => {
  expect(() => appIdFromUrl("https://apps.apple.com/us/app/sofa")).toThrow();
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
