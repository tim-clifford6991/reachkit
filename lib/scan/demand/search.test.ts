import { describe, it, expect } from "vitest";
import {
  buildRedditDemandKeyword,
  subredditFromUrl,
  parseDemandHits,
  parsePublishedAt,
  recencySearchParam,
} from "./search";

describe("buildRedditDemandKeyword", () => {
  it("wraps the pain phrase in a site:reddit.com query", () => {
    expect(buildRedditDemandKeyword("no one downloads my app")).toBe(
      'site:reddit.com "no one downloads my app"',
    );
  });
});

describe("recencySearchParam", () => {
  it("maps recency windows to Google tbs=qdr filters", () => {
    expect(recencySearchParam("month")).toBe("&tbs=qdr:m");
    expect(recencySearchParam("year")).toBe("&tbs=qdr:y");
    expect(recencySearchParam("any")).toBe("");
  });
});

describe("parsePublishedAt", () => {
  it("normalizes a parseable date to ISO, else null", () => {
    expect(parsePublishedAt("Mar 14, 2026")).toBe(new Date("Mar 14, 2026").toISOString());
    expect(parsePublishedAt("")).toBeNull();
    expect(parsePublishedAt(undefined)).toBeNull();
    expect(parsePublishedAt("not a date")).toBeNull();
  });
});

describe("subredditFromUrl", () => {
  it("extracts r/{name} from a reddit thread URL", () => {
    expect(subredditFromUrl("https://www.reddit.com/r/SaaS/comments/abc/title/")).toBe("r/SaaS");
  });
  it("returns null for non-reddit URLs", () => {
    expect(subredditFromUrl("https://news.ycombinator.com/item?id=1")).toBeNull();
  });
});

describe("parseDemandHits", () => {
  const body = {
    tasks: [
      {
        result: [
          {
            items: [
              {
                type: "organic",
                title: "How do I get my first users?",
                url: "https://www.reddit.com/r/startups/comments/1/x",
                description: "I launched but nobody is signing up...",
                timestamp: "2026-03-01 00:00:00 +00:00",
              },
              {
                type: "organic",
                title: "dup",
                url: "https://www.reddit.com/r/startups/comments/1/x", // duplicate URL
                description: "dup",
              },
              { type: "people_also_ask", title: "ignored", url: "https://x" }, // non-organic
              {
                type: "organic",
                title: "Best growth tools",
                url: "https://indiehackers.com/post/9",
                description: "a listicle",
              },
            ],
          },
        ],
      },
    ],
  };

  it("parses organic items, dedupes by URL, tags subreddit + query", () => {
    const hits = parseDemandHits(body, "first users");
    expect(hits).toHaveLength(2);
    expect(hits[0]).toMatchObject({
      title: "How do I get my first users?",
      subreddit: "r/startups",
      query: "first users",
    });
    expect(hits[0]?.publishedAt).toBe(new Date("2026-03-01 00:00:00 +00:00").toISOString());
    expect(hits[1]?.subreddit).toBeNull(); // indiehackers, not reddit
    expect(hits[1]?.publishedAt).toBeNull(); // no timestamp on this item
  });

  it("returns [] for an empty/malformed body", () => {
    expect(parseDemandHits({}, "q")).toEqual([]);
    expect(parseDemandHits(null, "q")).toEqual([]);
  });
});
