// tests/known-content/link-map.test.ts — SPEC §7 (2026-10-10, issue 1391):
// which of the customer's pages their articles link, and which articles
// stand alone.
import { describe, expect, it } from "vitest";
import { linkMapOf } from "../../src/lib/known-content/link-map";

describe("the site link map", () => {
  const map = linkMapOf(
    [
      { url: "https://blog.example.com/a", title: "A", markdown: "See [pricing](https://example.com/pricing) and [B](https://blog.example.com/b)." },
      { url: "https://blog.example.com/b", title: "B", markdown: "See [pricing](https://www.example.com/pricing/) and [a study](https://study.org/x)." },
      { url: "https://blog.example.com/c", title: "C", markdown: "No links, only [a study](https://study.org/x)." },
    ],
    "example.com"
  );

  it("counts each of the customer's pages once per article that links it", () => {
    expect(map.receiving).toEqual([{ url: "https://example.com/pricing", articles: 2 }]);
  });

  it("lists an article nothing links to, and one that links to nothing of the site's", () => {
    expect(map.alone).toEqual([
      { url: "https://blog.example.com/a", title: "A", linkedFrom: 0, linksOut: 2 },
      { url: "https://blog.example.com/c", title: "C", linkedFrom: 0, linksOut: 0 },
    ]);
  });
});
