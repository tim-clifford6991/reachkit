/**
 * brand-keywords.test.ts — the ONE brand detector shared by the free footprint
 * classifier (search-visibility) and the paid keyword-gap filter. Before this
 * module the two engines each forked their own brand-token extraction + brand
 * keyword test, and they DIVERGED (different tokenizers, different substring
 * thresholds), so the same keyword could be "brand" in one engine and "category"
 * in the other. This pins the single, shared behavior.
 *
 * The semantics deliberately reproduce the FREE classifier's, because free's
 * classification feeds `computeSearchVisibility.score` — the search-presence
 * driver of the v5 unified Discoverability Score (invariant #1). Changing it would
 * move a persisted score. So the shared detector IS free's brand logic, now also
 * used by paid (whose gap filter is a render, not a persisted score).
 */
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expectCallsSymbol } from "@/lib/testing/tripwire";
import { brandTokensFor, isBrandKeyword } from "./brand-keywords";

// Mocked once for the engine-level RC1 parity test below (`gatherKeywordGap`
// with `brandNames`) — none of the other (pure) tests in this file touch the
// network/cache layer, so this has no effect on them.
vi.mock("@/lib/scan/cache/cached-adapters", () => ({
  cohortFor: vi.fn(async (self: string, override?: string[]) => ({
    category: "test",
    ranked: (override ?? []).map((d) => ({
      domain: d, name: d, closeness: 5, reason: "(selected)", etv: 0, ratio: null, sizeRelevant: true, sizeTier: "similar" as const,
    })),
    suggested: [],
  })),
  cachedRankedKeywords: vi.fn(async (domain: string) => {
    if (domain === "rival.com") {
      return [
        { keyword: "twitter integration guide", position: 5, volume: 1000, etv: 300, url: "https://rival.com/x" },
        { keyword: "social scheduling tips", position: 8, volume: 800, etv: 200, url: "https://rival.com/y" },
      ];
    }
    return []; // the subject itself ranks for nothing in this fixture
  }),
}));

describe("brandTokensFor", () => {
  it("takes the domain label as a brand token", () => {
    expect([...brandTokensFor(["trustmrr.com"])]).toEqual(["trustmrr"]);
  });

  it("splits a hyphenated/compound label into its parts (the free-classifier rule)", () => {
    // cirrus-insight.com → the whole label AND its meaningful parts, so a keyword
    // like "insight tool" registers as brand. This is where the two old engines
    // diverged: the paid copy kept only the joined form "cirrusinsight".
    const t = brandTokensFor(["cirrus-insight.com"]);
    expect(t.has("cirrus-insight")).toBe(true);
    expect(t.has("cirrus")).toBe(true);
    expect(t.has("insight")).toBe(true);
  });

  it("unions the tokens across every domain (subject + rivals)", () => {
    const t = brandTokensFor(["self.com", "rival.io"]);
    expect(t.has("self")).toBe(true);
    expect(t.has("rival")).toBe(true);
  });

  it("drops labels shorter than 3 chars (too generic to be a brand token)", () => {
    expect([...brandTokensFor(["ab.com"])]).toEqual([]);
  });

  it("strips a leading www. before taking the label", () => {
    expect(brandTokensFor(["www.trustmrr.com"]).has("trustmrr")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// RC1 parity fix (2026-07-19): commit 7de65fc threaded the subject's REAL name
// (facts.listing.name) into the FREE classifier's brand vocabulary via
// `brandTokensFor(domains, names)`, but the PAID keyword-gap engine
// (keyword-gap.ts) still called `brandTokensFor([self, ...cohort])` with no
// names — so a subject whose domain label is unusable/wrong (x.com's real
// brand is "twitter", not "x") had ITS OWN brand queries counted as a rival's
// gap keyword on the paid Supply page even after the free report was fixed.
// This is the ONE function both engines call — no re-implementation, so a
// names arg added here is automatically available to (and, below, proven used
// by) both.
// ---------------------------------------------------------------------------
describe("brandTokensFor(domains, names) — the subject's real name joins the brand vocabulary (RC1 parity)", () => {
  it("folds a name's tokens into the brand set even when the domain label is unusable", () => {
    // "x.com" -> label "x", dropped by the length>=3 floor — the domain alone
    // gives NO brand token. The name recovers it.
    const brands = brandTokensFor(["x.com"], ["Twitter / X"]);
    expect(brands.has("twitter")).toBe(true);
  });

  it("a generic word in the name does not itself become a brand token", () => {
    // "Platform" must not turn every ordinary "platform" query into a brand hit.
    const brands = brandTokensFor(["x.com"], ["Twitter Platform"]);
    expect(brands.has("twitter")).toBe(true);
    expect(brands.has("platform")).toBe(false);
  });

  it("names is optional — omitting it is unchanged from the old 1-arg call", () => {
    expect([...brandTokensFor(["trustmrr.com"])]).toEqual([...brandTokensFor(["trustmrr.com"], [])]);
  });
});

describe("isBrandKeyword", () => {
  const brands = brandTokensFor(["trustmrr.com"]); // {"trustmrr"}

  it("matches an exact brand token in the phrase", () => {
    expect(isBrandKeyword("trustmrr review", brands)).toBe(true);
  });

  it("matches a distinctive brand collapsed across words (substring, len ≥ 6)", () => {
    // "trust mrr" → joined "trustmrr" contains the 8-char brand token.
    expect(isBrandKeyword("trust mrr", brands)).toBe(true);
  });

  it("does NOT substring-match a SHORT brand token (< 6 chars) buried in a larger word", () => {
    // "otter" (5) inside "otterai" must not read as brand by substring — only the
    // ≥6 rule fires on substrings, so short brands match by exact token only.
    expect(isBrandKeyword("otterai tips", brandTokensFor(["otter.ai"]))).toBe(false);
  });

  it("DOES match a short brand token when it appears as an exact word", () => {
    expect(isBrandKeyword("otter integration", brandTokensFor(["otter.ai"]))).toBe(true);
  });

  it("returns false for a plain category phrase", () => {
    expect(isBrandKeyword("transactional email api", brands)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// RC1 guard — ONE brand detector. Both the free footprint classifier and the
// paid keyword-gap filter must route through THIS module, and neither may
// re-fork a local copy (which is exactly how they drifted before). Source
// tripwires: they check the real call site, not an import or a comment.
// ---------------------------------------------------------------------------
describe("one brand detector — both engines share this module (RC1 guard)", () => {
  it("keyword-gap's gatherKeywordGap calls the shared brandTokensFor + isBrandKeyword", () => {
    expectCallsSymbol("lib/scan/referral/keyword-gap.ts", "brandTokensFor", { within: "gatherKeywordGap" });
    expectCallsSymbol("lib/scan/referral/keyword-gap.ts", "isBrandKeyword", { within: "gatherKeywordGap" });
  });

  it("search-visibility's buildVocab + classify call the shared detector", () => {
    // brandTokensFor is called only in buildVocab; a whole-file check is valid here
    // (the file IMPORTS the symbol, it doesn't define it — so this is not vacuous).
    // buildVocab's bare-object return type defeats `within` brace-matching, so we
    // don't scope this one; isBrandKeyword IS scoped to classify (clean return type).
    expectCallsSymbol("lib/scan/search-visibility.ts", "brandTokensFor");
    expectCallsSymbol("lib/scan/search-visibility.ts", "isBrandKeyword", { within: "classify" });
  });

  it("neither engine re-forks a LOCAL brand detector (no drift can reappear)", () => {
    for (const f of ["lib/scan/referral/keyword-gap.ts", "lib/scan/search-visibility.ts"]) {
      const src = readFileSync(resolve(process.cwd(), f), "utf8");
      expect(src).not.toMatch(/function\s+brandTokens\b/); // the old paid fork
      expect(src).not.toMatch(/function\s+isBrandKeyword\b/); // any re-forked local copy
    }
  });
});

// ---------------------------------------------------------------------------
// RC1 parity fix, engine level: `gatherKeywordGap` must thread its caller's
// `brandNames` into `brandTokensFor` exactly like `classifyFootprint` does —
// proving the WIRING, not just that `brandTokensFor` itself supports a names
// arg (the unit tests above already prove that in isolation).
// ---------------------------------------------------------------------------
describe("gatherKeywordGap threads brandNames into brandTokensFor (RC1 parity, engine level)", () => {
  it("WITHOUT brandNames: a rival's 'twitter' keyword is misread as an opportunity gap", async () => {
    const { gatherKeywordGap } = await import("./keyword-gap");
    const result = await gatherKeywordGap("x.com", { competitorDomains: ["rival.com"] });
    const gapKeywords = result.gaps.map((g) => g.keyword);
    expect(gapKeywords).toContain("twitter integration guide");
  });

  it("WITH brandNames ['Twitter / X']: the same keyword is filtered as the subject's OWN brand, not a gap", async () => {
    const { gatherKeywordGap } = await import("./keyword-gap");
    const result = await gatherKeywordGap("x.com", { competitorDomains: ["rival.com"], brandNames: ["Twitter / X"] });
    const gapKeywords = result.gaps.map((g) => g.keyword);
    expect(gapKeywords).not.toContain("twitter integration guide");
    // A genuine, non-brand rival gap keyword still survives — the fix filters
    // brand noise, it doesn't blank the whole gap list.
    expect(gapKeywords).toContain("social scheduling tips");
  });
});
