import { expect, test } from "vitest";
import { parseBluesky } from "./bluesky";

// Canned response shape from:
// https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=...&limit=10
// AT Protocol: posts[].uri  = "at://did:plc:abc123/app.bsky.feed.post/rkey456"
// posts[].author.handle     = "alice.bsky.social"
// posts[].record.text       = post body text
// posts[].likeCount         = number
// posts[].replyCount        = number
const BSKY_BODY = {
  posts: [
    {
      uri: "at://did:plc:abc123/app.bsky.feed.post/rkey456",
      author: { did: "did:plc:abc123", handle: "alice.bsky.social" },
      record: { text: "Loving the new habit tracker features! Highly recommend for building daily routines.", createdAt: "2024-01-01T00:00:00Z" },
      likeCount: 45,
      replyCount: 12,
    },
    {
      uri: "at://did:plc:def789/app.bsky.feed.post/rkey012",
      author: { did: "did:plc:def789", handle: "bob.bsky.social" },
      record: { text: "Has anyone tried HabitKit? The streak interface is much cleaner than competitors. Built for focused users who want minimal friction.", createdAt: "2024-01-02T00:00:00Z" },
      likeCount: 120,
      replyCount: 33,
    },
  ],
};

test("parseBluesky maps posts to Community rows with source=bluesky", () => {
  const out = parseBluesky(BSKY_BODY);
  expect(out).toHaveLength(2);
  for (const c of out) {
    expect(c.source).toBe("bluesky");
    expect(typeof c.title).toBe("string");
    expect(c.title.length).toBeGreaterThan(0);
    expect(typeof c.url).toBe("string");
    expect(c.url.startsWith("https://bsky.app/profile/")).toBe(true);
    expect(typeof c.engagement).toBe("number");
  }
});

test("parseBluesky sums likeCount + replyCount into engagement", () => {
  const out = parseBluesky(BSKY_BODY);
  expect(out[0]?.engagement).toBe(45 + 12); // 57
  expect(out[1]?.engagement).toBe(120 + 33); // 153
});

test("parseBluesky builds bsky.app URL from handle + rkey", () => {
  const out = parseBluesky(BSKY_BODY);
  // at://did:plc:abc123/app.bsky.feed.post/rkey456 + handle alice.bsky.social
  expect(out[0]?.url).toBe("https://bsky.app/profile/alice.bsky.social/post/rkey456");
  expect(out[1]?.url).toBe("https://bsky.app/profile/bob.bsky.social/post/rkey012");
});

test("parseBluesky truncates title to ~80 chars", () => {
  const longText = "a".repeat(200);
  const out = parseBluesky({ posts: [
    {
      uri: "at://did:plc:x/app.bsky.feed.post/y",
      author: { did: "did:plc:x", handle: "x.bsky.social" },
      record: { text: longText },
      likeCount: 1,
      replyCount: 0,
    },
  ] });
  expect(out[0]?.title.length).toBeLessThanOrEqual(83); // 80 + "..."
});

test("parseBluesky returns empty array for empty posts", () => {
  expect(parseBluesky({ posts: [] })).toEqual([]);
});

test("parseBluesky is safe when posts key is missing", () => {
  expect(parseBluesky({})).toEqual([]);
});
