/**
 * platform-map.test.ts — plan-item → execution route inference (PURE).
 *
 * Coverage: specific-platform mentions beat channel fallbacks; subreddit
 * extraction; every synthesis channel value falls back to a sane route.
 */
import { describe, expect, test } from "vitest";
import { inferExecutionRoute, extractSubreddit } from "./platform-map";

describe("extractSubreddit", () => {
  test("from a target label", () => {
    expect(extractSubreddit("r/SideProject weekly thread")).toBe("SideProject");
  });
  test("from a reddit URL", () => {
    expect(extractSubreddit("https://www.reddit.com/r/indiehackers/")).toBe("indiehackers");
  });
  test("absent when no r/ present", () => {
    expect(extractSubreddit("Hacker News front page")).toBeUndefined();
  });
});

describe("inferExecutionRoute — specific platform mentions win", () => {
  test("reddit target → share:reddit with subreddit", () => {
    const r = inferExecutionRoute({ channel: "community", target: "r/SideProject", targetUrl: "https://reddit.com/r/SideProject" });
    expect(r).toEqual({ kind: "share", platform: "reddit", subreddit: "SideProject" });
  });
  test("Hacker News target → coach:hackernews (not the community fallback)", () => {
    const r = inferExecutionRoute({ channel: "community", target: "Hacker News (Show HN)" });
    expect(r).toEqual({ kind: "coach", platform: "hackernews" });
  });
  test("Product Hunt in a marketplace channel → coach:producthunt (not directory)", () => {
    const r = inferExecutionRoute({ channel: "marketplace", target: "Product Hunt", targetUrl: "https://www.producthunt.com" });
    expect(r).toEqual({ kind: "coach", platform: "producthunt" });
  });
  test("X/Twitter target → share:x", () => {
    expect(inferExecutionRoute({ channel: "media", target: "X (Twitter) build-in-public" })).toEqual({ kind: "share", platform: "x" });
    expect(inferExecutionRoute({ channel: "media", target: "x" })).toEqual({ kind: "share", platform: "x" });
  });
  test("LinkedIn target → share:linkedin", () => {
    expect(inferExecutionRoute({ channel: "media", target: "LinkedIn founder post" })).toEqual({ kind: "share", platform: "linkedin" });
  });
  test("Indie Hackers → coach:indiehackers", () => {
    expect(inferExecutionRoute({ channel: "community", target: "IndieHackers.com" })).toEqual({ kind: "coach", platform: "indiehackers" });
  });
});

describe("inferExecutionRoute — channel fallbacks", () => {
  test("directory → coach:directory", () => {
    expect(inferExecutionRoute({ channel: "directory", target: "AlternativeTo" })).toEqual({ kind: "coach", platform: "directory" });
  });
  test("marketplace → coach:directory", () => {
    expect(inferExecutionRoute({ channel: "marketplace", target: "G2 listing" })).toEqual({ kind: "coach", platform: "directory" });
  });
  test("'Slack App Directory' on a marketplace channel → directory, NOT discord", () => {
    expect(inferExecutionRoute({ channel: "marketplace", target: "Slack App Directory" })).toEqual({ kind: "coach", platform: "directory" });
  });
  test("slack community on a community channel still → coach:discord", () => {
    expect(inferExecutionRoute({ channel: "community", target: "Makers Slack" })).toEqual({ kind: "coach", platform: "discord" });
  });
  test("unnamed community → coach:discord (community etiquette)", () => {
    expect(inferExecutionRoute({ channel: "community", target: "Makers community" })).toEqual({ kind: "coach", platform: "discord" });
  });
  test("podcast / newsletter / media / partner → share:email pitch", () => {
    for (const channel of ["podcast", "newsletter", "media", "partner"]) {
      expect(inferExecutionRoute({ channel, target: "Indie Bites" })).toEqual({ kind: "share", platform: "email" });
    }
  });
  test("unknown channel → share:email (universal fallback)", () => {
    expect(inferExecutionRoute({ channel: "other", target: "somewhere new" })).toEqual({ kind: "share", platform: "email" });
  });
});
