import { describe, it, expect } from "vitest";
import { summarizePresence } from "./community";

const NOW = Date.UTC(2026, 5, 16);
const daysAgo = (d: number) => new Date(NOW - d * 86_400_000).toISOString();

describe("summarizePresence", () => {
  it("counts mentions, finds the most recent, and flags active", () => {
    const p = summarizePresence(
      "reddit",
      [
        { title: "old", url: "u1", at: daysAgo(200) },
        { title: "fresh", url: "u2", at: daysAgo(10) },
        { title: "mid", url: "u3", at: daysAgo(60) },
      ],
      NOW,
    );
    expect(p.source).toBe("reddit");
    expect(p.mentions).toBe(3);
    expect(p.lastSeen).toBe(daysAgo(10));
    expect(p.active).toBe(true);
    // top threads sorted most-recent first, capped at 3
    expect(p.topThreads.map((t) => t.title)).toEqual(["fresh", "mid", "old"]);
  });

  it("is inactive when the most recent mention is older than 90 days", () => {
    const p = summarizePresence("hacker_news", [{ title: "x", url: "u", at: daysAgo(120) }], NOW);
    expect(p.active).toBe(false);
    expect(p.lastSeen).toBe(daysAgo(120));
  });

  it("handles dateless mentions (null lastSeen, inactive)", () => {
    const p = summarizePresence("hacker_news", [{ title: "x", url: "u", at: null }], NOW);
    expect(p.mentions).toBe(1);
    expect(p.lastSeen).toBeNull();
    expect(p.active).toBe(false);
  });
});
