import { describe, expect, test } from "vitest";
import type { Competitor } from "@/lib/scan/types";
import {
  brandFromHost,
  cleanCompetitorName,
  filterRealCompetitors,
  isAggregatorHost,
  isNameCollision,
  looksLikeListicle,
} from "./competitor-filter";
import { rankCompetitors } from "./competitors";

// The ACTUAL garbage the live nudgi.ai scan surfaced as "competitors" — all are
// listicle/aggregator articles about a different product ("Nudge"), not rivals.
const NUDGI_GARBAGE: Competitor[] = [
  { name: "Top 10 Nudge Alternatives & Competitors in 2026 - G2", url: "https://www.g2.com/products/nudge/competitors/alternatives", source: "tavily", rank: 1 },
  { name: "18 Best Nudge Alternatives - Reviews, Features, Pros & Cons", url: "https://www.saashub.com/nudge-alternatives", source: "tavily", rank: 2 },
  { name: "Nudge.ai Competitors & Alternatives (2026) | Product Hunt", url: "https://www.producthunt.com/products/nudge-ai/alternatives", source: "tavily", rank: 3 },
  { name: "Best Nudge Alternatives & Competitors", url: "https://medium.com/@x/best-nudge-alternatives", source: "tavily", rank: 4 },
  { name: "Top Nudge Security Alternatives & Competitors 2026 - Gartner", url: "https://www.gartner.com/reviews/market/x/nudge-security/alternatives", source: "tavily", rank: 5 },
];

describe("isAggregatorHost", () => {
  test.each([
    ["g2.com", true],
    ["www.g2.com", true],
    ["reviews.gartner.com", true],
    ["producthunt.com", true],
    ["youtube.com", true],
    ["focusmate.com", false],
    ["habitica.com", false],
    ["apps.apple.com", false], // app-store host is NOT an aggregator
    ["play.google.com", false],
  ])("isAggregatorHost(%s) -> %s", (host, expected) => {
    expect(isAggregatorHost(host)).toBe(expected);
  });
});

describe("looksLikeListicle", () => {
  test.each([
    ["Top 10 Nudge Alternatives & Competitors in 2026 - G2", true],
    ["18 Best Nudge Alternatives - Reviews, Features, Pros & Cons", true],
    ["Notion vs Nudgi", true],
    ["Best Nudge Alternatives & Competitors", true],
    ["Focusmate", false],
    ["Habitica", false],
    ["Notion – The all-in-one workspace", false],
  ])("looksLikeListicle(%s) -> %s", (name, expected) => {
    expect(looksLikeListicle(name)).toBe(expected);
  });
});

describe("cleanCompetitorName", () => {
  test("strips trailing tagline / site suffix", () => {
    expect(cleanCompetitorName("Focusmate – Virtual Coworking for Deep Work")).toBe("Focusmate");
    expect(cleanCompetitorName("Notion | The all-in-one workspace")).toBe("Notion");
    expect(cleanCompetitorName("Streaks: The To-Do List That Helps You Form Good Habits")).toBe("Streaks");
  });
  test("leaves a plain name untouched", () => {
    expect(cleanCompetitorName("Habitica")).toBe("Habitica");
  });
});

describe("brandFromHost", () => {
  test("derives a brand from the domain", () => {
    expect(brandFromHost("focusmate.com")).toBe("Focusmate");
    expect(brandFromHost("www.habitica.com")).toBe("Habitica");
  });
});

describe("filterRealCompetitors", () => {
  test("drops ALL of the live nudgi.ai garbage (honest empty → Cold Start)", () => {
    expect(filterRealCompetitors(NUDGI_GARBAGE)).toEqual([]);
  });

  test("keeps real product competitors and normalises their names", () => {
    const raw: Competitor[] = [
      { name: "Focusmate – Virtual Coworking", url: "https://focusmate.com", source: "dataforseo_serp", rank: 1 },
      { name: "Top 10 Alternatives - G2", url: "https://www.g2.com/x/alternatives", source: "dataforseo_serp", rank: 2 },
      { name: "Habitica", url: "https://habitica.com/", source: "tavily", rank: 3 },
    ];
    const out = filterRealCompetitors(raw);
    expect(out.map((c) => c.name)).toEqual(["Focusmate", "Habitica"]);
  });

  test("drops the subject's own domain (self)", () => {
    const raw: Competitor[] = [
      { name: "Nudgi", url: "https://nudgi.ai/", source: "dataforseo_serp", rank: 1 },
      { name: "Focusmate", url: "https://focusmate.com", source: "dataforseo_serp", rank: 2 },
    ];
    const out = filterRealCompetitors(raw, { selfHost: "nudgi.ai" });
    expect(out.map((c) => c.name)).toEqual(["Focusmate"]);
  });

  test("falls back to the host brand when a kept result has an empty name", () => {
    const raw: Competitor[] = [{ name: "", url: "https://doneapp.io", source: "tavily", rank: 1 }];
    expect(filterRealCompetitors(raw)[0]?.name).toBe("Doneapp");
  });
});

describe("isNameCollision (brand-ambiguity hard rule)", () => {
  test.each([
    ["Nudge", "Nudgi", true], // the exact failure: a different product, near-identical name
    ["Nudge.ai", "Nudgi", true],
    ["nudgi", "Nudgi", true], // self, normalised-equal
    ["Notion", "Nudgi", false],
    ["Focusmate", "Nudgi", false],
    ["Habitica", "Nudgi", false],
    ["Box", "Bex", false], // < 4 chars → too short to judge, never collide
    ["Done", "Dane", true], // 4 chars, 1 edit apart → collision (rule is aggressive by design)
  ])("isNameCollision(%s, %s) -> %s", (candidate, subject, expected) => {
    expect(isNameCollision(candidate, subject)).toBe(expected);
  });
});

describe("filterRealCompetitors — brand-ambiguity hard rule", () => {
  test("drops a same-/similar-named DIFFERENT product, keeps the real rival", () => {
    const raw: Competitor[] = [
      { name: "Nudge", url: "https://nudge.com", source: "dataforseo_serp", rank: 1 },
      { name: "Nudge.ai", url: "https://nudge.ai", source: "tavily", rank: 2 },
      { name: "Focusmate – Virtual Coworking", url: "https://focusmate.com", source: "dataforseo_serp", rank: 3 },
    ];
    const out = filterRealCompetitors(raw, { subjectName: "Nudgi", selfHost: "nudgi.ai" });
    expect(out.map((c) => c.name)).toEqual(["Focusmate"]);
  });

  test("drops a reference/dictionary 'NUDGE Synonyms' result (host + token collision)", () => {
    const raw: Competitor[] = [
      { name: "NUDGE Synonyms", url: "https://www.thesaurus.com/browse/nudge", source: "tavily", rank: 1 },
      { name: "NUDGE Synonyms & Antonyms", url: "https://some-blog.example/nudge", source: "tavily", rank: 2 },
      { name: "Focusmate", url: "https://focusmate.com", source: "tavily", rank: 3 },
    ];
    const out = filterRealCompetitors(raw, { subjectName: "Nudgi" });
    expect(out.map((c) => c.name)).toEqual(["Focusmate"]);
  });

  test("nudgi.ai garbage + a name-collision both vanish with subjectName set", () => {
    const raw: Competitor[] = [
      ...NUDGI_GARBAGE,
      { name: "Nudge", url: "https://nudge.com", source: "tavily", rank: 6 },
    ];
    expect(filterRealCompetitors(raw, { subjectName: "Nudgi", selfHost: "nudgi.ai" })).toEqual([]);
  });
});

describe("rankCompetitors integration", () => {
  test("nudgi.ai garbage → [] (no fabricated competitors)", () => {
    expect(rankCompetitors(NUDGI_GARBAGE, { selfHost: "nudgi.ai" })).toEqual([]);
  });

  test("app-mode competitors (real app names, store host) are NOT dropped by the filter", () => {
    // App-store hosts aren't aggregators and app names aren't listicles, so the
    // filter is a no-op for app mode (asserted on filterRealCompetitors directly,
    // since rankCompetitors' dedup-by-host is orthogonal to this change).
    const appComps: Competitor[] = [
      { name: "Habitica", url: "https://apps.apple.com/us/app/habitica/id994882113", source: "itunes", rank: 1 },
      { name: "Streaks", url: "https://apps.apple.com/us/app/streaks/id963034692", source: "itunes", rank: 2 },
    ];
    const out = filterRealCompetitors(appComps);
    expect(out.map((c) => c.name)).toEqual(["Habitica", "Streaks"]);
  });
});

describe("filterRealCompetitors — content-extracted (llm_extracted) names", () => {
  test("admits an llm_extracted competitor that carries no URL", () => {
    const out = filterRealCompetitors(
      [{ name: "Flippa", url: "", source: "llm_extracted", rank: 1 }],
      { subjectName: "Acquire", selfHost: "acquire.com" },
    );
    expect(out.map((c) => c.name)).toEqual(["Flippa"]);
  });

  test("keeps a real rival whose name contains the subject's common word", () => {
    // "Acquire" is a common word; MicroAcquire is a genuine marketplace rival, not a collision.
    const out = filterRealCompetitors(
      [{ name: "MicroAcquire", url: "", source: "llm_extracted", rank: 1 }],
      { subjectName: "Acquire", selfHost: "acquire.com" },
    );
    expect(out.map((c) => c.name)).toContain("MicroAcquire");
  });

  test("still drops a same-brand different-TLD impostor (Acquire.io for Acquire)", () => {
    const out = filterRealCompetitors(
      [{ name: "Acquire.io", url: "https://acquire.io", source: "dataforseo_serp", rank: 1 }],
      { subjectName: "Acquire", selfHost: "acquire.com" },
    );
    expect(out).toEqual([]);
  });

  test("drops an empty-name entry with no host to fall back to", () => {
    const out = filterRealCompetitors([{ name: "", url: "", source: "llm_extracted", rank: 1 }]);
    expect(out).toEqual([]);
  });
});

describe("rankCompetitors — content-extracted names are not collapsed on empty host", () => {
  test("keeps multiple distinct llm_extracted names (dedupe by name, not empty host)", () => {
    const out = rankCompetitors(
      [
        { name: "Flippa", url: "", source: "llm_extracted", rank: 1 },
        { name: "Empire Flippers", url: "", source: "llm_extracted", rank: 2 },
        { name: "MicroAcquire", url: "", source: "llm_extracted", rank: 3 },
      ],
      { selfHost: "acquire.com", subjectName: "Acquire" },
    );
    expect(out.map((c) => c.name).sort()).toEqual(["Empire Flippers", "Flippa", "MicroAcquire"]);
  });
});

describe("filterRealCompetitors — forum/aggregator artifacts (the Stripe 'Ask HN' bug)", () => {
  test("drops an 'Ask HN' SERP result from news.ycombinator.com (host)", () => {
    const out = filterRealCompetitors(
      [
        { name: "Ask HN", url: "https://news.ycombinator.com/item?id=36811026", source: "dataforseo_serp", rank: 1 },
        { name: "PayPal", url: "https://paypal.com", source: "dataforseo_serp", rank: 2 },
      ],
      { subjectName: "Stripe", selfHost: "stripe.com" },
    );
    expect(out.map((c) => c.name)).toEqual(["PayPal"]);
  });

  test("drops a forum-artifact name even from a non-aggregator host (name denylist)", () => {
    const out = filterRealCompetitors(
      [{ name: "Ask HN", url: "https://example.com/post", source: "tavily", rank: 1 }],
      { subjectName: "Stripe" },
    );
    expect(out).toEqual([]);
  });
});
