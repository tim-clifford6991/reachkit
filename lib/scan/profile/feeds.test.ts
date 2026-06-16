import { describe, it, expect } from "vitest";
import { feedUrlsFromHtml, parseFeedDates, defaultFeedCandidates } from "./feeds";

describe("feedUrlsFromHtml", () => {
  it("discovers rss/atom feeds and resolves relative hrefs", () => {
    const html = `<head>
      <link rel="alternate" type="application/rss+xml" href="/blog/feed">
      <link rel="alternate" type="application/atom+xml" href="https://x.com/atom.xml">
      <link rel="stylesheet" href="/style.css">
    </head>`;
    expect(feedUrlsFromHtml(html, "https://x.com")).toEqual([
      "https://x.com/blog/feed",
      "https://x.com/atom.xml",
    ]);
  });
  it("returns [] when no feed link present", () => {
    expect(feedUrlsFromHtml("<head></head>", "https://x.com")).toEqual([]);
  });
});

describe("parseFeedDates", () => {
  it("extracts RSS pubDate and Atom published/updated", () => {
    const xml = `<feed>
      <item><pubDate>Mon, 01 Jun 2026 10:00:00 GMT</pubDate></item>
      <entry><published>2026-05-20T00:00:00Z</published><updated>2026-05-21T00:00:00Z</updated></entry>
    </feed>`;
    const dates = parseFeedDates(xml);
    expect(dates).toContain("Mon, 01 Jun 2026 10:00:00 GMT");
    expect(dates).toContain("2026-05-20T00:00:00Z");
    expect(dates).toContain("2026-05-21T00:00:00Z");
  });
});

describe("defaultFeedCandidates", () => {
  it("includes the common feed paths", () => {
    const c = defaultFeedCandidates("x.com");
    expect(c).toContain("https://x.com/feed");
    expect(c).toContain("https://x.com/index.xml");
  });
});
