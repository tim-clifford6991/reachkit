import { expect, test } from "vitest";
import { parseYouTube } from "./youtube";

// ---------------------------------------------------------------------------
// parseYouTube — shape locked against real YouTube search.list response
// ---------------------------------------------------------------------------

test("parseYouTube maps items to Creator records", () => {
  const body = {
    items: [
      {
        id: { videoId: "abc123" },
        snippet: { channelTitle: "Productivity Central", title: "Habitify vs Streaks Review" },
      },
      {
        id: { videoId: "def456" },
        snippet: { channelTitle: "AppReviewDaily", title: "Best Habit Tracker Apps 2025" },
      },
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
  expect(creators[1]).toEqual({
    name: "AppReviewDaily",
    url: "https://www.youtube.com/watch?v=def456",
    audienceProxy: 0,
    coveredCompetitor: "Habitify",
  });
});

test("parseYouTube returns empty array for empty items list", () => {
  expect(parseYouTube({ items: [] }, "Habitify")).toEqual([]);
});

test("parseYouTube returns empty array when items key is absent", () => {
  expect(parseYouTube({}, "Habitify")).toEqual([]);
});

test("parseYouTube skips items missing videoId", () => {
  const body = {
    items: [
      // missing id.videoId
      { id: {}, snippet: { channelTitle: "SomeChannel", title: "Some video" } },
      // valid
      { id: { videoId: "xyz789" }, snippet: { channelTitle: "GoodChannel", title: "Good video" } },
    ],
  };
  const creators = parseYouTube(body, "TestComp");
  expect(creators).toHaveLength(1);
  expect(creators[0]?.name).toBe("GoodChannel");
});

test("parseYouTube skips items missing channelTitle", () => {
  const body = {
    items: [
      // missing snippet.channelTitle
      { id: { videoId: "vid001" }, snippet: { title: "No channel here" } },
      // valid
      { id: { videoId: "vid002" }, snippet: { channelTitle: "RealChannel", title: "Real video" } },
    ],
  };
  const creators = parseYouTube(body, "TestComp");
  expect(creators).toHaveLength(1);
  expect(creators[0]?.name).toBe("RealChannel");
});

test("parseYouTube sets coveredCompetitor from argument", () => {
  const body = {
    items: [
      { id: { videoId: "v1" }, snippet: { channelTitle: "Chan", title: "Title" } },
    ],
  };
  const creators = parseYouTube(body, "Streaks");
  expect(creators[0]?.coveredCompetitor).toBe("Streaks");
});
