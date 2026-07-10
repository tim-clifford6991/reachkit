/**
 * free-keyword-teaser.test.ts (PR B) — the subject-only free "wow" transform.
 * Pins: only NOT-winning searches (below top 3) surface, ranked by volume, deduped
 * to the best position per keyword, and rival data is never involved.
 */
import { describe, it, expect } from "vitest";
import { buildFreeTeaser } from "./free-keyword-teaser";
import type { RankedKeyword } from "@/lib/scan/adapters/dataforseo-ranked-keywords";

const kw = (keyword: string, position: number, volume: number): RankedKeyword => ({
  keyword,
  position,
  volume,
  etv: volume,
  url: `https://example.com/${keyword.replace(/\s+/g, "-")}`,
});

describe("buildFreeTeaser", () => {
  it("keeps only searches where the subject is NOT winning (position > 3)", () => {
    const out = buildFreeTeaser([
      kw("habit tracker 2026", 7, 8100), // not winning → shown
      kw("free habit app", 2, 3300), // winning (top 3) → excluded
      kw("habit template", 15, 2400), // not winning → shown
    ]);
    expect(out.rows.map((r) => r.keyword)).toEqual(["habit tracker 2026", "habit template"]);
    expect(out.total).toBe(2);
  });

  it("ranks rows by volume desc and carries the subject position", () => {
    const out = buildFreeTeaser([kw("a", 9, 500), kw("b", 12, 9000), kw("c", 5, 2000)]);
    expect(out.rows.map((r) => r.keyword)).toEqual(["b", "c", "a"]);
    expect(out.rows[0]).toMatchObject({ keyword: "b", volume: 9000, yourPosition: 12 });
  });

  it("dedupes a keyword to its best position and max volume", () => {
    const out = buildFreeTeaser([kw("x", 20, 1000), kw("x", 8, 1500)]);
    expect(out.rows).toHaveLength(1);
    expect(out.rows[0]).toMatchObject({ keyword: "x", volume: 1500, yourPosition: 8 });
  });

  it("returns empty when the site already wins everything (all top 3)", () => {
    const out = buildFreeTeaser([kw("a", 1, 5000), kw("b", 3, 2000)]);
    expect(out).toEqual({ rows: [], total: 0 });
  });

  it("drops deep-SERP incidental rankings (position > 20 = noise, not a real gap)", () => {
    // e.g. a review-aggregator ranking #66 for a huge other-brand term.
    const out = buildFreeTeaser([
      kw("spanglish translator", 66, 550000), // incidental → excluded
      kw("blotato", 74, 27100), // incidental → excluded
      kw("cometly", 8, 60500), // page-1, close → kept
      kw("trimrx", 20, 40500), // boundary (<=20) → kept
    ]);
    expect(out.rows.map((r) => r.keyword)).toEqual(["cometly", "trimrx"]);
    expect(out.total).toBe(2);
  });

  it("ignores zero-volume and unranked (position 0) rows", () => {
    const out = buildFreeTeaser([kw("a", 0, 5000), kw("b", 9, 0), kw("c", 9, 1200)]);
    expect(out.rows.map((r) => r.keyword)).toEqual(["c"]);
  });

  it("caps shown rows at 6 but reports the true total", () => {
    const many = Array.from({ length: 10 }, (_, i) => kw(`k${i}`, 10, 1000 - i));
    const out = buildFreeTeaser(many);
    expect(out.rows).toHaveLength(6);
    expect(out.total).toBe(10);
  });
});
