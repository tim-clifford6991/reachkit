import { expect, test } from "vitest";
import { parseHnAlgolia } from "./hn-algolia";

// Canned response shape from https://hn.algolia.com/api/v1/search?query=...&tags=story
const HN_BODY = {
  hits: [
    {
      title: "Ask HN: Best habit tracking apps?",
      url: "https://news.ycombinator.com/item?id=12345",
      points: 142,
      num_comments: 87,
    },
    {
      title: "Show HN: I built a habit tracker in 48 hours",
      url: "https://github.com/user/habit-tracker",
      points: 310,
      num_comments: 64,
    },
    // Hit with no url (self-post) — should still parse with a fallback url
    {
      title: "Habit tracking for developers",
      url: null,
      points: 55,
      num_comments: 23,
      objectID: "99999",
    },
  ],
};

test("parseHnAlgolia maps hits to Community rows with source=hn", () => {
  const out = parseHnAlgolia(HN_BODY);
  expect(out).toHaveLength(3);
  for (const c of out) {
    expect(c.source).toBe("hn");
    expect(typeof c.title).toBe("string");
    expect(c.title.length).toBeGreaterThan(0);
    expect(typeof c.url).toBe("string");
    expect(typeof c.engagement).toBe("number");
  }
});

test("parseHnAlgolia sums points + num_comments into engagement", () => {
  const out = parseHnAlgolia(HN_BODY);
  expect(out[0]?.engagement).toBe(142 + 87); // 229
  expect(out[1]?.engagement).toBe(310 + 64); // 374
});

test("parseHnAlgolia falls back to HN item URL when url is null", () => {
  const out = parseHnAlgolia(HN_BODY);
  // Third hit has null url; objectID=99999 → fallback HN item URL
  expect(out[2]?.url).toBe("https://news.ycombinator.com/item?id=99999");
});

test("parseHnAlgolia returns empty array for empty hits", () => {
  expect(parseHnAlgolia({ hits: [] })).toEqual([]);
});

test("parseHnAlgolia is safe when hits key is missing", () => {
  expect(parseHnAlgolia({})).toEqual([]);
});
