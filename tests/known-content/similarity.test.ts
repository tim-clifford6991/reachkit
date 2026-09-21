// SPEC §7 (2026-09-20, #928) — the measure, and where its threshold sits.
//
// `KNOWN_CONTENT.COVERED_MIN` decides whether a planned page is a repeat of
// a page the site already has. A threshold is only as good as the two
// populations it separates, so the table below **is** the argument for it:
// pairs that are the same page written twice, and pairs that are two pages
// a reader would want both of. This file fails if the gap between them
// closes — which is what would make 0.6 the wrong number.
//
// The measure is the one `pg_trgm` defines (trigram-set Jaccard over
// space-padded words), because the shortlist these scores are computed over
// is narrowed by that extension's own index and operator: narrowing and
// scoring must measure the same thing.
import { describe, expect, it } from "vitest";
import { KNOWN_CONTENT } from "@/lib/config/constants";
import { topicSimilarity, trigrams } from "@/lib/known-content/similarity";

/** Two pages that are one topic: a repeat, whatever the wording. */
const SAME_TOPIC: readonly [string, string][] = [
  ["how to price a retainer", "How to price a retainer"],
  ["best project management software for agencies", "The best project management software for agencies"],
  ["project management software for agencies", "Agency project management software"],
  ["agency time tracking", "Time tracking for agencies"],
  ["time tracking tools", "Time tracking tool"],
];

/** Two pages a reader would want both of — and the first two are the hard
 *  ones: they share a phrase, or differ by one word. */
const DIFFERENT_TOPIC: readonly [string, string][] = [
  ["how to price a retainer", "How to price a project"],
  ["seo for agencies", "SEO for accountants"],
  ["agency project management software", "Project kickoff checklist for agencies"],
  ["best time tracking app", "Our office is moving to Lisbon"],
  ["client portal for agencies", "Careers at Northwind"],
];

describe("#928 — the trigram measure is pg_trgm's own", () => {
  it("pads each word with two leading spaces and one trailing, as the extension does", () => {
    // `  ab `: "  a", " ab", "ab ". A two-letter word still yields trigrams,
    // which is what the padding is for.
    expect([...trigrams("ab")].sort()).toEqual(["  a", " ab", "ab "]);
  });

  it("is symmetric, and blind to case, punctuation and word order", () => {
    expect(topicSimilarity("a b", "b a")).toBe(topicSimilarity("b a", "a b"));
    expect(topicSimilarity("Time Tracking!", "time tracking")).toBe(1);
    expect(topicSimilarity("time tracking", "tracking time")).toBe(1);
  });

  it("two texts with no words are the same, and an empty one shares nothing with a text", () => {
    expect(topicSimilarity("", "   ")).toBe(1);
    expect(topicSimilarity("", "time tracking")).toBe(0);
  });
});

describe("#928 — 0.6 separates a repeat from a page worth writing", () => {
  it("every pair that is one topic scores at or above the threshold", () => {
    for (const [a, b] of SAME_TOPIC) {
      expect(topicSimilarity(a, b), `${a} ≈ ${b}`).toBeGreaterThanOrEqual(KNOWN_CONTENT.COVERED_MIN);
    }
  });

  it("every pair that is two topics scores below it", () => {
    for (const [a, b] of DIFFERENT_TOPIC) {
      expect(topicSimilarity(a, b), `${a} ≉ ${b}`).toBeLessThan(KNOWN_CONTENT.COVERED_MIN);
    }
  });

  it("the two populations do not touch: the closest miss is below the furthest hit", () => {
    // The gap is the whole argument for the number. If a later change to the
    // measure closes it, this row is the one that says so.
    const worstHit = Math.min(...SAME_TOPIC.map(([a, b]) => topicSimilarity(a, b)));
    const bestMiss = Math.max(...DIFFERENT_TOPIC.map(([a, b]) => topicSimilarity(a, b)));
    expect(bestMiss).toBeLessThan(worstHit);
    expect(KNOWN_CONTENT.COVERED_MIN).toBeGreaterThan(bestMiss);
    expect(KNOWN_CONTENT.COVERED_MIN).toBeLessThanOrEqual(worstHit);
  });
});
