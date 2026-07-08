import { expect, test } from "vitest";
import { parseYouTube } from "./youtube";

// ---------------------------------------------------------------------------
// parseYouTube — shape + relevance gate (F1) against real search.list responses
// ---------------------------------------------------------------------------

test("parseYouTube maps relevant items to Creator records", () => {
  const body = {
    items: [
      { id: { videoId: "abc123" }, snippet: { channelTitle: "Productivity Central", title: "Habitify vs Streaks Review" } },
      { id: { videoId: "def456" }, snippet: { channelTitle: "AppReviewDaily", title: "Habitify — honest review 2025" } },
    ],
  };
  const creators = parseYouTube(body, "Habitify");
  expect(creators).toHaveLength(2);
  expect(creators[0]).toEqual({
    name: "Productivity Central",
    url: "https://www.youtube.com/watch?v=abc123",
    audienceProxy: 0,
    coveredCompetitor: "Habitify",
  });
});

test("F1: drops fuzzy-matched noise that doesn't name the competitor", () => {
  // Live bug: "ShowMRR review" returned "MRR DESIGN WHEELS CORP" (matched on "MRR").
  const body = {
    items: [
      { id: { videoId: "v1" }, snippet: { channelTitle: "MRR DESIGN WHEELS CORP", title: "Custom forged wheels install" } },
      { id: { videoId: "v2" }, snippet: { channelTitle: "IndieHackerTV", title: "ShowMRR review: is it worth it?" } },
      { id: { videoId: "v3" }, snippet: { channelTitle: "God Save America", title: "Political commentary daily" } },
    ],
  };
  const creators = parseYouTube(body, "ShowMRR");
  expect(creators.map((c) => c.name)).toEqual(["IndieHackerTV"]); // only the real review survives
});

test("F1: dedupes the same channel within a search", () => {
  const body = {
    items: [
      { id: { videoId: "v1" }, snippet: { channelTitle: "SaaSReviews", title: "Flippa deep dive" } },
      { id: { videoId: "v2" }, snippet: { channelTitle: "SaaSReviews", title: "Flippa vs Acquire" } },
    ],
  };
  expect(parseYouTube(body, "Flippa")).toHaveLength(1);
});

test("F1: matches the competitor name in the channel title too", () => {
  const body = {
    items: [
      { id: { videoId: "v1" }, snippet: { channelTitle: "Flippa Official", title: "Weekly marketplace update" } },
    ],
  };
  expect(parseYouTube(body, "Flippa")).toHaveLength(1);
});

test("parseYouTube returns [] for empty / absent items", () => {
  expect(parseYouTube({ items: [] }, "Habitify")).toEqual([]);
  expect(parseYouTube({}, "Habitify")).toEqual([]);
});

test("parseYouTube skips items missing videoId or channelTitle", () => {
  const body = {
    items: [
      { id: {}, snippet: { channelTitle: "SomeChannel", title: "Habitify review" } },
      { id: { videoId: "vid001" }, snippet: { title: "Habitify review" } },
      { id: { videoId: "vid002" }, snippet: { channelTitle: "RealChannel", title: "Habitify review" } },
    ],
  };
  const creators = parseYouTube(body, "Habitify");
  expect(creators).toHaveLength(1);
  expect(creators[0]?.name).toBe("RealChannel");
});

test("relevance gate is skipped for implausibly short competitor names (<4 chars)", () => {
  const body = { items: [{ id: { videoId: "v1" }, snippet: { channelTitle: "Chan", title: "unrelated" } }] };
  expect(parseYouTube(body, "Ab")).toHaveLength(1);
});
