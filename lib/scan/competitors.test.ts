import { expect, test } from "vitest";
import { rankCompetitors } from "./competitors";

test("dedupes by host, prefers lower rank, caps re-indexes", () => {
  const out = rankCompetitors([
    { name: "Habitify", url: "https://habitify.me/x", source: "tavily", rank: 3 },
    { name: "Habitify", url: "https://www.habitify.me", source: "dataforseo_serp", rank: 1 },
    { name: "Streaks", url: "https://streaksapp.com", source: "product_hunt", rank: 2 },
  ]);
  expect(out).toHaveLength(2);
  expect(out[0]?.name).toBe("Habitify");
  expect(out[0]?.source).toBe("dataforseo_serp"); // rank 1 wins; www-normalized dedupe
  expect(out[0]?.rank).toBe(1);                    // re-indexed
});

test("excludes the self host", () => {
  const out = rankCompetitors([
    { name: "Nudgi", url: "https://nudgi.app", source: "dataforseo_serp", rank: 1 },
    { name: "Habitify", url: "https://habitify.me", source: "tavily", rank: 2 },
  ], { selfHost: "nudgi.app" });
  expect(out.map((c) => c.name)).toEqual(["Habitify"]);
});

test("caps at the requested count", () => {
  const many = Array.from({ length: 9 }, (_, i) => ({ name: `c${i}`, url: `https://c${i}.com`, source: "x", rank: i + 1 }));
  expect(rankCompetitors(many, { cap: 5 })).toHaveLength(5);
});
