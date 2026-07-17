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
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expectCallsSymbol } from "@/lib/testing/tripwire";
import { brandTokensFor, isBrandKeyword } from "./brand-keywords";

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
